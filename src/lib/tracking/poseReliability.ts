import { TRACKING_CONFIG } from "@/config/tracking";
import { TRACKED_JOINTS, type PoseFrame, type PoseJointName, type Vec3 } from "./types";

const TRACKABLE_SEGMENTS: readonly (readonly [PoseJointName, PoseJointName])[] = [
  ["nose", "leftShoulder"],
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
  return TRACKED_JOINTS.every((name) => isPoseJointReliable(frame, name));
}
