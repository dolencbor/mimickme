"use client";

import { Bounds, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Bone, Box3, Group, Quaternion, SkeletonHelper, Sphere, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SEMANTIC_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import { collectBones, detectBoneMapping, type BoneMappingReport } from "@/lib/model/boneMapping";
import type { SkeletalFrame } from "@/lib/tracking/skeletalFrame";

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
  skeletalFrameRef: RefObject<SkeletalFrame>;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onBoneMap: (report: BoneMappingReport) => void;
  autoFit?: boolean;
  centerModel?: boolean;
  presentationRef?: RefObject<Group | null>;
  onModelRadius?: (radius: number) => void;
};

export function ModelController({
  url,
  skeletalFrameRef,
  avatarVisible,
  skeletonVisible,
  onBoneMap,
  autoFit = true,
  centerModel = false,
  presentationRef,
  onModelRadius,
}: Props) {
  const rootRef = useRef<Group>(null);
  const gltf = useGLTF(url);
  const prepared = useMemo(() => {
    const nextModel = clone(gltf.scene);
    const bounds = new Box3().setFromObject(nextModel);
    const center = bounds.getCenter(new Vector3());
    const radius = bounds.getBoundingSphere(new Sphere()).radius || 1;
    if (centerModel) nextModel.position.sub(center);
    return { model: nextModel, radius };
  }, [centerModel, gltf.scene]);
  const model = prepared.model;
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
  const frameQuaternions = useMemo(() => ({
    deltaWorld: new Quaternion(),
    parentWorld: new Quaternion(),
    localDelta: new Quaternion(),
    target: new Quaternion(),
  }), []);
  const rootTargetRef = useRef(new Vector3());

  useEffect(() => onBoneMap(rig.report), [onBoneMap, rig.report]);
  useEffect(() => onModelRadius?.(prepared.radius), [onModelRadius, prepared.radius]);

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
    const frame = skeletalFrameRef.current;
    const smoothing = 1 - Math.exp(-TRACKING_CONFIG.rotationSmoothingSpeed * deltaSeconds);
    const rootSmoothing = 1 - Math.exp(-TRACKING_CONFIG.positionSmoothingSpeed * deltaSeconds);

    const rootTarget = rootTargetRef.current;
    rootTarget.fromArray(frame.trackingActive ? frame.rootPosition : [0, 0, 0]);
    rootRef.current?.position.lerp(rootTarget, rootSmoothing);

    for (const semantic of ANIMATION_ORDER) {
      const rotation = frame.rotations[semantic];
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

  const content = (
    <group ref={presentationRef}>
      <group ref={rootRef}>
        <primitive object={model} />
      </group>
    </group>
  );

  return autoFit ? <Bounds fit clip margin={1.3}>{content}</Bounds> : content;
}
