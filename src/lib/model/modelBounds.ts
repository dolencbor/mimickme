import { Box3, Object3D, SkinnedMesh, Vector3 } from "three";

const FV21_ARMATURE_PATTERN = /^FV2\.1_Mannequin(?:\.\d+)?$/;
const MIXAMO_HIPS_PATTERN = /^mixamorig[:_\-]?Hips$/i;

function usesMeteredAccessorSpace(root: Object3D, geometryBounds: Box3) {
  let hasCanonicalArmature = false;
  let hasMixamoHips = false;
  let hasCentimeterArmatureRoot = false;
  root.traverse((object) => {
    if (FV21_ARMATURE_PATTERN.test(object.name)) hasCanonicalArmature = true;
    if (MIXAMO_HIPS_PATTERN.test(object.name)) hasMixamoHips = true;
    if (
      object.name === "Armature" &&
      Math.max(Math.abs(object.scale.x), Math.abs(object.scale.y), Math.abs(object.scale.z)) <= 0.02
    ) {
      hasCentimeterArmatureRoot = true;
    }
  });
  if (hasCanonicalArmature) return true;

  const size = geometryBounds.getSize(new Vector3());
  const plausibleMeterHeight = size.y >= 0.5 && size.y <= 3.5;
  return hasMixamoHips && hasCentimeterArmatureRoot && plausibleMeterHeight;
}

/**
 * Some Blender exports store already-metered skinned vertices below a 0.01
 * armature root used by a centimeter-based skeleton. Three.js renders their
 * bind pose correctly, but Box3.setFromObject applies the root scale to static
 * accessor bounds and can report a model 100 times too small. For the validated
 * FV2.1 and Mixamo variants, the shared mesh accessor space is the reliable
 * display bound and keeps the complete avatar inside every fitted camera.
 */
export function getModelBounds(root: Object3D) {
  const geometryBounds = new Box3();
  root.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) geometryBounds.union(object.geometry.boundingBox);
  });

  if (!geometryBounds.isEmpty() && usesMeteredAccessorSpace(root, geometryBounds)) return geometryBounds;
  return new Box3().setFromObject(root);
}
