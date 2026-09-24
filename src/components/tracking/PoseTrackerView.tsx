"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTrackingTransmitter } from "@/components/channel/useTrackingTransmitter";
import { TrackedModelViewport } from "@/components/model/TrackedModelViewport";
import { useResolvedModel } from "@/components/model/useResolvedModel";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import {
  BUILT_IN_MODEL_CONFIG,
  getActiveModelConfiguration,
  type ModelConfiguration,
} from "@/lib/model/modelStorage";
import type { CursorHand } from "@/lib/tracking/handCursor";
import { TRACKED_JOINTS, TrackingState } from "@/lib/tracking/types";
import { CalibrationStatus } from "./CalibrationStatus";
import { SwitchControl } from "@/components/ui/SwitchControl";
import { HandCursorOverlay } from "./HandCursorOverlay";
import { PoseLandmarkOverlay } from "./PoseLandmarkOverlay";
import { useCalibration } from "./useCalibration";
import { usePoseTracker } from "./usePoseTracker";
import { useSkeletalMotion } from "./useSkeletalMotion";

const STATE_LABEL: Record<TrackingState, string> = {
  [TrackingState.NO_PERSON]: "No person",
  [TrackingState.CALIBRATING]: "Calibrating",
  [TrackingState.TRACKING]: "Tracking",
  [TrackingState.TRACKING_LOST]: "Tracking lost",
};

export function PoseTrackerView() {
  const {
    videoRef,
    poseFrameRef,
    phase,
    trackingState,
    diagnostics,
    error,
    cameraDevices,
    selectedCameraId,
    selectCamera,
    start,
    stop,
    setCalibrating,
  } = usePoseTracker();
  const [debugVisible, setDebugVisible] = useState(false);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [garmentVisible, setGarmentVisible] = useState(true);
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [exhibitionMode, setExhibitionMode] = useState(false);
  const [cursorHand, setCursorHand] = useState<CursorHand>("RIGHT");
  const [boneReport, setBoneReport] = useState<BoneMappingReport | null>(null);
  const [modelConfiguration, setModelConfiguration] = useState<ModelConfiguration>(BUILT_IN_MODEL_CONFIG);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const { stage: calibrationStage, profile: calibrationProfile, recalibrate } = useCalibration({
    trackerPhase: phase,
    trackingState,
    poseFrameRef,
    setCalibrating,
  });
  const handleBoneMap = useCallback((report: BoneMappingReport) => setBoneReport(report), []);
  const { source: modelSource, error: modelError } = useResolvedModel(modelConfiguration);
  const skeletalFrameRef = useSkeletalMotion(poseFrameRef, calibrationProfile);
  const channelStatus = useTrackingTransmitter({
    skeletalFrameRef,
    trackingState,
    model: modelConfiguration,
    avatarVisible,
    garmentVisible,
  });
  const isRunning = phase === "running";
  const isBusy = phase === "initializing";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setModelConfiguration(getActiveModelConfiguration()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat || target?.matches("input, textarea, select")) return;
      if (event.key.toLowerCase() === "d") setDebugVisible((visible) => !visible);
      if (event.key.toLowerCase() === "a") setAvatarVisible((visible) => !visible);
      if (event.key.toLowerCase() === "g") setGarmentVisible((visible) => !visible);
      if (event.key.toLowerCase() === "c") recalibrate();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recalibrate]);

  const enterExhibitionMode = () => {
    setDebugVisible(false);
    setSkeletonVisible(false);
    setExhibitionMode(true);
  };

  const openHologram = () => {
    const outputWindow = window.open("/hologram", "fashion-hologram", "popup,width=1000,height=1000");
    setPopupBlocked(!outputWindow);
    outputWindow?.focus();
  };

  return (
    <main className={`tracking-page ${exhibitionMode ? "exhibition-mode" : ""}`}>
      <header className="tracking-header">
        {!exhibitionMode ? (
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">M</span>
            <div>
              <p className="eyebrow">MIMICKME / LIVE STUDIO</p>
              <h1>Live garment mirror</h1>
            </div>
          </div>
        ) : <span className={`exhibition-status ${trackingState.toLowerCase()}`}>{STATE_LABEL[trackingState]}</span>}
        <div className="tracking-actions">
          {!exhibitionMode ? (
            <div className="tracking-control-group">
              <span className={`channel-status ${channelStatus}`} aria-live="polite">OUTPUT {channelStatus}</span>
              <div className="header-switches">
                <SwitchControl compact label="Debug" checked={debugVisible} onChange={setDebugVisible} />
                <SwitchControl compact label="Avatar" checked={avatarVisible} onChange={setAvatarVisible} />
                <SwitchControl compact label="Clothes" checked={garmentVisible} onChange={setGarmentVisible} />
              </div>
            </div>
          ) : null}
          <div className="tracking-button-group">
            {isRunning ? (
              !exhibitionMode ? <button className="button secondary" type="button" onClick={stop}>Stop camera</button> : null
            ) : (
              <button className="button primary" type="button" onClick={start} disabled={isBusy}>
                {isBusy ? "Starting…" : "Start camera"}
              </button>
            )}
            {!exhibitionMode ? (
              <>
              <button className="button secondary" type="button" onClick={enterExhibitionMode}>Exhibition mode</button>
              <button className="button primary" type="button" onClick={openHologram}>Make it a hologram</button>
              <Link className="button secondary" href="/">Model setup</Link>
              </>
            ) : <button className="button secondary exhibition-exit" type="button" onClick={() => setExhibitionMode(false)}>Exit exhibition</button>}
          </div>
        </div>
      </header>

      <section className="tracking-layout" aria-label="Live camera and tracked avatar">
        <div className="camera-shell studio-card" aria-label="Camera preview">
          <video ref={videoRef} className="camera-feed" autoPlay muted playsInline />
          <PoseLandmarkOverlay enabled={debugVisible && isRunning} poseFrameRef={poseFrameRef} videoRef={videoRef} />
          <HandCursorOverlay enabled={debugVisible && isRunning} hand={cursorHand} poseFrameRef={poseFrameRef} />
          {!exhibitionMode ? (
            <label className="camera-source-control">
              <span>Camera</span>
              <select
                value={selectedCameraId}
                onChange={(event) => void selectCamera(event.currentTarget.value)}
                disabled={isBusy || cameraDevices.length === 0}
                aria-label="Camera source"
              >
                {cameraDevices.length === 0 ? <option value="">Default camera</option> : null}
                {cameraDevices.map((camera) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>)}
              </select>
            </label>
          ) : null}
          {!isRunning ? (
            <div className="camera-placeholder">
              <span>{isBusy ? "Loading MediaPipe…" : "Camera is off"}</span>
              {!isBusy ? <button className="button primary" type="button" onClick={start}>Start tracking</button> : null}
            </div>
          ) : null}
          <div className="camera-badge">Mirrored preview</div>
        </div>

        <div className="tracked-model-shell studio-card" aria-label="Tracked avatar preview">
          <TrackedModelViewport
            modelUrl={modelSource.url}
            skeletalFrameRef={skeletalFrameRef}
            avatarVisible={avatarVisible}
            garmentVisible={garmentVisible}
            skeletonVisible={debugVisible || skeletonVisible}
            onBoneMap={handleBoneMap}
          />
          <div className="camera-badge">Tracked model · {modelSource.label}</div>
          <div className="mirror-calibration-overlay">
            <CalibrationStatus
              stage={calibrationStage}
              profile={calibrationProfile}
              boneReport={boneReport}
              onRecalibrate={recalibrate}
              showDebugDetails={debugVisible}
            />
          </div>
        </div>
      </section>

      {debugVisible ? (
        <aside className="tracking-diagnostics" aria-label="Developer diagnostics">
          <div className="diagnostic-heading">
            <div>
              <p className="eyebrow">LIVE STATUS</p>
              <h2>{STATE_LABEL[trackingState]}</h2>
            </div>
            <span className={`tracking-state ${trackingState.toLowerCase()}`}>{trackingState}</span>
          </div>

          {error ? <p className="tracking-error" role="alert">{error}</p> : null}
          {modelError ? <p className="tracking-error" role="alert">{modelError}</p> : null}
          {popupBlocked ? <p className="tracking-error" role="alert">Popup blocked. Allow popups, then try again.</p> : null}

          <dl className="metrics tracking-metrics">
            <div><dt>Inference FPS</dt><dd>{diagnostics.fps.toFixed(1)}</dd></div>
            <div><dt>Confidence</dt><dd>{Math.round(diagnostics.confidence * 100)}%</dd></div>
            <div><dt>Backend</dt><dd>{diagnostics.backend ?? "—"}</dd></div>
            <div><dt>People</dt><dd>{diagnostics.people}</dd></div>
            <div><dt>Channel</dt><dd>{channelStatus}</dd></div>
            <div><dt>Model</dt><dd>{modelSource.kind}</dd></div>
          </dl>

          <div className="debug-controls">
            <SwitchControl
              compact
              label="Skeleton"
              checked={debugVisible || skeletonVisible}
              disabled={debugVisible}
              onChange={setSkeletonVisible}
            />
            <div className="hand-selector" aria-label="Active hand cursor">
              <span>CURSOR</span>
              {(["LEFT", "RIGHT"] as const).map((hand) => (
                <button key={hand} type="button" aria-pressed={cursorHand === hand} onClick={() => setCursorHand(hand)}>{hand}</button>
              ))}
            </div>
            <p className="shortcut-note">D debug · A avatar · G clothes · C recalibrate</p>
          </div>

          <div className="tracked-joints">
            <p className="eyebrow">TRACKED JOINTS</p>
            <ul>
              {TRACKED_JOINTS.map((joint) => <li key={joint}>{joint.replace(/([A-Z])/g, " $1")}</li>)}
            </ul>
          </div>

          <p className="privacy-note">Pose processing runs locally in this tab. Webcam video is not uploaded.</p>
        </aside>
      ) : null}
    </main>
  );
}
