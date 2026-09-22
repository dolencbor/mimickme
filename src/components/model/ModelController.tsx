"use client";

import { Bounds, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import { Bone, Quaternion, SkeletonHelper } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SEMANTIC_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import { collectBones, detectBoneMapping, type BoneMappingReport } from "@/lib/model/boneMapping";
import { SkeletonMapper } from "@/lib/tracking/SkeletonMapper";
import type { CalibrationProfile } from "@/lib/tracking/calibration";
import type { PoseFrame } from "@/lib/tracking/types";

const AVATAR_PATTERN = /(avatar|body|skin|person|human|head|face)/i;
const ANIMATION_ORDER: readonly SemanticBone[] = [
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
];

type Props = {
  url: string;
  poseFrameRef: RefObject<PoseFrame>;
  calibration: CalibrationProfile | null;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onBoneMap: (report: BoneMappingReport) => void;
};

export function ModelController({ url, poseFrameRef, calibration, avatarVisible, skeletonVisible, onBoneMap }: Props) {
  const gltf = useGLTF(url);
  const model = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const rig = useMemo(() => {
    const report = detectBoneMapping(model);
    const allBones = collectBones(model);
    const targets: Partial<Record<SemanticBone, Bone[]>> = {};
    const restRotations = new Map<Bone, Quaternion>();
    for (const semantic of SEMANTIC_BONES) {
      const boneName = report.mapping[semantic];
      if (!boneName) continue;
      const matches = allBones.filter((bone) => bone.name === boneName);
      if (matches.length > 0) targets[semantic] = matches;
      matches.forEach((bone) => restRotations.set(bone, bone.quaternion.clone()));
    }
    return { report, targets, restRotations };
  }, [model]);
  const mapper = useMemo(() => calibration ? new SkeletonMapper(calibration) : null, [calibration]);
  const frameQuaternions = useMemo(() => ({
    deltaWorld: new Quaternion(),
    parentWorld: new Quaternion(),
    localDelta: new Quaternion(),
    target: new Quaternion(),
  }), []);

  useEffect(() => onBoneMap(rig.report), [onBoneMap, rig.report]);

  useEffect(() => {
    model.traverse((object) => {
      if (object.name && AVATAR_PATTERN.test(object.name)) object.visible = avatarVisible;
    });
  }, [avatarVisible, model]);

  useEffect(() => {
    if (!skeletonVisible) return;
    const helper = new SkeletonHelper(model);
    helper.name = "DebugSkeletonHelper";
    model.add(helper);
    return () => {
      model.remove(helper);
      helper.dispose();
    };
  }, [model, skeletonVisible]);

  useFrame((_, deltaSeconds) => {
    const frame = poseFrameRef.current;
    const bonePose = mapper?.map(frame);
    const smoothing = 1 - Math.exp(-TRACKING_CONFIG.rotationSmoothingSpeed * deltaSeconds);

    for (const semantic of ANIMATION_ORDER) {
      const rotation = bonePose?.rotations[semantic];
      const bones = rig.targets[semantic];
      if (!bones) continue;
      for (const bone of bones) {
        const rest = rig.restRotations.get(bone);
        if (!rest) continue;
        frameQuaternions.target.copy(rest);
        if (rotation && frame.trackingActive) {
          frameQuaternions.deltaWorld.fromArray(rotation);
          if (bone.parent) bone.parent.getWorldQuaternion(frameQuaternions.parentWorld);
          else frameQuaternions.parentWorld.identity();
          frameQuaternions.localDelta
            .copy(frameQuaternions.parentWorld)
            .invert()
            .multiply(frameQuaternions.deltaWorld)
            .multiply(frameQuaternions.parentWorld);
          frameQuaternions.target.copy(frameQuaternions.localDelta).multiply(rest);
        }
        bone.quaternion.slerp(frameQuaternions.target, smoothing);
        bone.updateWorldMatrix(true, false);
      }
    }
  });

  return (
    <Bounds fit clip observe margin={1.3}>
      <primitive object={model} />
    </Bounds>
  );
}
