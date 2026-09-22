import { Bone, Mesh, Object3D, SkinnedMesh } from "three";
import type { ModelIssue, ModelReport } from "./types";

const AVATAR_PATTERN = /(avatar|body|skin|person|human|head|face)/i;
const GARMENT_PATTERN = /(garment|dress|shirt|skirt|coat|jacket|trouser|pants|cloth|top)/i;

function displayName(object: Object3D, fallback: string) {
  return object.name.trim() || `${fallback}_${object.id}`;
}

export function inspectModel(scene: Object3D): ModelReport {
  const objectNames: string[] = [];
  const meshNames: string[] = [];
  const skinnedMeshNames: string[] = [];
  const avatarMeshNames: string[] = [];
  const garmentMeshNames: string[] = [];
  const boneNames: string[] = [];
  const skeletonIds = new Set<string>();

  scene.traverse((object) => {
    objectNames.push(displayName(object, object.type));

    if (object instanceof Bone) {
      boneNames.push(displayName(object, "Bone"));
    }

    if (object instanceof Mesh) {
      const name = displayName(object, "Mesh");
      meshNames.push(name);
      if (AVATAR_PATTERN.test(name)) avatarMeshNames.push(name);
      if (GARMENT_PATTERN.test(name)) garmentMeshNames.push(name);
    }

    if (object instanceof SkinnedMesh) {
      const name = displayName(object, "SkinnedMesh");
      skinnedMeshNames.push(name);
      skeletonIds.add(object.skeleton.uuid);
    }
  });

  const issues: ModelIssue[] = [];
  if (meshNames.length === 0) issues.push({ level: "error", message: "The GLB contains no meshes." });
  if (boneNames.length === 0 || skeletonIds.size === 0) {
    issues.push({ level: "error", message: "No armature or skeleton was found." });
  }
  if (skinnedMeshNames.length === 0) {
    issues.push({ level: "error", message: "Garment is not skinned to an armature." });
  }
  if (garmentMeshNames.length === 0) {
    issues.push({
      level: "error",
      message: "No garment mesh could be identified. Include “garment”, “dress”, “shirt”, “coat”, or a similar garment term in its object name.",
    });
  }
  if (avatarMeshNames.length === 0) {
    issues.push({ level: "warning", message: "No avatar mesh name was recognized; the AVATAR toggle may have no effect." });
  }

  return {
    objectNames,
    meshNames,
    skinnedMeshNames,
    avatarMeshNames,
    garmentMeshNames,
    boneNames,
    skeletonCount: skeletonIds.size,
    issues,
  };
}
