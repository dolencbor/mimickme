import { Box3, Object3D, SkinnedMesh } from "three";

const FV21_ARMATURE_PATTERN = /^FV2\.1_Mannequin(?:\.\d+)?$/;

function hasCanonicalArmature(root: Object3D) {
  let found = false;
  root.traverse((object) => {
    if (FV21_ARMATURE_PATTERN.test(object.name)) found = true;
  });
  return found;
}

/**
 * The FV2.1 GLB stores already-metered skinned vertices below a 0.01 scene
 * root used by its centimeter-based skeleton. Three.js renders the bind pose
 * correctly, but Box3.setFromObject applies that scale to the static accessor
 * bounds and reports a model 100 times too small. Its mesh accessors share the
 * armature coordinate space, so their union is the reliable display bound.
 */
export function getModelBounds(root: Object3D) {
  if (!hasCanonicalArmature(root)) return new Box3().setFromObject(root);

  const bounds = new Box3();
  root.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox);
  });

  return bounds.isEmpty() ? new Box3().setFromObject(root) : bounds;
}
