"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Bone, Group, Mesh, Quaternion, SkeletonHelper, Sphere, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { DIRECTLY_CONTROLLED_BONES, SEMANTIC_BONES, type SemanticBone } from "@/config/boneMap";
import { TRACKING_CONFIG } from "@/config/tracking";
import { collectBones, detectBoneMapping, type BoneMappingReport } from "@/lib/model/boneMapping";
import { isAvatarMeshName, isGarmentMeshName } from "@/lib/model/inspectModel";
import { getModelBounds } from "@/lib/model/modelBounds";
import { hasUsableSkeletalMotion, type SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import { FittedBounds } from "./FittedBounds";

const ANIMATION_ORDER: readonly SemanticBone[] = DIRECTLY_CONTROLLED_BONES;
const TRANSFORM_EPSILON_SQ = 1e-12;
const BONE_SEGMENTS: Partial<Record<SemanticBone, string>> = {
  hips: "hip frame",
  spine: "shoulder/hip torso frame",
  neck: "torso → face frame (35%)",
  head: "torso → face frame",
  leftUpperArm: "left shoulder → elbow",
  leftForearm: "left elbow → wrist",
  rightUpperArm: "right shoulder → elbow",
  rightForearm: "right elbow → wrist",
  leftUpperLeg: "left hip → knee",
  leftLowerLeg: "left knee → ankle",
  rightUpperLeg: "right hip → knee",
  rightLowerLeg: "right knee → ankle",
};

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
    const restPositions = new Map<Bone, Vector3>();
    const restScales = new Map<Bone, Vector3>();
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
        restPositions.set(bone, bone.position.clone());
        restScales.set(bone, bone.scale.clone());
        bone.getWorldQuaternion(boneWorld);
        restModelSpaceRotations.set(bone, modelWorldInverse.clone().multiply(boneWorld));
      });
    }
    return { report, targets, restRotations, restPositions, restScales, restModelSpaceRotations };
  }, [model]);
  const frameQuaternions = useMemo(() => ({
    deltaWorld: new Quaternion(),
    parentWorld: new Quaternion(),
    modelWorld: new Quaternion(),
    modelWorldInverse: new Quaternion(),
    parentModelSpace: new Quaternion(),
    desiredModelSpace: new Quaternion(),
    trackedTarget: new Quaternion(),
    target: new Quaternion(),
  }), []);
  const rootTargetRef = useRef(new Vector3());
  const lastTrackedFrameRef = useRef<SkeletalFrame | null>(null);
  const lastDiagnosticAtRef = useRef(0);

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
    frameQuaternions.modelWorldInverse.copy(frameQuaternions.modelWorld).invert();
    const diagnosticDue = skeletonVisible && performance.now() - lastDiagnosticAtRef.current >= 1_500;
    const diagnosticRows: Array<Record<string, string | number | boolean>> | null = diagnosticDue ? [] : null;

    for (const semantic of ANIMATION_ORDER) {
      const rotation = motionFrame?.rotations[semantic];
      const bones = rig.targets[semantic];
      if (!bones) continue;
      for (const bone of bones) {
        const rest = rig.restRotations.get(bone);
        const restPosition = rig.restPositions.get(bone);
        const restScale = rig.restScales.get(bone);
        const restModelSpace = rig.restModelSpaceRotations.get(bone);
        if (!rest || !restPosition || !restScale || !restModelSpace) continue;
        const positionChanged = bone.position.distanceToSquared(restPosition) > TRANSFORM_EPSILON_SQ;
        const scaleChanged = bone.scale.distanceToSquared(restScale) > TRANSFORM_EPSILON_SQ;
        if (positionChanged) bone.position.copy(restPosition);
        if (scaleChanged) bone.scale.copy(restScale);
        frameQuaternions.target.copy(rest);
        let rotationDelta = 0;
        if (rotation && motionFrame?.trackingActive) {
          frameQuaternions.deltaWorld.fromArray(rotation).normalize();
          rotationDelta = 2 * Math.acos(Math.min(1, Math.abs(frameQuaternions.deltaWorld.w)));
          frameQuaternions.desiredModelSpace
            .copy(frameQuaternions.deltaWorld)
            .multiply(restModelSpace);
          if (bone.parent) {
            // Intermediate/helper bones are not directly controlled, but their
            // world matrices must reflect the already-updated parent chain.
            bone.parent.updateWorldMatrix(true, false);
            bone.parent.getWorldQuaternion(frameQuaternions.parentWorld);
            frameQuaternions.parentModelSpace
              .copy(frameQuaternions.modelWorldInverse)
              .multiply(frameQuaternions.parentWorld);
            frameQuaternions.trackedTarget
              .copy(frameQuaternions.parentModelSpace)
              .invert()
              .multiply(frameQuaternions.desiredModelSpace);
          } else {
            frameQuaternions.trackedTarget.copy(frameQuaternions.desiredModelSpace);
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
        if (diagnosticRows) {
          diagnosticRows.push({
            bone: bone.name,
            segment: BONE_SEGMENTS[semantic] ?? semantic,
            rotationDeltaDegrees: Math.round(rotationDelta * 180 / Math.PI),
            positionChanged,
            scaleChanged,
          });
        }
      }
    }
    if (diagnosticRows) {
      lastDiagnosticAtRef.current = performance.now();
      console.table(diagnosticRows);
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
