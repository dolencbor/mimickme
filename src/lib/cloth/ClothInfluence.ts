import type { SkinnedMesh } from "three";

const STRUCTURAL_BONE = /(pelvis|spine|chest|neck|shoulder|pectoral)/i;
const DISTAL_ARM_BONE = /(forearm|hand)/i;

/**
 * Derives attachment from the preserved skinning plus garment position. A value
 * of one follows the skinned target closely; zero is free cloth. This is kept as
 * a standalone typed array so debug rendering can expose it without recomputing.
 */
export function deriveClothAttachment(mesh: SkinnedMesh) {
  const position = mesh.geometry.getAttribute("position");
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  const result = new Float32Array(position.count);
  let minimumY = Infinity;
  let maximumY = -Infinity;

  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }

  const height = Math.max(1e-6, maximumY - minimumY);
  const isSkirt = /skirt/i.test(mesh.name);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    let structuralWeight = 0;
    let distalArmWeight = 0;
    for (let influence = 0; influence < 4; influence += 1) {
      const weight = skinWeight.getComponent(vertex, influence);
      const boneIndex = skinIndex.getComponent(vertex, influence);
      const boneName = mesh.skeleton.bones[boneIndex]?.name ?? "";
      if (STRUCTURAL_BONE.test(boneName)) structuralWeight += weight;
      if (DISTAL_ARM_BONE.test(boneName)) distalArmWeight += weight;
    }

    const vertical = (position.getY(vertex) - minimumY) / height;
    if (isSkirt) {
      const waistAttachment = 0.12 + 0.78 * vertical * vertical;
      result[vertex] = Math.min(0.98, waistAttachment + structuralWeight * 0.16);
    } else {
      const torsoAttachment = 0.3 + structuralWeight * 0.62;
      const sleeveFreedom = distalArmWeight * 0.2;
      result[vertex] = Math.min(0.98, Math.max(0.2, torsoAttachment - sleeveFreedom + vertical * 0.08));
    }
  }
  return result;
}
