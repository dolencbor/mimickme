"use client";

import { Bounds, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { SkeletonHelper, type Object3D } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { inspectModel } from "@/lib/model/inspectModel";
import type { ModelReport } from "@/lib/model/types";

type Props = {
  url: string;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onInspect: (report: ModelReport) => void;
};

const AVATAR_PATTERN = /(avatar|body|skin|person|human|head|face)/i;

export function ModelScene({ url, avatarVisible, skeletonVisible, onInspect }: Props) {
  const gltf = useGLTF(url);
  const model = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const report = useMemo(() => inspectModel(model), [model]);

  useEffect(() => onInspect(report), [onInspect, report]);

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

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-3, 2, -2]} intensity={1.2} />
      <Environment preset="studio" environmentIntensity={0.35} />
      <Bounds fit clip observe margin={1.25}>
        <primitive object={model as Object3D} />
      </Bounds>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}
