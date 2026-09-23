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

export function useSkeletalMotion(poseFrameRef: RefObject<PoseFrame>, calibration: CalibrationProfile | null) {
  const skeletalFrameRef = useRef<SkeletalFrame>({ ...EMPTY_SKELETAL_FRAME });
  const mapper = useMemo(() => calibration ? new SkeletonMapper(calibration) : null, [calibration]);

  useEffect(() => {
    let animationFrame = 0;
    let lastPoseTimestamp = -1;
    const process = () => {
      const poseFrame = poseFrameRef.current;
      if (poseFrame.timestamp !== lastPoseTimestamp) {
        lastPoseTimestamp = poseFrame.timestamp;
        const trackingActive = Boolean(mapper && poseFrame.trackingActive);
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
        }
        const bonePose = mapper?.map(poseFrame) ?? { timestamp: poseFrame.timestamp, rotations: {} };
        skeletalFrameRef.current = skeletalFrameFromBonePose(bonePose, trackingActive, rootPosition);
      }
      animationFrame = window.requestAnimationFrame(process);
    };
    animationFrame = window.requestAnimationFrame(process);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [calibration, mapper, poseFrameRef]);

  return skeletalFrameRef;
}
