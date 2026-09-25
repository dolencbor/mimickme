import { Matrix4, Quaternion, Vector3 } from "three";
import { DIRECTLY_CONTROLLED_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import type { CalibrationProfile } from "./calibration";
import { reliablePosePoint } from "./poseReliability";
import type { PoseFrame, PoseJointName, Vec3 } from "./types";

export type QuaternionTuple = [number, number, number, number];

export type BonePose = {
  timestamp: number;
  rotations: Partial<Record<SemanticBone, QuaternionTuple>>;
};

type OrientationKey = "hips" | "torso" | "head";
type LimbSegment = {
  bone: SemanticBone;
  from: PoseJointName;
  to: PoseJointName;
  maxAngle: number;
};

const DEG = Math.PI / 180;
const IDENTITY = new Quaternion();
const MIRRORED_JOINTS: Partial<Record<PoseJointName, PoseJointName>> = {
  leftEyeInner: "rightEyeInner",
  leftEye: "rightEye",
  leftEyeOuter: "rightEyeOuter",
  rightEyeInner: "leftEyeInner",
  rightEye: "leftEye",
  rightEyeOuter: "leftEyeOuter",
  leftEar: "rightEar",
  rightEar: "leftEar",
  mouthLeft: "mouthRight",
  mouthRight: "mouthLeft",
  leftShoulder: "rightShoulder",
  rightShoulder: "leftShoulder",
  leftElbow: "rightElbow",
  rightElbow: "leftElbow",
  leftWrist: "rightWrist",
  rightWrist: "leftWrist",
  leftPinky: "rightPinky",
  rightPinky: "leftPinky",
  leftIndex: "rightIndex",
  rightIndex: "leftIndex",
  leftThumb: "rightThumb",
  rightThumb: "leftThumb",
  leftHip: "rightHip",
  rightHip: "leftHip",
  leftKnee: "rightKnee",
  rightKnee: "leftKnee",
  leftAnkle: "rightAnkle",
  rightAnkle: "leftAnkle",
  leftHeel: "rightHeel",
  rightHeel: "leftHeel",
  leftFootIndex: "rightFootIndex",
  rightFootIndex: "leftFootIndex",
};
const LIMB_SEGMENTS: readonly LimbSegment[] = [
  { bone: "leftUpperArm", from: "leftShoulder", to: "leftElbow", maxAngle: 135 * DEG },
  { bone: "leftForearm", from: "leftElbow", to: "leftWrist", maxAngle: 135 * DEG },
  { bone: "rightUpperArm", from: "rightShoulder", to: "rightElbow", maxAngle: 135 * DEG },
  { bone: "rightForearm", from: "rightElbow", to: "rightWrist", maxAngle: 135 * DEG },
  { bone: "leftUpperLeg", from: "leftHip", to: "leftKnee", maxAngle: 105 * DEG },
  { bone: "leftLowerLeg", from: "leftKnee", to: "leftAnkle", maxAngle: 125 * DEG },
  { bone: "rightUpperLeg", from: "rightHip", to: "rightKnee", maxAngle: 105 * DEG },
  { bone: "rightLowerLeg", from: "rightKnee", to: "rightAnkle", maxAngle: 125 * DEG },
];

function trackerVector(value: Vec3, target: Vector3) {
  // Match the horizontally mirrored camera preview. Swapping bilateral joint
  // names preserves anatomical axes after reflecting tracker X into model X.
  return target.set(-value.x, -value.y, -value.z);
}

function tuple(value: Quaternion): QuaternionTuple {
  return [value.x, value.y, value.z, value.w];
}

export class SkeletonMapper {
  private readonly points = Array.from({ length: 8 }, () => new Vector3());
  private readonly xAxis = new Vector3();
  private readonly yAxis = new Vector3();
  private readonly zAxis = new Vector3();
  private readonly currentDirection = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly currentOrientation = new Quaternion();
  private readonly delta = new Quaternion();
  private readonly hipsDelta = new Quaternion();
  private readonly chestDelta = new Quaternion();
  private readonly relativeDelta = new Quaternion();
  private readonly blendedDelta = new Quaternion();
  private readonly limitedDelta = new Quaternion();
  private readonly limitSource = new Quaternion();
  private readonly inverse = new Quaternion();
  private readonly neutralDirections = new Map<SemanticBone, Vector3>();
  private readonly neutralOrientations = new Map<OrientationKey, Quaternion>();
  private readonly lastRotations: Partial<Record<SemanticBone, QuaternionTuple>> = {};
  private readonly lastRotationAt: Partial<Record<SemanticBone, number>> = {};

  constructor(private readonly calibration: CalibrationProfile) {
    const neutral = calibration.neutralPose;
    for (const segment of LIMB_SEGMENTS) this.captureDirection(neutral, segment.bone, segment.from, segment.to);
    if (this.readTorsoOrientation(neutral, "hips", this.currentOrientation)) this.captureOrientation("hips");
    if (this.readTorsoOrientation(neutral, "shoulders", this.currentOrientation)) this.captureOrientation("torso");
    if (this.readHeadOrientation(neutral, this.currentOrientation)) this.captureOrientation("head");
  }

  private readPoint(frame: PoseFrame, name: PoseJointName, target: Vector3) {
    const point = reliablePosePoint(frame, MIRRORED_JOINTS[name] ?? name);
    if (!point) return false;
    trackerVector(point, target);
    return Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z);
  }

  private makeOrientation(target: Quaternion) {
    if (this.xAxis.lengthSq() < 1e-8 || this.yAxis.lengthSq() < 1e-8) return false;
    this.xAxis.normalize();
    this.yAxis.addScaledVector(this.xAxis, -this.yAxis.dot(this.xAxis));
    if (this.yAxis.lengthSq() < 1e-8) return false;
    this.yAxis.normalize();
    this.zAxis.crossVectors(this.xAxis, this.yAxis);
    if (this.zAxis.lengthSq() < 1e-8) return false;
    this.zAxis.normalize();
    this.yAxis.crossVectors(this.zAxis, this.xAxis).normalize();
    this.matrix.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    target.setFromRotationMatrix(this.matrix).normalize();
    return Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z) && Number.isFinite(target.w);
  }

  private readDirection(frame: PoseFrame, from: PoseJointName, to: PoseJointName, target: Vector3) {
    if (!this.readPoint(frame, from, this.points[0]) || !this.readPoint(frame, to, this.points[1])) return false;
    target.subVectors(this.points[1], this.points[0]);
    if (target.lengthSq() < 1e-8) return false;
    target.normalize();
    return true;
  }

  private captureDirection(frame: PoseFrame, key: SemanticBone, from: PoseJointName, to: PoseJointName) {
    if (!this.readDirection(frame, from, to, this.currentDirection)) return false;
    this.neutralDirections.set(key, this.currentDirection.clone());
    return true;
  }

  private directionDelta(frame: PoseFrame, key: SemanticBone, from: PoseJointName, to: PoseJointName, target: Quaternion) {
    if (!this.readDirection(frame, from, to, this.currentDirection)) return false;
    const neutral = this.neutralDirections.get(key);
    if (!neutral) {
      this.neutralDirections.set(key, this.currentDirection.clone());
      return false;
    }
    target.setFromUnitVectors(neutral, this.currentDirection).normalize();
    return this.stabilize(target);
  }

  private readTorsoOrientation(frame: PoseFrame, across: "hips" | "shoulders", target: Quaternion) {
    if (
      !this.readPoint(frame, "leftShoulder", this.points[0]) ||
      !this.readPoint(frame, "rightShoulder", this.points[1]) ||
      !this.readPoint(frame, "leftHip", this.points[2]) ||
      !this.readPoint(frame, "rightHip", this.points[3])
    ) return false;
    this.points[4].addVectors(this.points[0], this.points[1]).multiplyScalar(0.5);
    this.points[5].addVectors(this.points[2], this.points[3]).multiplyScalar(0.5);
    this.xAxis.subVectors(
      across === "hips" ? this.points[2] : this.points[0],
      across === "hips" ? this.points[3] : this.points[1],
    );
    this.yAxis.subVectors(this.points[4], this.points[5]);
    return this.makeOrientation(target);
  }

  private readHeadOrientation(frame: PoseFrame, target: Quaternion) {
    if (
      !this.readPoint(frame, "leftEar", this.points[0]) ||
      !this.readPoint(frame, "rightEar", this.points[1]) ||
      !this.readPoint(frame, "nose", this.points[2]) ||
      !this.readPoint(frame, "mouthLeft", this.points[3]) ||
      !this.readPoint(frame, "mouthRight", this.points[4])
    ) return false;
    this.xAxis.subVectors(this.points[0], this.points[1]);
    this.points[5].addVectors(this.points[3], this.points[4]).multiplyScalar(0.5);
    this.yAxis.subVectors(this.points[2], this.points[5]);
    this.zAxis.crossVectors(this.xAxis, this.yAxis);
    this.points[6].addVectors(this.points[0], this.points[1]).multiplyScalar(0.5);
    this.points[2].sub(this.points[6]);
    if (this.zAxis.dot(this.points[2]) < 0) this.xAxis.negate();
    return this.makeOrientation(target);
  }

  private captureOrientation(key: OrientationKey) {
    this.neutralOrientations.set(key, this.currentOrientation.clone());
  }

  private orientationDelta(key: OrientationKey, current: Quaternion, target: Quaternion) {
    const neutral = this.neutralOrientations.get(key);
    if (!neutral) {
      this.neutralOrientations.set(key, current.clone());
      return false;
    }
    target.copy(current).multiply(this.inverse.copy(neutral).invert()).normalize();
    return this.stabilize(target);
  }

  private stabilize(value: Quaternion) {
    if (![value.x, value.y, value.z, value.w].every(Number.isFinite)) return false;
    if (value.w < 0) value.set(-value.x, -value.y, -value.z, -value.w);
    return true;
  }

  private limit(value: Quaternion, maxAngle: number, target: Quaternion) {
    this.limitSource.copy(value).normalize();
    target.copy(this.limitSource);
    if (target.w < 0) target.set(-target.x, -target.y, -target.z, -target.w);
    const angle = 2 * Math.acos(Math.min(1, Math.max(-1, target.w)));
    if (angle > maxAngle) target.copy(IDENTITY).slerp(this.limitSource, maxAngle / angle).normalize();
    return target;
  }

  private write(
    rotations: BonePose["rotations"],
    bone: SemanticBone,
    value: Quaternion,
    timestamp: number,
    maxAngle: number,
  ) {
    const result = this.limit(value, maxAngle, this.limitedDelta);
    const rotation = tuple(result);
    rotations[bone] = rotation;
    this.lastRotations[bone] = rotation;
    this.lastRotationAt[bone] = timestamp;
  }

  private mapLimb(rotations: BonePose["rotations"], frame: PoseFrame, segment: LimbSegment) {
    if (!this.directionDelta(frame, segment.bone, segment.from, segment.to, this.delta)) return;
    this.write(rotations, segment.bone, this.delta, frame.timestamp, segment.maxAngle);
  }

  private holdMissing(rotations: BonePose["rotations"], timestamp: number) {
    for (const bone of DIRECTLY_CONTROLLED_BONES) {
      if (rotations[bone]) continue;
      const last = this.lastRotations[bone];
      const seenAt = this.lastRotationAt[bone];
      if (last && seenAt !== undefined && timestamp - seenAt <= TRACKING_CONFIG.jointOcclusionHoldMs) rotations[bone] = last;
    }
  }

  map(frame: PoseFrame): BonePose {
    const rotations: BonePose["rotations"] = {};
    if (!frame.trackingActive) return { timestamp: frame.timestamp, rotations };

    let hasChest = false;
    if (this.readTorsoOrientation(frame, "hips", this.currentOrientation)) {
      if (this.orientationDelta("hips", this.currentOrientation, this.hipsDelta)) {
        this.write(rotations, "hips", this.hipsDelta, frame.timestamp, 70 * DEG);
      }
    }
    if (this.readTorsoOrientation(frame, "shoulders", this.currentOrientation)) {
      hasChest = this.orientationDelta("torso", this.currentOrientation, this.chestDelta);
    }
    if (hasChest) {
      // Driving only the base spine lets the remaining torso chain inherit one
      // coherent orientation across both the FV2.1 and Mixamo hierarchies.
      this.write(rotations, "spine", this.chestDelta, frame.timestamp, 65 * DEG);
    }

    for (const segment of LIMB_SEGMENTS) this.mapLimb(rotations, frame, segment);

    if (this.readHeadOrientation(frame, this.currentOrientation) && this.orientationDelta("head", this.currentOrientation, this.delta)) {
      const torso = hasChest ? this.chestDelta : IDENTITY;
      this.relativeDelta.copy(this.inverse.copy(torso).invert()).multiply(this.delta).normalize();
      this.limit(this.relativeDelta, 55 * DEG, this.relativeDelta);
      this.blendedDelta.copy(IDENTITY).slerp(this.relativeDelta, 0.35).premultiply(torso);
      this.write(rotations, "neck", this.blendedDelta, frame.timestamp, 65 * DEG);
      this.blendedDelta.copy(torso).multiply(this.relativeDelta);
      this.write(rotations, "head", this.blendedDelta, frame.timestamp, 80 * DEG);
    }

    this.holdMissing(rotations, frame.timestamp);
    return { timestamp: frame.timestamp, rotations };
  }
}
