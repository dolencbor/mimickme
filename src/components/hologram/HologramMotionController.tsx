"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Group, MathUtils } from "three";
import { HOLOGRAM_MOTION_CONFIG } from "@/config/hologram";
import { hasUsableSkeletalMotion, type SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import { TrackingState } from "@/lib/tracking/types";

type Props = {
  motionRef: RefObject<Group | null>;
  trackingInfluenceRef: RefObject<number>;
  skeletalFrameRef: RefObject<SkeletalFrame>;
  trackingState: TrackingState;
  modelRadius: number;
};

function normalizeAngle(angle: number) {
  return MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}

export function HologramMotionController({ motionRef, trackingInfluenceRef, skeletalFrameRef, trackingState, modelRadius }: Props) {
  const stateRef = useRef(trackingState);
  const idleAngleRef = useRef(0);
  const lossDeadlineRef = useRef(0);
  const wasTakingOverRef = useRef(false);

  useEffect(() => {
    stateRef.current = trackingState;
  }, [trackingState]);

  useFrame((state, deltaSeconds) => {
    const nowMs = state.clock.elapsedTime * 1_000;
    const isTracking = stateRef.current === TrackingState.TRACKING && hasUsableSkeletalMotion(skeletalFrameRef.current);
    if (isTracking) lossDeadlineRef.current = nowMs + HOLOGRAM_MOTION_CONFIG.trackingLostDelayMs;
    const shouldTakeOver = isTracking || nowMs < lossDeadlineRef.current;

    if (shouldTakeOver && !wasTakingOverRef.current) {
      idleAngleRef.current = normalizeAngle(idleAngleRef.current);
    }
    wasTakingOverRef.current = shouldTakeOver;

    const transitionStep = deltaSeconds / HOLOGRAM_MOTION_CONFIG.trackingTransitionSeconds;
    trackingInfluenceRef.current = MathUtils.clamp(
      trackingInfluenceRef.current + (shouldTakeOver ? transitionStep : -transitionStep),
      0,
      1,
    );

    const idleWeight = 1 - trackingInfluenceRef.current;
    if (shouldTakeOver) {
      idleAngleRef.current = MathUtils.damp(
        idleAngleRef.current,
        0,
        HOLOGRAM_MOTION_CONFIG.idleRotationReturnSpeed,
        deltaSeconds,
      );
    } else {
      idleAngleRef.current = normalizeAngle(
        idleAngleRef.current + HOLOGRAM_MOTION_CONFIG.idleRotationRadiansPerSecond * deltaSeconds * idleWeight,
      );
    }

    if (!motionRef.current) return;
    const floatAmplitude = modelRadius * HOLOGRAM_MOTION_CONFIG.idleFloatAmplitudeToModelRadius;
    const floatPhase = state.clock.elapsedTime * Math.PI * 2 * HOLOGRAM_MOTION_CONFIG.idleFloatCyclesPerSecond;
    motionRef.current.rotation.y = idleAngleRef.current;
    motionRef.current.position.y = Math.sin(floatPhase) * floatAmplitude * idleWeight;
  }, -1);

  return null;
}
