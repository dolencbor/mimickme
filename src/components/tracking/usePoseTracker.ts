"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_CONFIG, TRACKING_CONFIG } from "@/config/tracking";
import { processPoseResult } from "@/lib/tracking/poseProcessor";
import { nextTrackingState } from "@/lib/tracking/trackingStateMachine";
import { EMPTY_POSE_FRAME, TrackingState, type PoseFrame } from "@/lib/tracking/types";

type TrackerPhase = "idle" | "initializing" | "running" | "error";

export type TrackerDiagnostics = {
  fps: number;
  confidence: number;
  backend: "GPU" | "CPU" | null;
  people: 0 | 1;
};

function trackerErrorMessage(error: unknown, cameraReady: boolean) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Camera permission denied. Allow camera access in the browser and try again.";
    if (error.name === "NotFoundError") return "No camera was found. Connect a webcam and try again.";
    if (error.name === "NotReadableError") return "The camera is already in use by another application.";
    if (error.name === "TimeoutError") return "Camera permission timed out. Allow camera access in the browser and try again.";
  }
  if (cameraReady) return "MediaPipe initialization failed. Check the network connection and reload the page.";
  return "Body tracking could not start. Check the camera and network connection, then try again.";
}

export function usePoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const poseFrameRef = useRef<PoseFrame>({ ...EMPTY_POSE_FRAME });
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef(0);
  const stateRef = useRef(TrackingState.NO_PERSON);
  const lastPersonSeenAtRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const [phase, setPhase] = useState<TrackerPhase>("idle");
  const [trackingState, setTrackingState] = useState(TrackingState.NO_PERSON);
  const [diagnostics, setDiagnostics] = useState<TrackerDiagnostics>({ fps: 0, confidence: 0, backend: null, people: 0 });
  const [error, setError] = useState<string | null>(null);

  const disposeResources = useCallback(() => {
    runIdRef.current += 1;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = 0;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    disposeResources();
    poseFrameRef.current = { ...EMPTY_POSE_FRAME };
    stateRef.current = TrackingState.NO_PERSON;
    lastPersonSeenAtRef.current = null;
    setTrackingState(TrackingState.NO_PERSON);
    setDiagnostics({ fps: 0, confidence: 0, backend: null, people: 0 });
    setError(null);
    setPhase("idle");
  }, [disposeResources]);

  const start = useCallback(async () => {
    if (phase === "initializing" || phase === "running") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS or localhost in a supported browser.");
      setPhase("error");
      return;
    }

    disposeResources();
    const runId = runIdRef.current;
    let cameraReady = false;
    setError(null);
    setPhase("initializing");

    try {
      const modulePromise = import("@mediapipe/tasks-vision");
      const mediaRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      const stream = await new Promise<MediaStream>((resolve, reject) => {
        let timedOut = false;
        const timeout = window.setTimeout(() => {
          timedOut = true;
          reject(new DOMException("Camera permission timed out", "TimeoutError"));
        }, TRACKING_CONFIG.cameraPermissionTimeoutMs);
        mediaRequest.then((mediaStream) => {
          if (timedOut) {
            mediaStream.getTracks().forEach((track) => track.stop());
            return;
          }
          window.clearTimeout(timeout);
          resolve(mediaStream);
        }, (mediaError: unknown) => {
          window.clearTimeout(timeout);
          reject(mediaError);
        });
      });
      if (runId !== runIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      cameraReady = true;
      const video = videoRef.current;
      if (!video) throw new Error("Video element unavailable");
      video.srcObject = stream;
      await video.play();

      const { FilesetResolver, PoseLandmarker } = await modulePromise;
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_CONFIG.wasmRoot);
      const createLandmarker = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MEDIAPIPE_CONFIG.modelAssetPath, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: TRACKING_CONFIG.confidenceThreshold,
          minPosePresenceConfidence: TRACKING_CONFIG.confidenceThreshold,
          minTrackingConfidence: TRACKING_CONFIG.confidenceThreshold,
          outputSegmentationMasks: false,
        });

      let landmarker: PoseLandmarker;
      let backend: "GPU" | "CPU" = "GPU";
      try {
        landmarker = await createLandmarker("GPU");
      } catch {
        backend = "CPU";
        landmarker = await createLandmarker("CPU");
      }
      if (runId !== runIdRef.current) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;
      setDiagnostics({ fps: 0, confidence: 0, backend, people: 0 });
      setPhase("running");

      let lastVideoTime = -1;
      let lastInferenceAt = 0;
      let statsStartedAt = performance.now();
      let inferenceCount = 0;
      let lastDiagnosticsAt = 0;
      const minimumFrameInterval = 1_000 / TRACKING_CONFIG.maxInferenceFps;

      const processVideoFrame = (now: number) => {
        if (runId !== runIdRef.current || !landmarkerRef.current) return;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          animationFrameRef.current = window.requestAnimationFrame(processVideoFrame);
          return;
        }
        const hasNewFrame = video.currentTime !== lastVideoTime;
        if (hasNewFrame && now - lastInferenceAt >= minimumFrameInterval) {
          lastVideoTime = video.currentTime;
          lastInferenceAt = now;
          landmarker.detectForVideo(video, now, (result) => {
            const frame = processPoseResult(result, now);
            poseFrameRef.current = frame;
            inferenceCount += 1;
            if (frame.trackingActive) lastPersonSeenAtRef.current = now;

            const nextState = nextTrackingState({
              current: stateRef.current,
              personDetected: frame.trackingActive,
              now,
              lastPersonSeenAt: lastPersonSeenAtRef.current,
            });
            if (nextState !== stateRef.current) {
              stateRef.current = nextState;
              setTrackingState(nextState);
            }

            if (now - lastDiagnosticsAt >= TRACKING_CONFIG.diagnosticsIntervalMs) {
              const elapsed = Math.max(1, now - statsStartedAt);
              setDiagnostics({
                fps: (inferenceCount * 1_000) / elapsed,
                confidence: frame.confidence,
                backend,
                people: frame.trackingActive ? 1 : 0,
              });
              lastDiagnosticsAt = now;
              if (elapsed >= 2_000) {
                statsStartedAt = now;
                inferenceCount = 0;
              }
            }
          });
        }
        animationFrameRef.current = window.requestAnimationFrame(processVideoFrame);
      };

      animationFrameRef.current = window.requestAnimationFrame(processVideoFrame);
    } catch (caught) {
      disposeResources();
      setError(trackerErrorMessage(caught, cameraReady));
      setPhase("error");
    }
  }, [disposeResources, phase]);

  useEffect(() => disposeResources, [disposeResources]);

  return { videoRef, poseFrameRef, phase, trackingState, diagnostics, error, start, stop };
}
