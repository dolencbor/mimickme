import { hasTrackablePoseSegment, isPoseJointReliable } from "./poseReliability";
import type { PoseFrame, PoseJoint, PoseJointName, Vec3 } from "./types";

type LandmarkLike = Vec3 & { visibility?: number; presence?: number };

type PoseResultLike = {
  landmarks: LandmarkLike[][];
  worldLandmarks: LandmarkLike[][];
};

const LANDMARK_INDEX: Record<PoseJointName, number> = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
};

function midpoint(left: Vec3 | undefined, right: Vec3 | undefined): Vec3 | null {
  if (!left || !right) return null;
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: (left.z + right.z) / 2,
  };
}

export function processPoseResult(result: PoseResultLike, timestamp: number): PoseFrame {
  const imageLandmarks = result.landmarks[0];
  const worldLandmarks = result.worldLandmarks[0];
  if (!imageLandmarks) {
    return {
      timestamp,
      confidence: 0,
      bodyCenter: null,
      worldBodyCenter: null,
      joints: {},
      trackingActive: false,
    };
  }

  const joints: PoseFrame["joints"] = {};
  let confidenceTotal = 0;
  let confidenceSamples = 0;

  for (const [name, index] of Object.entries(LANDMARK_INDEX) as [PoseJointName, number][]) {
    const image = imageLandmarks[index];
    if (!image) continue;
    const world = worldLandmarks?.[index];
    const confidence = Math.max(0, Math.min(1, image.visibility ?? 1, image.presence ?? 1));
    const joint: PoseJoint = {
      image: { x: image.x, y: image.y, z: image.z },
      world: world ? { x: world.x, y: world.y, z: world.z } : null,
      confidence,
    };
    joints[name] = joint;
    confidenceTotal += confidence;
    confidenceSamples += 1;
  }

  const confidence = confidenceSamples > 0 ? confidenceTotal / confidenceSamples : 0;
  const partialFrame: PoseFrame = {
    timestamp,
    confidence,
    bodyCenter: null,
    worldBodyCenter: null,
    joints,
    trackingActive: false,
  };
  const hipsReliable = isPoseJointReliable(partialFrame, "leftHip") && isPoseJointReliable(partialFrame, "rightHip");
  const bodyCenter = hipsReliable ? midpoint(joints.leftHip?.image, joints.rightHip?.image) : null;
  const worldBodyCenter = hipsReliable
    ? midpoint(joints.leftHip?.world ?? undefined, joints.rightHip?.world ?? undefined)
    : null;

  return {
    timestamp,
    confidence,
    bodyCenter,
    worldBodyCenter,
    joints,
    trackingActive: hasTrackablePoseSegment(partialFrame),
  };
}
