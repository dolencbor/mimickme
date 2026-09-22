export const SEMANTIC_BONES = [
  "hips",
  "spine",
  "chest",
  "neck",
  "head",
  "leftUpperArm",
  "leftForearm",
  "leftHand",
  "rightUpperArm",
  "rightForearm",
  "rightHand",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
] as const;

export type SemanticBone = (typeof SEMANTIC_BONES)[number];

export const BONE_ALIASES: Record<SemanticBone, readonly string[]> = {
  hips: ["Hips", "Pelvis", "Root", "mixamorigHips"],
  spine: ["Spine", "Spine1", "mixamorigSpine"],
  chest: ["Chest", "UpperChest", "Spine2", "mixamorigSpine1", "mixamorigSpine2"],
  neck: ["Neck", "mixamorigNeck"],
  head: ["Head", "mixamorigHead"],
  leftUpperArm: ["Left_Arm", "LeftArm", "LeftUpperArm", "mixamorigLeftArm"],
  leftForearm: ["Left_ForeArm", "LeftForeArm", "LeftLowerArm", "mixamorigLeftForeArm"],
  leftHand: ["Left_Hand", "LeftHand", "mixamorigLeftHand"],
  rightUpperArm: ["Right_Arm", "RightArm", "RightUpperArm", "mixamorigRightArm"],
  rightForearm: ["Right_ForeArm", "RightForeArm", "RightLowerArm", "mixamorigRightForeArm"],
  rightHand: ["Right_Hand", "RightHand", "mixamorigRightHand"],
  leftUpperLeg: ["Left_UpperLeg", "LeftUpLeg", "LeftThigh", "mixamorigLeftUpLeg"],
  leftLowerLeg: ["Left_LowerLeg", "LeftLeg", "LeftShin", "mixamorigLeftLeg"],
  leftFoot: ["Left_Foot", "LeftFoot", "mixamorigLeftFoot"],
  rightUpperLeg: ["Right_UpperLeg", "RightUpLeg", "RightThigh", "mixamorigRightUpLeg"],
  rightLowerLeg: ["Right_LowerLeg", "RightLeg", "RightShin", "mixamorigRightLeg"],
  rightFoot: ["Right_Foot", "RightFoot", "mixamorigRightFoot"],
};

// Add exact GLB bone names here when auto-detection reports an unresolved bone.
export const MANUAL_BONE_MAP: Partial<Record<SemanticBone, string>> = {};

export const REQUIRED_MOTION_BONES: readonly SemanticBone[] = [
  "hips",
  "leftUpperArm",
  "leftForearm",
  "rightUpperArm",
  "rightForearm",
  "leftUpperLeg",
  "leftLowerLeg",
  "rightUpperLeg",
  "rightLowerLeg",
];
