export const TRACKED_JOINTS = [
  "nose",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
] as const;

export type PoseJointName = (typeof TRACKED_JOINTS)[number];

export type Vec3 = { x: number; y: number; z: number };

export type PoseJoint = {
  image: Vec3;
  world: Vec3 | null;
  confidence: number;
};

export type PoseFrame = {
  timestamp: number;
  confidence: number;
  bodyCenter: Vec3 | null;
  worldBodyCenter: Vec3 | null;
  joints: Partial<Record<PoseJointName, PoseJoint>>;
  trackingActive: boolean;
};

export enum TrackingState {
  NO_PERSON = "NO_PERSON",
  CALIBRATING = "CALIBRATING",
  TRACKING = "TRACKING",
  TRACKING_LOST = "TRACKING_LOST",
}

export const EMPTY_POSE_FRAME: PoseFrame = {
  timestamp: 0,
  confidence: 0,
  bodyCenter: null,
  worldBodyCenter: null,
  joints: {},
  trackingActive: false,
};
