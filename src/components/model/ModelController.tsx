"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Bone, Group, Mesh, Quaternion, SkeletonHelper, Sphere, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SEMANTIC_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import { ClothSimulation } from "@/lib/cloth/ClothSimulation";
import { COTTON_PRESET, type ClothSettings } from "@/lib/cloth/ClothMaterialPresets";
import { collectBones, detectBoneMapping, type BoneMappingReport } from "@/lib/model/boneMapping";
import { isAvatarMeshName } from "@/lib/model/inspectModel";
import { getModelBounds } from "@/lib/model/modelBounds";
import { hasUsableSkeletalMotion, type SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import { FittedBounds } from "./FittedBounds";

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
  presentationScale?: number;
  presentationOffset?: [number, number, number];
  motionRef?: RefObject<Group | null>;
  trackingInfluenceRef?: RefObject<number>;
  onModelRadius?: (radius: number) => void;
  clothSettings?: ClothSettings;
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
  presentationScale = 1,
  presentationOffset = [0, 0, 0],
  motionRef,
  trackingInfluenceRef,
  onModelRadius,
  clothSettings = COTTON_PRESET,
}: Props) {
  const rootRef = useRef<Group>(null);
  const gltf = useGLTF(url);
  const prepared = useMemo(() => {
    const nextModel = clone(gltf.scene);
    const bounds = getModelBounds(nextModel);
    const center = bounds.getCenter(new Vector3());
    const radius = bounds.getBoundingSphere(new Sphere()).radius || 1;
    if (centerModel) nextModel.position.sub(center);
    return { model: nextModel, radius, bounds };
  }, [centerModel, gltf.scene]);
  const model = prepared.model;
  const cloth = useMemo(() => new ClothSimulation(model), [model]);
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
    trackedTarget: new Quaternion(),
    target: new Quaternion(),
  }), []);
  const rootTargetRef = useRef(new Vector3());
  const lastTrackedFrameRef = useRef<SkeletalFrame | null>(null);

  useEffect(() => onBoneMap(rig.report), [onBoneMap, rig.report]);
  useEffect(() => onModelRadius?.(prepared.radius), [onModelRadius, prepared.radius]);
  useEffect(() => cloth.setSettings(clothSettings), [cloth, clothSettings]);
  useEffect(() => () => cloth.dispose(), [cloth]);

  useEffect(() => {
    model.traverse((object) => {
      if (object instanceof Mesh && object.name && isAvatarMeshName(object.name)) object.visible = avatarVisible;
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
    const hasTrackedMotion = hasUsableSkeletalMotion(frame);
    if (trackingInfluenceRef && hasTrackedMotion) lastTrackedFrameRef.current = frame;
    const motionFrame = trackingInfluenceRef ? (hasTrackedMotion ? frame : lastTrackedFrameRef.current) : frame;
    const trackingInfluence = trackingInfluenceRef ? trackingInfluenceRef.current : 1;
    const smoothing = 1 - Math.exp(-TRACKING_CONFIG.rotationSmoothingSpeed * deltaSeconds);
    const rootSmoothing = 1 - Math.exp(-TRACKING_CONFIG.positionSmoothingSpeed * deltaSeconds);

    const rootTarget = rootTargetRef.current;
    rootTarget.fromArray(motionFrame?.rootPosition ?? [0, 0, 0]).multiplyScalar(trackingInfluence);
    rootRef.current?.position.lerp(rootTarget, rootSmoothing);

    for (const semantic of ANIMATION_ORDER) {
      const rotation = motionFrame?.rotations[semantic];
      const bones = rig.targets[semantic];
      if (!bones) continue;
      for (const bone of bones) {
        const rest = rig.restRotations.get(bone);
        if (!rest) continue;
        frameQuaternions.target.copy(rest);
        if (rotation && motionFrame?.trackingActive) {
          frameQuaternions.deltaWorld.fromArray(rotation);
          if (bone.parent) bone.parent.getWorldQuaternion(frameQuaternions.parentWorld);
          else frameQuaternions.parentWorld.identity();
          frameQuaternions.localDelta
            .copy(frameQuaternions.parentWorld)
            .invert()
            .multiply(frameQuaternions.deltaWorld)
            .multiply(frameQuaternions.parentWorld);
          frameQuaternions.trackedTarget.copy(frameQuaternions.localDelta).multiply(rest);
          frameQuaternions.target.slerpQuaternions(rest, frameQuaternions.trackedTarget, trackingInfluence);
        }
        bone.quaternion.slerp(frameQuaternions.target, smoothing);
        bone.updateWorldMatrix(true, false);
      }
    }
    model.updateWorldMatrix(true, true);
    cloth.step(deltaSeconds);
  });

  const content = (
    <group ref={presentationRef} scale={presentationScale} position={presentationOffset}>
      <group ref={motionRef}>
        <group ref={rootRef}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );

  return autoFit ? <FittedBounds box={prepared.bounds} margin={1.3}>{content}</FittedBounds> : content;
}
