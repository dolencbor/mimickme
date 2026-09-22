import { Bone, type Object3D } from "three";
import {
  BONE_ALIASES,
  MANUAL_BONE_MAP,
  REQUIRED_MOTION_BONES,
  SEMANTIC_BONES,
  type SemanticBone,
} from "@/config/boneMap";

export type BoneMappingReport = {
  mapping: Partial<Record<SemanticBone, string>>;
  source: Partial<Record<SemanticBone, "automatic" | "manual">>;
  unresolved: SemanticBone[];
  missingRequired: SemanticBone[];
  detectedBoneNames: string[];
};

function normalizedBoneName(name: string) {
  return name.toLowerCase().replace(/^mixamorig[:_\-]?/, "").replace(/^armature[:_\-]?/, "").replace(/[^a-z0-9]/g, "");
}

export function collectBones(root: Object3D) {
  const bones: Bone[] = [];
  root.traverse((object) => {
    if (object instanceof Bone) bones.push(object);
  });
  return bones;
}

export function detectBoneMapping(root: Object3D): BoneMappingReport {
  const bones = collectBones(root);
  const names = [...new Set(bones.map((bone) => bone.name).filter(Boolean))];
  const byNormalizedName = new Map<string, string[]>();
  for (const name of names) {
    const normalized = normalizedBoneName(name);
    byNormalizedName.set(normalized, [...(byNormalizedName.get(normalized) ?? []), name]);
  }

  const mapping: BoneMappingReport["mapping"] = {};
  const source: BoneMappingReport["source"] = {};
  const unresolved: SemanticBone[] = [];

  for (const semantic of SEMANTIC_BONES) {
    const manualName = MANUAL_BONE_MAP[semantic];
    if (manualName && names.includes(manualName)) {
      mapping[semantic] = manualName;
      source[semantic] = "manual";
      continue;
    }

    const candidates = new Set<string>();
    for (const alias of BONE_ALIASES[semantic]) {
      const matches = byNormalizedName.get(normalizedBoneName(alias)) ?? [];
      matches.forEach((match) => candidates.add(match));
    }
    if (candidates.size === 1) {
      mapping[semantic] = [...candidates][0];
      source[semantic] = "automatic";
    } else {
      unresolved.push(semantic);
    }
  }

  return {
    mapping,
    source,
    unresolved,
    missingRequired: REQUIRED_MOTION_BONES.filter((semantic) => !mapping[semantic]),
    detectedBoneNames: names,
  };
}
