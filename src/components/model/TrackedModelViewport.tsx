"use client";

import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, type RefObject } from "react";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import type { SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ModelController } from "./ModelController";

type Props = {
  modelUrl: string;
  skeletalFrameRef: RefObject<SkeletalFrame>;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onBoneMap: (report: BoneMappingReport) => void;
  backgroundColor?: string;
};

export function TrackedModelViewport({ modelUrl, backgroundColor = "#111111", ...props }: Props) {
  return (
    <div className="tracked-model-canvas">
      <ModelErrorBoundary resetKey={modelUrl}>
        <Suspense fallback={<div className="viewer-message">Loading tracked model…</div>}>
          <Canvas
            camera={{ fov: 36, position: [0, 1.2, 4] }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => gl.setClearColor(backgroundColor)}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 5, 4]} intensity={2.4} />
            <directionalLight position={[-3, 2, -2]} intensity={1.2} />
            <Environment preset="studio" environmentIntensity={0.35} />
            <ModelController url={modelUrl} {...props} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
          </Canvas>
        </Suspense>
      </ModelErrorBoundary>
    </div>
  );
}
