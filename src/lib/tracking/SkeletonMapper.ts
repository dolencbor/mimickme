import { Matrix4, Quaternion, Vector3 } from "three";
import type { SemanticBone } from "@/config/boneMap";
import type { CalibrationProfile } from "./calibration";
import { posePoint } from "./calibration";
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

  constructor(private readonly calibration: CalibrationProfile) {
    this.readTorsoOrientation(calibration.neutralPose, this.neutralTorso);
    this.inverseNeutralTorso.copy(this.neutralTorso).invert();
  }

  private readDirection(frame: PoseFrame, fromName: PoseJointName, toName: PoseJointName, target: Vector3) {
    const from = posePoint(frame, fromName);
    const to = posePoint(frame, toName);
    if (!from || !to) return false;
    trackerVector(from, this.from);
    trackerVector(to, this.to);
    target.subVectors(this.to, this.from);
    if (target.lengthSq() < 1e-8) return false;
    target.normalize();
    return true;
  }

  private readTorsoOrientation(frame: PoseFrame, target: Quaternion) {
    const leftShoulder = posePoint(frame, "leftShoulder");
    const rightShoulder = posePoint(frame, "rightShoulder");
    const leftHip = posePoint(frame, "leftHip");
    const rightHip = posePoint(frame, "rightHip");
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
      this.quaternion.copy(this.currentTorso).multiply(this.inverseNeutralTorso).normalize();
      rotations.hips = this.quaternion.toArray();
    }

    for (const segment of SEGMENTS) {
      if (!this.readDirection(this.calibration.neutralPose, segment.from, segment.to, this.neutralDirection)) continue;
      if (!this.readDirection(frame, segment.from, segment.to, this.currentDirection)) continue;
      this.quaternion.setFromUnitVectors(this.neutralDirection, this.currentDirection).normalize();
      rotations[segment.bone] = this.quaternion.toArray();
    }

    return { timestamp: frame.timestamp, rotations };
  }
}
