import { Matrix4, Quaternion, Vector3 } from "three";
import { SEMANTIC_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import type { CalibrationProfile } from "./calibration";
import { reliablePosePoint } from "./poseReliability";
import type { PoseFrame, PoseJointName, Vec3 } from "./types";

export type QuaternionTuple = [number, number, number, number];

export type BonePose = {
  timestamp: number;
  rotations: Partial<Record<SemanticBone, QuaternionTuple>>;
};

type Side = "left" | "right";
type OrientationKey = "hips" | "chest" | "head" | "leftHand" | "rightHand" | "leftFoot" | "rightFoot";
type LimbChain = {
  key: SemanticBone;
  from: PoseJointName;
  to: PoseJointName;
  base: SemanticBone;
  middle?: SemanticBone;
  baseFraction?: number;
  maxAngle: number;
};

const DEG = Math.PI / 180;
const IDENTITY = new Quaternion();
const LEFT_EYES: readonly PoseJointName[] = ["leftEyeInner", "leftEye", "leftEyeOuter"];
const RIGHT_EYES: readonly PoseJointName[] = ["rightEyeInner", "rightEye", "rightEyeOuter"];

const LIMB_CHAINS: readonly LimbChain[] = [
  { key: "leftUpperArm", from: "leftShoulder", to: "leftElbow", base: "leftUpperArm", middle: "leftUpperArmMiddle", baseFraction: 0.62, maxAngle: 150 * DEG },
  { key: "leftForearm", from: "leftElbow", to: "leftWrist", base: "leftForearm", middle: "leftForearmMiddle", baseFraction: 0.72, maxAngle: 145 * DEG },
  { key: "rightUpperArm", from: "rightShoulder", to: "rightElbow", base: "rightUpperArm", middle: "rightUpperArmMiddle", baseFraction: 0.62, maxAngle: 150 * DEG },
  { key: "rightForearm", from: "rightElbow", to: "rightWrist", base: "rightForearm", middle: "rightForearmMiddle", baseFraction: 0.72, maxAngle: 145 * DEG },
  { key: "leftUpperLeg", from: "leftHip", to: "leftKnee", base: "leftUpperLeg", middle: "leftUpperLegMiddle", baseFraction: 0.72, maxAngle: 125 * DEG },
  { key: "leftLowerLeg", from: "leftKnee", to: "leftAnkle", base: "leftLowerLeg", maxAngle: 145 * DEG },
  { key: "rightUpperLeg", from: "rightHip", to: "rightKnee", base: "rightUpperLeg", middle: "rightUpperLegMiddle", baseFraction: 0.72, maxAngle: 125 * DEG },
  { key: "rightLowerLeg", from: "rightKnee", to: "rightAnkle", base: "rightLowerLeg", maxAngle: 145 * DEG },
];

function trackerVector(value: Vec3, target: Vector3) {
  return target.set(value.x, -value.y, -value.z);
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
    for (const chain of LIMB_CHAINS) this.captureDirection(neutral, chain.key, chain.from, chain.to);
    this.captureShoulder(neutral, "left");
    this.captureShoulder(neutral, "right");
    if (this.readTorsoOrientation(neutral, "hips", this.currentOrientation)) this.captureOrientation("hips");
    if (this.readTorsoOrientation(neutral, "shoulders", this.currentOrientation)) this.captureOrientation("chest");
    if (this.readHeadOrientation(neutral, this.currentOrientation)) this.captureOrientation("head");
    if (this.readHandOrientation(neutral, "left", this.currentOrientation)) this.captureOrientation("leftHand");
    if (this.readHandOrientation(neutral, "right", this.currentOrientation)) this.captureOrientation("rightHand");
    if (this.readFootOrientation(neutral, "left", this.currentOrientation)) this.captureOrientation("leftFoot");
    if (this.readFootOrientation(neutral, "right", this.currentOrientation)) this.captureOrientation("rightFoot");
  }

  private readPoint(frame: PoseFrame, name: PoseJointName, target: Vector3) {
    const point = reliablePosePoint(frame, name);
    if (!point) return false;
    trackerVector(point, target);
    return Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z);
  }

  private readAverage(frame: PoseFrame, names: readonly PoseJointName[], target: Vector3) {
    target.set(0, 0, 0);
    let count = 0;
    for (const name of names) {
      const point = reliablePosePoint(frame, name);
      if (!point) continue;
      trackerVector(point, this.points[7]);
      target.add(this.points[7]);
      count += 1;
    }
    if (count === 0) return false;
    target.multiplyScalar(1 / count);
    return true;
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

  private readShoulderDirection(frame: PoseFrame, side: Side, target: Vector3) {
    if (!this.readPoint(frame, "leftShoulder", this.points[0]) || !this.readPoint(frame, "rightShoulder", this.points[1])) return false;
    this.points[2].addVectors(this.points[0], this.points[1]).multiplyScalar(0.5);
    target.subVectors(side === "left" ? this.points[0] : this.points[1], this.points[2]);
    if (target.lengthSq() < 1e-8) return false;
    target.normalize();
    return true;
  }

  private captureShoulder(frame: PoseFrame, side: Side) {
    const key: SemanticBone = side === "left" ? "leftShoulder" : "rightShoulder";
    if (!this.readShoulderDirection(frame, side, this.currentDirection)) return false;
    this.neutralDirections.set(key, this.currentDirection.clone());
    return true;
  }

  private shoulderDelta(frame: PoseFrame, side: Side, target: Quaternion) {
    const key: SemanticBone = side === "left" ? "leftShoulder" : "rightShoulder";
    if (!this.readShoulderDirection(frame, side, this.currentDirection)) return false;
    const neutral = this.neutralDirections.get(key);
    if (!neutral) {
      this.neutralDirections.set(key, this.currentDirection.clone());
      return false;
    }
    target.setFromUnitVectors(neutral, this.currentDirection).normalize();
    return this.stabilize(target);
  }

  private readHeadOrientation(frame: PoseFrame, target: Quaternion) {
    if (
      !this.readPoint(frame, "leftEar", this.points[0]) ||
      !this.readPoint(frame, "rightEar", this.points[1]) ||
      !this.readAverage(frame, LEFT_EYES, this.points[2]) ||
      !this.readAverage(frame, RIGHT_EYES, this.points[3]) ||
      !this.readPoint(frame, "mouthLeft", this.points[4]) ||
      !this.readPoint(frame, "mouthRight", this.points[5])
    ) return false;
    this.xAxis.subVectors(this.points[0], this.points[1]);
    this.points[2].add(this.points[3]).multiplyScalar(0.5);
    this.points[4].add(this.points[5]).multiplyScalar(0.5);
    this.yAxis.subVectors(this.points[2], this.points[4]);
    if (this.readPoint(frame, "nose", this.points[6])) {
      this.points[5].addVectors(this.points[2], this.points[4]).multiplyScalar(0.5);
      this.zAxis.crossVectors(this.xAxis, this.yAxis);
      this.points[6].sub(this.points[5]);
      if (this.zAxis.dot(this.points[6]) < 0) this.xAxis.negate();
    }
    return this.makeOrientation(target);
  }

  private readHandOrientation(frame: PoseFrame, side: Side, target: Quaternion) {
    const wrist = `${side}Wrist` as PoseJointName;
    const index = `${side}Index` as PoseJointName;
    const pinky = `${side}Pinky` as PoseJointName;
    const thumb = `${side}Thumb` as PoseJointName;
    if (!this.readPoint(frame, wrist, this.points[0]) || !this.readPoint(frame, index, this.points[1]) || !this.readPoint(frame, pinky, this.points[2])) return false;
    if (!this.readPoint(frame, thumb, this.points[3])) this.points[3].addVectors(this.points[1], this.points[2]).multiplyScalar(0.5);
    this.points[4].copy(this.points[1]).add(this.points[2]).add(this.points[3]).multiplyScalar(1 / 3);
    this.xAxis.subVectors(this.points[1], this.points[2]);
    this.yAxis.subVectors(this.points[4], this.points[0]);
    return this.makeOrientation(target);
  }

  private readFootOrientation(frame: PoseFrame, side: Side, target: Quaternion) {
    const ankle = `${side}Ankle` as PoseJointName;
    const heel = `${side}Heel` as PoseJointName;
    const toe = `${side}FootIndex` as PoseJointName;
    if (!this.readPoint(frame, ankle, this.points[0]) || !this.readPoint(frame, heel, this.points[1]) || !this.readPoint(frame, toe, this.points[2])) return false;
    this.points[3].subVectors(this.points[2], this.points[1]);
    this.points[4].subVectors(this.points[0], this.points[1]);
    this.xAxis.crossVectors(this.points[4], this.points[3]);
    this.yAxis.copy(this.points[4]);
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
    fraction = 1,
  ) {
    this.limitedDelta.copy(value);
    this.blendedDelta.copy(IDENTITY).slerp(this.limitedDelta, fraction).normalize();
    const result = this.limit(this.blendedDelta, maxAngle, this.limitedDelta);
    const rotation = tuple(result);
    rotations[bone] = rotation;
    this.lastRotations[bone] = rotation;
    this.lastRotationAt[bone] = timestamp;
  }

  private mapLimb(rotations: BonePose["rotations"], frame: PoseFrame, chain: LimbChain) {
    if (!this.directionDelta(frame, chain.key, chain.from, chain.to, this.delta)) return;
    this.write(rotations, chain.base, this.delta, frame.timestamp, chain.maxAngle, chain.baseFraction ?? 1);
    if (chain.middle) this.write(rotations, chain.middle, this.delta, frame.timestamp, chain.maxAngle);
  }

  private holdMissing(rotations: BonePose["rotations"], timestamp: number) {
    for (const bone of SEMANTIC_BONES) {
      if (rotations[bone]) continue;
      const last = this.lastRotations[bone];
      const seenAt = this.lastRotationAt[bone];
      if (last && seenAt !== undefined && timestamp - seenAt <= TRACKING_CONFIG.jointOcclusionHoldMs) rotations[bone] = last;
    }
  }

  map(frame: PoseFrame): BonePose {
    const rotations: BonePose["rotations"] = {};
    if (!frame.trackingActive) return { timestamp: frame.timestamp, rotations };

    let hasHips = false;
    let hasChest = false;
    if (this.readTorsoOrientation(frame, "hips", this.currentOrientation)) {
      hasHips = this.orientationDelta("hips", this.currentOrientation, this.hipsDelta);
      if (hasHips) this.write(rotations, "hips", this.hipsDelta, frame.timestamp, 115 * DEG);
    }
    if (this.readTorsoOrientation(frame, "shoulders", this.currentOrientation)) {
      hasChest = this.orientationDelta("chest", this.currentOrientation, this.chestDelta);
    }
    if (hasChest) {
      const lower = hasHips ? this.hipsDelta : IDENTITY;
      this.blendedDelta.slerpQuaternions(lower, this.chestDelta, 0.25);
      this.write(rotations, "spine", this.blendedDelta, frame.timestamp, 110 * DEG);
      this.blendedDelta.slerpQuaternions(lower, this.chestDelta, 0.5);
      this.write(rotations, "spineMiddle", this.blendedDelta, frame.timestamp, 110 * DEG);
      this.blendedDelta.slerpQuaternions(lower, this.chestDelta, 0.75);
      this.write(rotations, "spineUpper", this.blendedDelta, frame.timestamp, 110 * DEG);
      this.write(rotations, "chest", this.chestDelta, frame.timestamp, 115 * DEG);
    }

    if (this.shoulderDelta(frame, "left", this.delta)) this.write(rotations, "leftShoulder", this.delta, frame.timestamp, 55 * DEG);
    if (this.shoulderDelta(frame, "right", this.delta)) this.write(rotations, "rightShoulder", this.delta, frame.timestamp, 55 * DEG);
    for (const chain of LIMB_CHAINS) this.mapLimb(rotations, frame, chain);

    if (this.readHeadOrientation(frame, this.currentOrientation) && this.orientationDelta("head", this.currentOrientation, this.delta)) {
      const torso = hasChest ? this.chestDelta : IDENTITY;
      this.relativeDelta.copy(this.inverse.copy(torso).invert()).multiply(this.delta).normalize();
      this.limit(this.relativeDelta, 70 * DEG, this.relativeDelta);
      this.blendedDelta.copy(IDENTITY).slerp(this.relativeDelta, 0.3).premultiply(torso);
      this.write(rotations, "neck", this.blendedDelta, frame.timestamp, 150 * DEG);
      this.blendedDelta.copy(IDENTITY).slerp(this.relativeDelta, 0.62).premultiply(torso);
      this.write(rotations, "neckUpper", this.blendedDelta, frame.timestamp, 150 * DEG);
      this.blendedDelta.copy(torso).multiply(this.relativeDelta);
      this.write(rotations, "head", this.blendedDelta, frame.timestamp, 160 * DEG);
    }

    if (this.readHandOrientation(frame, "left", this.currentOrientation) && this.orientationDelta("leftHand", this.currentOrientation, this.delta)) {
      this.write(rotations, "leftHand", this.delta, frame.timestamp, 85 * DEG);
    }
    if (this.readHandOrientation(frame, "right", this.currentOrientation) && this.orientationDelta("rightHand", this.currentOrientation, this.delta)) {
      this.write(rotations, "rightHand", this.delta, frame.timestamp, 85 * DEG);
    }
    if (this.readFootOrientation(frame, "left", this.currentOrientation) && this.orientationDelta("leftFoot", this.currentOrientation, this.delta)) {
      this.write(rotations, "leftFoot", this.delta, frame.timestamp, 65 * DEG);
    }
    if (this.readFootOrientation(frame, "right", this.currentOrientation) && this.orientationDelta("rightFoot", this.currentOrientation, this.delta)) {
      this.write(rotations, "rightFoot", this.delta, frame.timestamp, 65 * DEG);
    }

    this.holdMissing(rotations, frame.timestamp);
    return { timestamp: frame.timestamp, rotations };
  }
}
