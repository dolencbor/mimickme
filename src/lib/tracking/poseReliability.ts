import { TRACKING_CONFIG } from "@/config/tracking";
import { CALIBRATION_JOINTS, type PoseFrame, type PoseJointName, type Vec3 } from "./types";

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
  return Boolean(joint && joint.confidence >= TRACKING_CONFIG.confidenceThreshold);
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

export function hasReliableFullBodyPose(frame: PoseFrame) {
  return CALIBRATION_JOINTS.every((name) => isPoseJointReliable(frame, name));
}
