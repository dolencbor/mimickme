import type { BonePose, QuaternionTuple } from "./SkeletonMapper";
import type { SemanticBone } from "@/config/boneMap";

export type RootPosition = [number, number, number];

export type SkeletalFrame = {
  timestamp: number;
  trackingActive: boolean;
  rootPosition: RootPosition;
  rotations: Partial<Record<SemanticBone, QuaternionTuple>>;
};

export const EMPTY_SKELETAL_FRAME: SkeletalFrame = {
  timestamp: 0,
  trackingActive: false,
  rootPosition: [0, 0, 0],
  rotations: {},
};

export function skeletalFrameFromBonePose(bonePose: BonePose, trackingActive: boolean, rootPosition: RootPosition): SkeletalFrame {
  return { timestamp: bonePose.timestamp, trackingActive, rootPosition, rotations: bonePose.rotations };
}
