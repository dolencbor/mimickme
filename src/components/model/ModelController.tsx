"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Bone, Group, Mesh, Quaternion, SkeletonHelper, Sphere, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SEMANTIC_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import { collectBones, detectBoneMapping, type BoneMappingReport } from "@/lib/model/boneMapping";
import { isAvatarMeshName, isGarmentMeshName } from "@/lib/model/inspectModel";
import { getModelBounds } from "@/lib/model/modelBounds";
import { hasUsableSkeletalMotion, type SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import { FittedBounds } from "./FittedBounds";

const ANIMATION_ORDER: readonly SemanticBone[] = [
  "hips",
  "spine",
  "spineMiddle",
  "spineUpper",
  "chest",
  "neck",
  "neckUpper",
  "head",
  "leftShoulder",
  "leftUpperArm",
  "leftUpperArmMiddle",
  "leftForearm",
  "leftForearmMiddle",
  "leftHand",
  "rightShoulder",
  "rightUpperArm",
  "rightUpperArmMiddle",
  "rightForearm",
  "rightForearmMiddle",
  "rightHand",
  "leftUpperLeg",
  "leftUpperLegMiddle",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightUpperLegMiddle",
  "rightLowerLeg",
  "rightFoot",
];

type Props = {
  url: string;
  skeletalFrameRef: RefObject<SkeletalFrame>;
  avatarVisible: boolean;
  garmentVisible: boolean;
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
};

export function ModelController({
  url,
  skeletalFrameRef,
  avatarVisible,
  garmentVisible,
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
  const rig = useMemo(() => {
    const report = detectBoneMapping(model);
    const allBones = collectBones(model);
    const targets: Partial<Record<SemanticBone, Bone[]>> = {};
    const restRotations = new Map<Bone, Quaternion>();
    const restModelSpaceRotations = new Map<Bone, Quaternion>();
    const modelWorldInverse = new Quaternion();
    const boneWorld = new Quaternion();
    model.updateMatrixWorld(true);
    model.getWorldQuaternion(modelWorldInverse).invert();
    for (const semantic of SEMANTIC_BONES) {
      const boneName = report.mapping[semantic];
      if (!boneName) continue;
      const matches = allBones.filter((bone) => bone.name === boneName);
      if (matches.length > 0) targets[semantic] = matches;
      matches.forEach((bone) => {
        restRotations.set(bone, bone.quaternion.clone());
        bone.getWorldQuaternion(boneWorld);
        restModelSpaceRotations.set(bone, modelWorldInverse.clone().multiply(boneWorld));
      });
    }
    return { report, targets, restRotations, restModelSpaceRotations };
  }, [model]);
  const frameQuaternions = useMemo(() => ({
    deltaWorld: new Quaternion(),
    parentWorld: new Quaternion(),
    modelWorld: new Quaternion(),
    desiredWorld: new Quaternion(),
    trackedTarget: new Quaternion(),
    target: new Quaternion(),
  }), []);
  const rootTargetRef = useRef(new Vector3());
  const lastTrackedFrameRef = useRef<SkeletalFrame | null>(null);

  useEffect(() => onBoneMap(rig.report), [onBoneMap, rig.report]);
  useEffect(() => onModelRadius?.(prepared.radius), [onModelRadius, prepared.radius]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof Mesh) || !object.name) return;
      if (isGarmentMeshName(object.name)) object.visible = garmentVisible;
      else if (isAvatarMeshName(object.name)) object.visible = avatarVisible;
    });
  }, [avatarVisible, garmentVisible, model]);

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
    const rootTarget = rootTargetRef.current;
    rootTarget.fromArray(motionFrame?.rootPosition ?? [0, 0, 0]).multiplyScalar(trackingInfluence);
    if (rootRef.current) {
      const positionResponse = Math.min(
        1,
        rootRef.current.position.distanceTo(rootTarget) / TRACKING_CONFIG.positionResponseDistance,
      );
      const positionSpeed = TRACKING_CONFIG.positionSmoothingMinSpeed +
        (TRACKING_CONFIG.positionSmoothingMaxSpeed - TRACKING_CONFIG.positionSmoothingMinSpeed) * positionResponse;
      rootRef.current.position.lerp(rootTarget, 1 - Math.exp(-positionSpeed * deltaSeconds));
    }

    model.updateWorldMatrix(true, true);
    model.getWorldQuaternion(frameQuaternions.modelWorld);

    for (const semantic of ANIMATION_ORDER) {
      const rotation = motionFrame?.rotations[semantic];
      const bones = rig.targets[semantic];
      if (!bones) continue;
      for (const bone of bones) {
        const rest = rig.restRotations.get(bone);
        const restModelSpace = rig.restModelSpaceRotations.get(bone);
        if (!rest || !restModelSpace) continue;
        frameQuaternions.target.copy(rest);
        if (rotation && motionFrame?.trackingActive) {
          frameQuaternions.deltaWorld.fromArray(rotation);
          frameQuaternions.desiredWorld
            .copy(frameQuaternions.modelWorld)
            .multiply(frameQuaternions.deltaWorld)
            .multiply(restModelSpace);
          if (bone.parent) {
            bone.parent.getWorldQuaternion(frameQuaternions.parentWorld);
            frameQuaternions.trackedTarget
              .copy(frameQuaternions.parentWorld)
              .invert()
              .multiply(frameQuaternions.desiredWorld);
          } else {
            frameQuaternions.trackedTarget.copy(frameQuaternions.desiredWorld);
          }
          frameQuaternions.target.slerpQuaternions(rest, frameQuaternions.trackedTarget, trackingInfluence);
        }
        const rotationResponse = Math.min(
          1,
          bone.quaternion.angleTo(frameQuaternions.target) / TRACKING_CONFIG.rotationResponseAngle,
        );
        const rotationSpeed = TRACKING_CONFIG.rotationSmoothingMinSpeed +
          (TRACKING_CONFIG.rotationSmoothingMaxSpeed - TRACKING_CONFIG.rotationSmoothingMinSpeed) * rotationResponse;
        bone.quaternion.slerp(frameQuaternions.target, 1 - Math.exp(-rotationSpeed * deltaSeconds));
        bone.updateWorldMatrix(true, false);
      }
    }
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
