"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { TRACKING_CONFIG } from "@/config/tracking";
import { SkeletonMapper } from "@/lib/tracking/SkeletonMapper";
import type { CalibrationProfile } from "@/lib/tracking/calibration";
import {
  EMPTY_SKELETAL_FRAME,
  skeletalFrameFromBonePose,
  type RootPosition,
  type SkeletalFrame,
} from "@/lib/tracking/skeletalFrame";
import type { PoseFrame } from "@/lib/tracking/types";

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

function reliableImageDistance(frame: PoseFrame, from: "leftShoulder" | "rightShoulder" | "leftHip" | "rightHip", to: "leftHip" | "rightHip" | "leftKnee" | "rightKnee") {
  const start = frame.joints[from];
  const end = frame.joints[to];
  if (!start || !end) return null;
  if (start.confidence < TRACKING_CONFIG.confidenceThreshold || end.confidence < TRACKING_CONFIG.confidenceThreshold) return null;
  return Math.hypot(start.image.x - end.image.x, start.image.y - end.image.y);
}

function apparentBodyScale(frame: PoseFrame, neutral: PoseFrame) {
  let ratioTotal = 0;
  let ratioCount = 0;
  const leftTorso = reliableImageDistance(frame, "leftShoulder", "leftHip");
  const neutralLeftTorso = reliableImageDistance(neutral, "leftShoulder", "leftHip");
  if (leftTorso && neutralLeftTorso) {
    ratioTotal += leftTorso / neutralLeftTorso;
    ratioCount += 1;
  }
  const rightTorso = reliableImageDistance(frame, "rightShoulder", "rightHip");
  const neutralRightTorso = reliableImageDistance(neutral, "rightShoulder", "rightHip");
  if (rightTorso && neutralRightTorso) {
    ratioTotal += rightTorso / neutralRightTorso;
    ratioCount += 1;
  }
  const leftThigh = reliableImageDistance(frame, "leftHip", "leftKnee");
  const neutralLeftThigh = reliableImageDistance(neutral, "leftHip", "leftKnee");
  if (leftThigh && neutralLeftThigh) {
    ratioTotal += leftThigh / neutralLeftThigh;
    ratioCount += 1;
  }
  const rightThigh = reliableImageDistance(frame, "rightHip", "rightKnee");
  const neutralRightThigh = reliableImageDistance(neutral, "rightHip", "rightKnee");
  if (rightThigh && neutralRightThigh) {
    ratioTotal += rightThigh / neutralRightThigh;
    ratioCount += 1;
  }
  return ratioCount > 0 ? ratioTotal / ratioCount : 1;
}

export function useSkeletalMotion(poseFrameRef: RefObject<PoseFrame>, calibration: CalibrationProfile | null) {
  const skeletalFrameRef = useRef<SkeletalFrame>({ ...EMPTY_SKELETAL_FRAME });
  const mapper = useMemo(() => calibration ? new SkeletonMapper(calibration) : null, [calibration]);

  useEffect(() => {
    if (!mapper) {
      skeletalFrameRef.current = { ...EMPTY_SKELETAL_FRAME };
      return;
    }
    let animationFrame = 0;
    let lastPoseTimestamp = -1;
    const process = () => {
      const poseFrame = poseFrameRef.current;
      if (poseFrame.timestamp !== lastPoseTimestamp) {
        lastPoseTimestamp = poseFrame.timestamp;
        const trackingActive = poseFrame.trackingActive;
        const neutralCenter = calibration?.neutralPose.bodyCenter;
        const rootPosition: RootPosition = [0, 0, 0];
        if (trackingActive && poseFrame.bodyCenter && neutralCenter) {
          rootPosition[0] = clamp(
            -(poseFrame.bodyCenter.x - neutralCenter.x) * TRACKING_CONFIG.rootHorizontalScale,
            TRACKING_CONFIG.rootHorizontalLimit,
          );
          rootPosition[1] = clamp(
            (neutralCenter.y - poseFrame.bodyCenter.y) * TRACKING_CONFIG.rootVerticalScale,
            TRACKING_CONFIG.rootVerticalLimit,
          );
          rootPosition[2] = clamp(
            (apparentBodyScale(poseFrame, calibration.neutralPose) - 1) * TRACKING_CONFIG.rootDepthScale,
            TRACKING_CONFIG.rootDepthLimit,
          );
        }
        const bonePose = mapper.map(poseFrame);
        skeletalFrameRef.current = skeletalFrameFromBonePose(bonePose, trackingActive, rootPosition);
      }
      animationFrame = window.requestAnimationFrame(process);
    };
    animationFrame = window.requestAnimationFrame(process);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [calibration, mapper, poseFrameRef]);

  return skeletalFrameRef;
}
