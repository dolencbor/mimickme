import { Matrix4, Quaternion, Vector3 } from "three";
import type { SemanticBone } from "@/config/boneMap";
import type { CalibrationProfile } from "./calibration";
import { reliablePosePoint } from "./poseReliability";
import type { PoseFrame, PoseJointName, Vec3 } from "./types";

export type QuaternionTuple = [number, number, number, number];

export type BonePose = {
  timestamp: number;
  rotations: Partial<Record<SemanticBone, QuaternionTuple>>;
};

type Segment = { bone: SemanticBone; from: PoseJointName; to: PoseJointName };
type Side = "left" | "right";

const LIMB_SEGMENTS: readonly Segment[] = [
  { bone: "leftUpperArm", from: "leftShoulder", to: "leftElbow" },
  { bone: "leftForearm", from: "leftElbow", to: "leftWrist" },
  { bone: "rightUpperArm", from: "rightShoulder", to: "rightElbow" },
  { bone: "rightForearm", from: "rightElbow", to: "rightWrist" },
  { bone: "leftUpperLeg", from: "leftHip", to: "leftKnee" },
  { bone: "leftLowerLeg", from: "leftKnee", to: "leftAnkle" },
  { bone: "rightUpperLeg", from: "rightHip", to: "rightKnee" },
  { bone: "rightLowerLeg", from: "rightKnee", to: "rightAnkle" },
];

const LEFT_EYES: readonly PoseJointName[] = ["leftEyeInner", "leftEye", "leftEyeOuter"];
const RIGHT_EYES: readonly PoseJointName[] = ["rightEyeInner", "rightEye", "rightEyeOuter"];

function trackerVector(value: Vec3, target: Vector3) {
  return target.set(value.x, -value.y, -value.z);
}

function tuple(value: Quaternion): QuaternionTuple {
  return [value.x, value.y, value.z, value.w];
}

export class SkeletonMapper {
  private readonly points = Array.from({ length: 8 }, () => new Vector3());
  private readonly neutralDirection = new Vector3();
  private readonly currentDirection = new Vector3();
  private readonly xAxis = new Vector3();
  private readonly yAxis = new Vector3();
  private readonly zAxis = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly delta = new Quaternion();
  private readonly partialDelta = new Quaternion();
  private readonly currentOrientation = new Quaternion();

  private readonly neutralHips = new Quaternion();
  private readonly inverseNeutralHips = new Quaternion();
  private readonly neutralChest = new Quaternion();
  private readonly inverseNeutralChest = new Quaternion();
  private readonly neutralHead = new Quaternion();
  private readonly inverseNeutralHead = new Quaternion();
  private readonly neutralLeftHand = new Quaternion();
  private readonly inverseNeutralLeftHand = new Quaternion();
  private readonly neutralRightHand = new Quaternion();
  private readonly inverseNeutralRightHand = new Quaternion();
  private readonly neutralLeftFoot = new Quaternion();
  private readonly inverseNeutralLeftFoot = new Quaternion();
  private readonly neutralRightFoot = new Quaternion();
  private readonly inverseNeutralRightFoot = new Quaternion();

  private readonly hasNeutralHips: boolean;
  private readonly hasNeutralChest: boolean;
  private readonly hasNeutralHead: boolean;
  private readonly hasNeutralLeftHand: boolean;
  private readonly hasNeutralRightHand: boolean;
  private readonly hasNeutralLeftFoot: boolean;
  private readonly hasNeutralRightFoot: boolean;

  constructor(private readonly calibration: CalibrationProfile) {
    const neutral = calibration.neutralPose;
    this.hasNeutralHips = this.readTorsoOrientation(neutral, "hips", this.neutralHips);
    this.hasNeutralChest = this.readTorsoOrientation(neutral, "shoulders", this.neutralChest);
    this.hasNeutralHead = this.readHeadOrientation(neutral, this.neutralHead);
    this.hasNeutralLeftHand = this.readHandOrientation(neutral, "left", this.neutralLeftHand);
    this.hasNeutralRightHand = this.readHandOrientation(neutral, "right", this.neutralRightHand);
    this.hasNeutralLeftFoot = this.readFootOrientation(neutral, "left", this.neutralLeftFoot);
    this.hasNeutralRightFoot = this.readFootOrientation(neutral, "right", this.neutralRightFoot);

    this.inverseNeutralHips.copy(this.neutralHips).invert();
    this.inverseNeutralChest.copy(this.neutralChest).invert();
    this.inverseNeutralHead.copy(this.neutralHead).invert();
    this.inverseNeutralLeftHand.copy(this.neutralLeftHand).invert();
    this.inverseNeutralRightHand.copy(this.neutralRightHand).invert();
    this.inverseNeutralLeftFoot.copy(this.neutralLeftFoot).invert();
    this.inverseNeutralRightFoot.copy(this.neutralRightFoot).invert();
  }

  private readPoint(frame: PoseFrame, name: PoseJointName, target: Vector3) {
    const point = reliablePosePoint(frame, name);
    if (!point) return false;
    trackerVector(point, target);
    return true;
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
    return true;
  }

  private readDirection(frame: PoseFrame, fromName: PoseJointName, toName: PoseJointName, target: Vector3) {
    if (!this.readPoint(frame, fromName, this.points[0]) || !this.readPoint(frame, toName, this.points[1])) return false;
    target.subVectors(this.points[1], this.points[0]);
    if (target.lengthSq() < 1e-8) return false;
    target.normalize();
    return true;
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
    if (!this.readPoint(frame, "leftShoulder", this.points[0]) || !this.readPoint(frame, "rightShoulder", this.points[1])) {
      return false;
    }
    this.points[2].addVectors(this.points[0], this.points[1]).multiplyScalar(0.5);
    target.subVectors(side === "left" ? this.points[0] : this.points[1], this.points[2]);
    if (target.lengthSq() < 1e-8) return false;
    target.normalize();
    return true;
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

    // The nose resolves which side of the face plane points forward, reducing
    // sudden 180-degree flips when the head turns toward profile.
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
    if (
      !this.readPoint(frame, wrist, this.points[0]) ||
      !this.readPoint(frame, index, this.points[1]) ||
      !this.readPoint(frame, pinky, this.points[2])
    ) return false;

    if (!this.readPoint(frame, thumb, this.points[3])) {
      this.points[3].addVectors(this.points[1], this.points[2]).multiplyScalar(0.5);
    }
    this.points[4].copy(this.points[1]).add(this.points[2]).add(this.points[3]).multiplyScalar(1 / 3);
    this.xAxis.subVectors(this.points[1], this.points[2]);
    this.yAxis.subVectors(this.points[4], this.points[0]);
    return this.makeOrientation(target);
  }

  private readFootOrientation(frame: PoseFrame, side: Side, target: Quaternion) {
    const ankle = `${side}Ankle` as PoseJointName;
    const heel = `${side}Heel` as PoseJointName;
    const toe = `${side}FootIndex` as PoseJointName;
    if (
      !this.readPoint(frame, ankle, this.points[0]) ||
      !this.readPoint(frame, heel, this.points[1]) ||
      !this.readPoint(frame, toe, this.points[2])
    ) return false;

    this.points[3].subVectors(this.points[2], this.points[1]);
    this.points[4].subVectors(this.points[0], this.points[1]);
    this.xAxis.crossVectors(this.points[4], this.points[3]);
    this.yAxis.copy(this.points[4]);
    return this.makeOrientation(target);
  }

  private writeOrientationDelta(
    rotations: BonePose["rotations"],
    bone: SemanticBone,
    current: Quaternion,
    inverseNeutral: Quaternion,
    fraction = 1,
  ) {
    this.delta.copy(current).multiply(inverseNeutral).normalize();
    const result = fraction === 1
      ? this.delta
      : this.partialDelta.identity().slerp(this.delta, fraction).normalize();
    rotations[bone] = tuple(result);
  }

  private mapDirection(rotations: BonePose["rotations"], frame: PoseFrame, segment: Segment) {
    if (!this.readDirection(this.calibration.neutralPose, segment.from, segment.to, this.neutralDirection)) return;
    if (!this.readDirection(frame, segment.from, segment.to, this.currentDirection)) return;
    this.delta.setFromUnitVectors(this.neutralDirection, this.currentDirection).normalize();
    rotations[segment.bone] = tuple(this.delta);
  }

  private mapShoulder(rotations: BonePose["rotations"], frame: PoseFrame, side: Side) {
    if (!this.readShoulderDirection(this.calibration.neutralPose, side, this.neutralDirection)) return;
    if (!this.readShoulderDirection(frame, side, this.currentDirection)) return;
    this.delta.setFromUnitVectors(this.neutralDirection, this.currentDirection).normalize();
    rotations[side === "left" ? "leftShoulder" : "rightShoulder"] = tuple(this.delta);
  }

  map(frame: PoseFrame): BonePose {
    const rotations: BonePose["rotations"] = {};
    if (!frame.trackingActive) return { timestamp: frame.timestamp, rotations };

    if (this.hasNeutralHips && this.readTorsoOrientation(frame, "hips", this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "hips", this.currentOrientation, this.inverseNeutralHips);
    }
    if (this.hasNeutralChest && this.readTorsoOrientation(frame, "shoulders", this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "spine", this.currentOrientation, this.inverseNeutralChest, 0.45);
      this.writeOrientationDelta(rotations, "chest", this.currentOrientation, this.inverseNeutralChest);
    }

    this.mapShoulder(rotations, frame, "left");
    this.mapShoulder(rotations, frame, "right");
    for (const segment of LIMB_SEGMENTS) this.mapDirection(rotations, frame, segment);

    if (this.hasNeutralHead && this.readHeadOrientation(frame, this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "neck", this.currentOrientation, this.inverseNeutralHead, 0.35);
      this.writeOrientationDelta(rotations, "head", this.currentOrientation, this.inverseNeutralHead);
    } else {
      this.mapDirection(rotations, frame, { bone: "head", from: "leftShoulder", to: "nose" });
    }

    if (this.hasNeutralLeftHand && this.readHandOrientation(frame, "left", this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "leftHand", this.currentOrientation, this.inverseNeutralLeftHand);
    }
    if (this.hasNeutralRightHand && this.readHandOrientation(frame, "right", this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "rightHand", this.currentOrientation, this.inverseNeutralRightHand);
    }
    if (this.hasNeutralLeftFoot && this.readFootOrientation(frame, "left", this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "leftFoot", this.currentOrientation, this.inverseNeutralLeftFoot);
    }
    if (this.hasNeutralRightFoot && this.readFootOrientation(frame, "right", this.currentOrientation)) {
      this.writeOrientationDelta(rotations, "rightFoot", this.currentOrientation, this.inverseNeutralRightFoot);
    }

    return { timestamp: frame.timestamp, rotations };
  }
}
