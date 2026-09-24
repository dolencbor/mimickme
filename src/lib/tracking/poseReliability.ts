import { TRACKING_CONFIG } from "@/config/tracking";
import type { PoseFrame, PoseJointName, Vec3 } from "./types";

const FACE_JOINTS = new Set<PoseJointName>([
  "nose", "leftEyeInner", "leftEye", "leftEyeOuter", "rightEyeInner", "rightEye", "rightEyeOuter",
  "leftEar", "rightEar", "mouthLeft", "mouthRight",
]);
const EXTREMITY_JOINTS = new Set<PoseJointName>([
  "leftWrist", "rightWrist", "leftPinky", "rightPinky", "leftIndex", "rightIndex", "leftThumb", "rightThumb",
  "leftAnkle", "rightAnkle", "leftHeel", "rightHeel", "leftFootIndex", "rightFootIndex",
]);

const TRACKABLE_SEGMENTS: readonly (readonly [PoseJointName, PoseJointName])[] = [
  ["leftEar", "rightEar"],
  ["leftEye", "rightEye"],
  ["nose", "leftShoulder"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["leftWrist", "leftIndex"],
  ["leftWrist", "leftPinky"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["rightWrist", "rightIndex"],
  ["rightWrist", "rightPinky"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["leftAnkle", "leftHeel"],
  ["leftHeel", "leftFootIndex"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
  ["rightAnkle", "rightHeel"],
  ["rightHeel", "rightFootIndex"],
];

export function isPoseJointReliable(frame: PoseFrame, name: PoseJointName) {
  const joint = frame.joints[name];
  const threshold = FACE_JOINTS.has(name)
    ? TRACKING_CONFIG.faceConfidenceThreshold
    : EXTREMITY_JOINTS.has(name)
      ? TRACKING_CONFIG.extremityConfidenceThreshold
      : TRACKING_CONFIG.confidenceThreshold;
  return Boolean(joint && joint.confidence >= threshold);
}

export function reliablePosePoint(frame: PoseFrame, name: PoseJointName): Vec3 | null {
  if (!isPoseJointReliable(frame, name)) return null;
  const joint = frame.joints[name];
  return joint?.world ?? joint?.image ?? null;
}

export function hasTrackablePoseSegment(frame: PoseFrame) {
  return TRACKABLE_SEGMENTS.some(([from, to]) => (
    isPoseJointReliable(frame, from) && isPoseJointReliable(frame, to)
  ));
}
