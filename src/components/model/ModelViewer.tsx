"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { ModelReport } from "@/lib/model/types";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ModelScene } from "./ModelScene";

type Props = {
  url: string;
  avatarVisible: boolean;
  skeletonVisible: boolean;
  onInspect: (report: ModelReport) => void;
};

export function ModelViewer(props: Props) {
  return (
    <ModelErrorBoundary resetKey={props.url}>
      <Suspense fallback={<div className="viewer-message">Loading model…</div>}>
        <Canvas
          camera={{ fov: 36, position: [0, 1.2, 4] }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor("#111111")}
        >
          <ModelScene {...props} />
        </Canvas>
      </Suspense>
    </ModelErrorBoundary>
  );
}
