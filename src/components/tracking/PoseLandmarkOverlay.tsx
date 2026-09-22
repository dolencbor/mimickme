"use client";

import { useEffect, useRef, type RefObject } from "react";
import { TRACKING_CONFIG } from "@/config/tracking";
import type { PoseFrame, PoseJointName } from "@/lib/tracking/types";

const CONNECTIONS: [PoseJointName, PoseJointName][] = [
  ["nose", "leftShoulder"],
  ["nose", "rightShoulder"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

type Props = {
  enabled: boolean;
  poseFrameRef: RefObject<PoseFrame>;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function PoseLandmarkOverlay({ enabled, poseFrameRef, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animationFrame = 0;

    const draw = () => {
      const video = videoRef.current;
      if (video?.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (enabled) {
        const frame = poseFrameRef.current;
        context.lineWidth = Math.max(2, canvas.width / 360);
        context.strokeStyle = "rgba(131, 212, 155, 0.9)";
        context.fillStyle = "#f5f5f5";

        for (const [fromName, toName] of CONNECTIONS) {
          const from = frame.joints[fromName];
          const to = frame.joints[toName];
          if (!from || !to) continue;
          if (from.confidence < TRACKING_CONFIG.confidenceThreshold || to.confidence < TRACKING_CONFIG.confidenceThreshold) continue;
          context.beginPath();
          context.moveTo(from.image.x * canvas.width, from.image.y * canvas.height);
          context.lineTo(to.image.x * canvas.width, to.image.y * canvas.height);
          context.stroke();
        }

        for (const joint of Object.values(frame.joints)) {
          if (!joint || joint.confidence < TRACKING_CONFIG.confidenceThreshold) continue;
          context.beginPath();
          context.arc(joint.image.x * canvas.width, joint.image.y * canvas.height, Math.max(3, canvas.width / 240), 0, Math.PI * 2);
          context.fill();
        }
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [enabled, poseFrameRef, videoRef]);

  return <canvas ref={canvasRef} className={`pose-overlay ${enabled ? "" : "hidden"}`} aria-hidden="true" />;
}
