import { TRACKED_JOINTS, type PoseFrame, type PoseJoint, type Vec3 } from "./types";
import { hasReliableFullBodyPose } from "./poseReliability";

export type CalibrationProfile = {
  createdAt: number;
  sampleCount: number;
  neutralPose: PoseFrame;
  neutralShoulderDirection: Vec3;
  neutralHipDirection: Vec3;
  neutralSpineDirection: Vec3;
  bodyCenter: Vec3;
  facingDirection: Vec3;
};

function add(target: Vec3, value: Vec3) {
  target.x += value.x;
  target.y += value.y;
  target.z += value.z;
}

function scale(value: Vec3, amount: number): Vec3 {
  return { x: value.x * amount, y: value.y * amount, z: value.z * amount };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return scale({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }, 0.5);
}

function normalize(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return scale(value, 1 / length);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function point(joint: PoseJoint | undefined) {
  return joint?.world ?? joint?.image ?? null;
}

export function createCalibrationProfile(frames: readonly PoseFrame[]): CalibrationProfile | null {
  const validFrames = frames.filter((frame) => frame.trackingActive && hasReliableFullBodyPose(frame));
  if (validFrames.length === 0) return null;

  const joints: PoseFrame["joints"] = {};
  for (const name of TRACKED_JOINTS) {
    const imageTotal = { x: 0, y: 0, z: 0 };
    const worldTotal = { x: 0, y: 0, z: 0 };
    let imageCount = 0;
    let worldCount = 0;
    let confidence = 0;
    for (const frame of validFrames) {
      const joint = frame.joints[name];
      if (!joint) continue;
      add(imageTotal, joint.image);
      imageCount += 1;
      confidence += joint.confidence;
      if (joint.world) {
        add(worldTotal, joint.world);
        worldCount += 1;
      }
    }
    if (imageCount > 0) {
      joints[name] = {
        image: scale(imageTotal, 1 / imageCount),
        world: worldCount > 0 ? scale(worldTotal, 1 / worldCount) : null,
        confidence: confidence / imageCount,
      };
    }
  }

  const leftShoulder = point(joints.leftShoulder);
  const rightShoulder = point(joints.rightShoulder);
  const leftHip = point(joints.leftHip);
  const rightHip = point(joints.rightHip);
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderDirection = normalize(subtract(leftShoulder, rightShoulder));
  const hipDirection = normalize(subtract(leftHip, rightHip));
  const spineDirection = normalize(subtract(shoulderCenter, hipCenter));
  const facingDirection = normalize(cross(shoulderDirection, spineDirection));
  const confidence = validFrames.reduce((sum, frame) => sum + frame.confidence, 0) / validFrames.length;

  return {
    createdAt: validFrames.at(-1)?.timestamp ?? 0,
    sampleCount: validFrames.length,
    neutralPose: {
      timestamp: validFrames.at(-1)?.timestamp ?? 0,
      confidence,
      bodyCenter: midpoint(joints.leftHip?.image ?? leftHip, joints.rightHip?.image ?? rightHip),
      worldBodyCenter: joints.leftHip?.world && joints.rightHip?.world ? midpoint(joints.leftHip.world, joints.rightHip.world) : null,
      joints,
      trackingActive: true,
    },
    neutralShoulderDirection: shoulderDirection,
    neutralHipDirection: hipDirection,
    neutralSpineDirection: spineDirection,
    bodyCenter: hipCenter,
    facingDirection,
  };
}
