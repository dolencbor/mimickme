import { Bone, Vector3 } from "three";

export type CapsuleCollider = {
  start: Vector3;
  end: Vector3;
  radius: number;
};

const COLLIDER_BONES = new Map<string, number>([
  ["Head", 0.105],
  ["Spine2", 0.14],
  ["Spine3", 0.15],
  ["Pelvis", 0.15],
  ["Left_Arm", 0.065],
  ["Right_Arm", 0.065],
  ["Left_ForeArm", 0.052],
  ["Right_ForeArm", 0.052],
  ["Left_thigh", 0.085],
  ["Right_thigh", 0.085],
  ["Left_shin", 0.065],
  ["Right_shin", 0.065],
]);

export function createBodyColliders(bones: readonly Bone[]) {
  const colliders: CapsuleCollider[] = [];
  for (const bone of bones) {
    const radius = COLLIDER_BONES.get(bone.name);
    if (!radius) continue;
    colliders.push({ start: new Vector3(), end: new Vector3(), radius });
  }
  return colliders;
}

export function updateBodyColliders(bones: readonly Bone[], colliders: CapsuleCollider[]) {
  let colliderIndex = 0;
  for (const bone of bones) {
    const radius = COLLIDER_BONES.get(bone.name);
    if (!radius) continue;
    const collider = colliders[colliderIndex++];
    bone.getWorldPosition(collider.start);
    const child = bone.children.find((candidate): candidate is Bone => candidate instanceof Bone);
    if (child) child.getWorldPosition(collider.end);
    else collider.end.copy(collider.start);
    collider.radius = radius;
  }
}
