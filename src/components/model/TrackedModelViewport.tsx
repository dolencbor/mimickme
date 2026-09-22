"use client";

import { Environment, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, type RefObject } from "react";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import type { CalibrationProfile } from "@/lib/tracking/calibration";
import type { PoseFrame } from "@/lib/tracking/types";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ModelController } from "./ModelController";

type Props = {
  poseFrameRef: RefObject<PoseFrame>;
  calibration: CalibrationProfile | null;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onBoneMap: (report: BoneMappingReport) => void;
};

const MODEL_URL = "/models/demo-rigged.glb";

export function TrackedModelViewport(props: Props) {
  return (
    <div className="tracked-model-canvas">
      <ModelErrorBoundary resetKey={MODEL_URL}>
        <Suspense fallback={<div className="viewer-message">Loading tracked model…</div>}>
          <Canvas
            camera={{ fov: 36, position: [0, 1.2, 4] }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => gl.setClearColor("#111111")}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 5, 4]} intensity={2.4} />
            <directionalLight position={[-3, 2, -2]} intensity={1.2} />
            <Environment preset="studio" environmentIntensity={0.35} />
            <ModelController url={MODEL_URL} {...props} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
          </Canvas>
        </Suspense>
      </ModelErrorBoundary>
    </div>
  );
}
