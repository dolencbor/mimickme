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

const SEGMENTS: readonly Segment[] = [
  { bone: "leftUpperArm", from: "leftShoulder", to: "leftElbow" },
  { bone: "leftForearm", from: "leftElbow", to: "leftWrist" },
  { bone: "rightUpperArm", from: "rightShoulder", to: "rightElbow" },
  { bone: "rightForearm", from: "rightElbow", to: "rightWrist" },
  { bone: "leftUpperLeg", from: "leftHip", to: "leftKnee" },
  { bone: "leftLowerLeg", from: "leftKnee", to: "leftAnkle" },
  { bone: "rightUpperLeg", from: "rightHip", to: "rightKnee" },
  { bone: "rightLowerLeg", from: "rightKnee", to: "rightAnkle" },
  { bone: "head", from: "leftShoulder", to: "nose" },
];

function trackerVector(value: Vec3, target: Vector3) {
  return target.set(value.x, -value.y, -value.z);
}

export class SkeletonMapper {
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly neutralDirection = new Vector3();
  private readonly currentDirection = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly matrix = new Matrix4();
  private readonly shoulderCenter = new Vector3();
  private readonly hipCenter = new Vector3();
  private readonly xAxis = new Vector3();
  private readonly yAxis = new Vector3();
  private readonly zAxis = new Vector3();
  private readonly neutralTorso = new Quaternion();
  private readonly inverseNeutralTorso = new Quaternion();
  private readonly currentTorso = new Quaternion();
  private readonly neutralDirections = new Map<SemanticBone, Vector3>();
  private hasNeutralTorso = false;

  constructor(private readonly calibration: CalibrationProfile) {
    this.hasNeutralTorso = this.readTorsoOrientation(calibration.neutralPose, this.neutralTorso);
    if (this.hasNeutralTorso) this.inverseNeutralTorso.copy(this.neutralTorso).invert();
    for (const segment of SEGMENTS) {
      const direction = new Vector3();
      if (this.readDirection(calibration.neutralPose, segment.from, segment.to, direction)) {
        this.neutralDirections.set(segment.bone, direction);
      }
    }
  }

  private readDirection(frame: PoseFrame, fromName: PoseJointName, toName: PoseJointName, target: Vector3) {
    const from = reliablePosePoint(frame, fromName);
    const to = reliablePosePoint(frame, toName);
    if (!from || !to) return false;
    trackerVector(from, this.from);
    trackerVector(to, this.to);
    target.subVectors(this.to, this.from);
    if (target.lengthSq() < 1e-8) return false;
    target.normalize();
    return true;
  }

  private readTorsoOrientation(frame: PoseFrame, target: Quaternion) {
    const leftShoulder = reliablePosePoint(frame, "leftShoulder");
    const rightShoulder = reliablePosePoint(frame, "rightShoulder");
    const leftHip = reliablePosePoint(frame, "leftHip");
    const rightHip = reliablePosePoint(frame, "rightHip");
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return false;

    trackerVector(leftShoulder, this.from);
    trackerVector(rightShoulder, this.to);
    this.xAxis.subVectors(this.from, this.to).normalize();
    this.shoulderCenter.addVectors(this.from, this.to).multiplyScalar(0.5);
    trackerVector(leftHip, this.from);
    trackerVector(rightHip, this.to);
    this.hipCenter.addVectors(this.from, this.to).multiplyScalar(0.5);
    this.yAxis.subVectors(this.shoulderCenter, this.hipCenter).normalize();
    this.zAxis.crossVectors(this.xAxis, this.yAxis).normalize();
    this.yAxis.crossVectors(this.zAxis, this.xAxis).normalize();
    this.matrix.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    target.setFromRotationMatrix(this.matrix).normalize();
    return true;
  }

  map(frame: PoseFrame): BonePose {
    const rotations: BonePose["rotations"] = {};
    if (!frame.trackingActive) return { timestamp: frame.timestamp, rotations };

    if (this.readTorsoOrientation(frame, this.currentTorso)) {
      if (this.hasNeutralTorso) {
        this.quaternion.copy(this.currentTorso).multiply(this.inverseNeutralTorso).normalize();
        rotations.hips = this.quaternion.toArray();
      } else {
        this.neutralTorso.copy(this.currentTorso);
        this.inverseNeutralTorso.copy(this.neutralTorso).invert();
        this.hasNeutralTorso = true;
      }
    }

    for (const segment of SEGMENTS) {
      if (!this.readDirection(frame, segment.from, segment.to, this.currentDirection)) continue;
      const neutral = this.neutralDirections.get(segment.bone);
      if (!neutral) {
        this.neutralDirections.set(segment.bone, this.currentDirection.clone());
        continue;
      }
      this.neutralDirection.copy(neutral);
      this.quaternion.setFromUnitVectors(this.neutralDirection, this.currentDirection).normalize();
      rotations[segment.bone] = this.quaternion.toArray();
    }

    return { timestamp: frame.timestamp, rotations };
  }
}
