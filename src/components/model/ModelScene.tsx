"use client";

import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Mesh, SkeletonHelper, type Object3D } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { inspectModel, isAvatarMeshName } from "@/lib/model/inspectModel";
import { getModelBounds } from "@/lib/model/modelBounds";
import type { ModelReport } from "@/lib/model/types";
import { FittedBounds } from "./FittedBounds";

type Props = {
  url: string;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onInspect: (report: ModelReport) => void;
};

export function ModelScene({ url, avatarVisible, skeletonVisible, onInspect }: Props) {
  const gltf = useGLTF(url);
  const model = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const bounds = useMemo(() => getModelBounds(model), [model]);
  const report = useMemo(() => inspectModel(model), [model]);

  useEffect(() => onInspect(report), [onInspect, report]);

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

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-3, 2, -2]} intensity={1.2} />
      <Environment preset="studio" environmentIntensity={0.35} />
      <FittedBounds box={bounds} margin={1.25}>
        <primitive object={model as Object3D} />
      </FittedBounds>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}
