"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { TRACKING_CONFIG } from "@/config/tracking";
import { createCalibrationProfile, type CalibrationProfile } from "@/lib/tracking/calibration";
import { hasTrackablePoseSegment } from "@/lib/tracking/poseReliability";
import { TrackingState, type PoseFrame } from "@/lib/tracking/types";

export type CalibrationStage = "STAND_IN_FRAME" | "HOLD_NEUTRAL" | "CALIBRATING" | "READY";

type Props = {
  trackerPhase: "idle" | "initializing" | "running" | "error";
  trackingState: TrackingState;
  poseFrameRef: RefObject<PoseFrame>;
  setCalibrating: (active: boolean) => void;
};

export function useCalibration({ trackerPhase, trackingState, poseFrameRef, setCalibrating }: Props) {
  const [stage, setStage] = useState<CalibrationStage>("STAND_IN_FRAME");
  const [profile, setProfile] = useState<CalibrationProfile | null>(null);
  const stageRef = useRef<CalibrationStage>("STAND_IN_FRAME");
  const stageStartedAtRef = useRef(0);
  const samplesRef = useRef<PoseFrame[]>([]);
  const lastSampleTimestampRef = useRef(-1);

  const transition = useCallback((nextStage: CalibrationStage, now = performance.now()) => {
    stageRef.current = nextStage;
    stageStartedAtRef.current = now;
    setStage(nextStage);
  }, []);

  const recalibrate = useCallback(() => {
    samplesRef.current = [];
    lastSampleTimestampRef.current = -1;
    setProfile(null);
    setCalibrating(false);
    transition("STAND_IN_FRAME");
  }, [setCalibrating, transition]);

  useEffect(() => {
    if (trackerPhase !== "running" || stage === "READY") return;
    let animationFrame = 0;
    const tick = (now: number) => {
      const frame = poseFrameRef.current;
      const personReady = trackerPhase === "running" && frame.trackingActive && hasTrackablePoseSegment(frame);
      const currentStage = stageRef.current;

      if (currentStage === "STAND_IN_FRAME" && personReady && trackingState === TrackingState.TRACKING) {
        transition("HOLD_NEUTRAL", now);
      } else if (currentStage === "HOLD_NEUTRAL") {
        if (!personReady || trackingState === TrackingState.TRACKING_LOST) {
          transition("STAND_IN_FRAME", now);
        } else if (now - stageStartedAtRef.current >= TRACKING_CONFIG.neutralHoldMs) {
          samplesRef.current = [];
          lastSampleTimestampRef.current = -1;
          setCalibrating(true);
          transition("CALIBRATING", now);
        }
      } else if (currentStage === "CALIBRATING") {
        if (!personReady || trackingState === TrackingState.TRACKING_LOST) {
          samplesRef.current = [];
          setCalibrating(false);
          transition("STAND_IN_FRAME", now);
        } else {
          if (frame.timestamp !== lastSampleTimestampRef.current) {
            samplesRef.current.push(frame);
            lastSampleTimestampRef.current = frame.timestamp;
          }
          const durationComplete = now - stageStartedAtRef.current >= TRACKING_CONFIG.calibrationDurationMs;
          if (durationComplete && samplesRef.current.length >= TRACKING_CONFIG.minimumCalibrationFrames) {
            const nextProfile = createCalibrationProfile(samplesRef.current);
            if (nextProfile) {
              setProfile(nextProfile);
              setCalibrating(false);
              transition("READY", now);
            }
          }
        }
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [poseFrameRef, setCalibrating, stage, trackerPhase, trackingState, transition]);

  return { stage, profile, recalibrate };
}
