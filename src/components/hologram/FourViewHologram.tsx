"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { Group, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { HOLOGRAM_RENDER_CONFIG, HOLOGRAM_VIEWS } from "@/config/hologram";
import { HologramMotionController } from "./HologramMotionController";
import { ModelController } from "@/components/model/ModelController";
import { ModelErrorBoundary } from "@/components/model/ModelErrorBoundary";
import type { SkeletalFrame } from "@/lib/tracking/skeletalFrame";
import type { TrackingState } from "@/lib/tracking/types";
import type { HologramCalibration } from "@/lib/hologram/calibration";

type Props = {
  modelUrl: string;
  skeletalFrameRef: RefObject<SkeletalFrame>;
  trackingState: TrackingState;
  avatarVisible: boolean;
  garmentVisible: boolean;
  calibration: HologramCalibration;
};

type RendererProps = {
  presentationRef: RefObject<Group | null>;
  modelRadius: number;
  calibration: HologramCalibration;
};

function FourCameraRenderer({ presentationRef, modelRadius, calibration }: RendererProps) {
  const { gl, scene, size } = useThree();
  const lookAt = useMemo(() => new Vector3(0, 0, 0), []);
  const camerasRef = useRef(HOLOGRAM_VIEWS.map(() => new PerspectiveCamera(HOLOGRAM_RENDER_CONFIG.cameraFovDeg, 1, 0.01, 100)));

  useFrame(() => {
    const cellSize = Math.min(size.width, size.height) / 3;
    const tile = cellSize * calibration.viewSize;
    const horizontalOffset = (size.width - cellSize * 3) / 2;
    const verticalOffset = (size.height - cellSize * 3) / 2;
    const halfFovRadians = MathUtils.degToRad(HOLOGRAM_RENDER_CONFIG.cameraFovDeg / 2);
    const scaledModelRadius = modelRadius * calibration.scale;
    const baseDistance = Math.max(
      HOLOGRAM_RENDER_CONFIG.minimumCameraDistance,
      (scaledModelRadius / Math.sin(halfFovRadians)) * HOLOGRAM_RENDER_CONFIG.framingMargin,
    ) * calibration.cameraDistance;

    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor("#000000", 1);
    gl.clear(true, true, true);
    gl.setScissorTest(true);

    for (let index = 0; index < HOLOGRAM_VIEWS.length; index += 1) {
      const view = HOLOGRAM_VIEWS[index];
      const camera = camerasRef.current[index];
      const azimuth = MathUtils.degToRad(view.cameraAzimuthDeg);
      const elevation = MathUtils.degToRad(view.cameraElevationDeg);
      const distance = baseDistance * view.cameraDistanceMultiplier;
      const viewCalibration = calibration.views[view.id];
      const planarDistance = Math.cos(elevation) * distance;
      camera.position.set(Math.sin(azimuth) * planarDistance, Math.sin(elevation) * distance, Math.cos(azimuth) * planarDistance);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookAt);
      camera.rotateZ(MathUtils.degToRad(viewCalibration.rotationDeg));
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[0] *= viewCalibration.horizontalFlip ? -1 : 1;
      camera.projectionMatrix.elements[5] *= viewCalibration.verticalFlip ? -1 : 1;

      if (presentationRef.current) presentationRef.current.rotation.y = MathUtils.degToRad(view.modelRotationOffsetDeg);
      const x = horizontalOffset + (view.gridColumn - 1) * cellSize + (cellSize - tile) / 2;
      const y = verticalOffset + (3 - view.gridRow) * cellSize + (cellSize - tile) / 2;
      gl.setViewport(x, y, tile, tile);
      gl.setScissor(x, y, tile, tile);
      gl.render(scene, camera);
    }

    if (presentationRef.current) presentationRef.current.rotation.y = 0;
    gl.setScissorTest(false);
  }, 1);

  return null;
}

export function FourViewHologram({ modelUrl, skeletalFrameRef, trackingState, avatarVisible, garmentVisible, calibration }: Props) {
  const viewRotationRef = useRef<Group>(null);
  const motionRef = useRef<Group>(null);
  const trackingInfluenceRef = useRef(0);
  const [modelRadius, setModelRadius] = useState(1.5);
  const handleRadius = useCallback((radius: number) => setModelRadius((current) => Math.abs(current - radius) < 0.001 ? current : radius), []);
  const ignoreBoneReport = useCallback(() => {}, []);

  return (
    <div className="hologram-stage">
      <ModelErrorBoundary resetKey={modelUrl}>
        <Suspense fallback={<div className="viewer-message">Loading four-view model…</div>}>
          <Canvas
            dpr={[1, HOLOGRAM_RENDER_CONFIG.maxPixelRatio]}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => gl.setClearColor("#000000", 1)}
          >
            <ambientLight intensity={1.05} />
            <directionalLight position={[4, 6, 5]} intensity={2.2} />
            <directionalLight position={[-4, 2, -3]} intensity={1.1} />
            <HologramMotionController
              motionRef={motionRef}
              trackingInfluenceRef={trackingInfluenceRef}
              skeletalFrameRef={skeletalFrameRef}
              trackingState={trackingState}
              modelRadius={modelRadius}
            />
            <ModelController
              url={modelUrl}
              skeletalFrameRef={skeletalFrameRef}
              avatarVisible={avatarVisible}
              garmentVisible={garmentVisible}
              skeletonVisible={false}
              onBoneMap={ignoreBoneReport}
              autoFit={false}
              centerModel
              presentationRef={viewRotationRef}
              presentationScale={calibration.scale}
              presentationOffset={[calibration.offsetX, calibration.offsetY, calibration.offsetZ]}
              motionRef={motionRef}
              trackingInfluenceRef={trackingInfluenceRef}
              onModelRadius={handleRadius}
            />
            <FourCameraRenderer presentationRef={viewRotationRef} modelRadius={modelRadius} calibration={calibration} />
          </Canvas>
        </Suspense>
      </ModelErrorBoundary>
      <div className="hologram-view-labels" aria-hidden="true">
        {HOLOGRAM_VIEWS.map((view) => (
          <span key={view.id} style={{ gridColumn: view.gridColumn, gridRow: view.gridRow }}>{view.label}</span>
        ))}
      </div>
    </div>
  );
}
