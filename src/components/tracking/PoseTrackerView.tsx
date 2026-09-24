"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrackingTransmitter } from "@/components/channel/useTrackingTransmitter";
import { TrackedModelViewport } from "@/components/model/TrackedModelViewport";
import { useResolvedModel } from "@/components/model/useResolvedModel";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import { COTTON_PRESET, cottonSettings, type ClothSettings } from "@/lib/cloth/ClothMaterialPresets";
import {
  BUILT_IN_MODEL_CONFIG,
  getActiveModelConfiguration,
  type ModelConfiguration,
} from "@/lib/model/modelStorage";
import type { CursorHand } from "@/lib/tracking/handCursor";
import { TRACKED_JOINTS, TrackingState } from "@/lib/tracking/types";
import { CalibrationStatus } from "./CalibrationStatus";
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
    start,
    stop,
    setCalibrating,
  } = usePoseTracker();
  const [debugVisible, setDebugVisible] = useState(false);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [exhibitionMode, setExhibitionMode] = useState(false);
  const [cursorHand, setCursorHand] = useState<CursorHand>("RIGHT");
  const [boneReport, setBoneReport] = useState<BoneMappingReport | null>(null);
  const [modelConfiguration, setModelConfiguration] = useState<ModelConfiguration>(BUILT_IN_MODEL_CONFIG);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [clothSettings, setClothSettings] = useState<ClothSettings>(cottonSettings);
  const effectiveClothSettings = useMemo(() => ({ ...COTTON_PRESET, ...clothSettings }), [clothSettings]);
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
  });
  const isRunning = phase === "running";
  const isBusy = phase === "initializing";
  const updateClothSetting = <Key extends keyof ClothSettings>(key: Key, value: ClothSettings[Key]) => {
    setClothSettings((current) => ({ ...current, [key]: value }));
  };

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
          <div>
            <p className="eyebrow">SMART MIRROR / PHASE 5</p>
            <h1>Live garment mirror</h1>
          </div>
        ) : <span className={`exhibition-status ${trackingState.toLowerCase()}`}>{STATE_LABEL[trackingState]}</span>}
        <div className="tracking-actions">
          {!exhibitionMode ? <span className={`channel-status ${channelStatus}`}>OUTPUT {channelStatus}</span> : null}
          {!exhibitionMode ? (
            <>
              <label className="debug-toggle">
                <input type="checkbox" checked={debugVisible} onChange={(event) => setDebugVisible(event.target.checked)} />
                DEBUG
              </label>
              <label className="debug-toggle">
                <input type="checkbox" checked={avatarVisible} onChange={(event) => setAvatarVisible(event.target.checked)} />
                AVATAR
              </label>
            </>
          ) : null}
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
      </header>

      <section className="tracking-layout">
        <div className="camera-shell">
          <video ref={videoRef} className="camera-feed" autoPlay muted playsInline />
          <PoseLandmarkOverlay enabled={debugVisible && isRunning} poseFrameRef={poseFrameRef} videoRef={videoRef} />
          <HandCursorOverlay enabled={debugVisible && isRunning} hand={cursorHand} poseFrameRef={poseFrameRef} />
          {!isRunning ? (
            <div className="camera-placeholder">
              <span>{isBusy ? "Loading MediaPipe…" : "Camera is off"}</span>
              {!isBusy ? <button className="button primary" type="button" onClick={start}>Start tracking</button> : null}
            </div>
          ) : null}
          <div className="camera-badge">Mirrored preview</div>
        </div>

        <div className="tracked-model-shell">
          <TrackedModelViewport
            modelUrl={modelSource.url}
            skeletalFrameRef={skeletalFrameRef}
            avatarVisible={avatarVisible}
            skeletonVisible={skeletonVisible}
            onBoneMap={handleBoneMap}
            clothSettings={effectiveClothSettings}
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
            <label className="debug-toggle">
              <input type="checkbox" checked={effectiveClothSettings.enabled} onChange={(event) => updateClothSetting("enabled", event.target.checked)} />
              CLOTH PHYSICS
            </label>
            <div className="cloth-controls">
              <label><span>Mass <output>{effectiveClothSettings.mass.toFixed(2)}</output></span><input type="range" min="0.2" max="2" step="0.05" value={effectiveClothSettings.mass} onChange={(event) => updateClothSetting("mass", Number(event.target.value))} /></label>
              <label><span>Gravity <output>{effectiveClothSettings.gravityScale.toFixed(2)}</output></span><input type="range" min="0" max="1.5" step="0.05" value={effectiveClothSettings.gravityScale} onChange={(event) => updateClothSetting("gravityScale", Number(event.target.value))} /></label>
              <label><span>Damping <output>{effectiveClothSettings.damping.toFixed(2)}</output></span><input type="range" min="0" max="0.3" step="0.01" value={effectiveClothSettings.damping} onChange={(event) => updateClothSetting("damping", Number(event.target.value))} /></label>
              <label><span>Stretch <output>{effectiveClothSettings.stretchStiffness.toFixed(2)}</output></span><input type="range" min="0.1" max="1" step="0.05" value={effectiveClothSettings.stretchStiffness} onChange={(event) => updateClothSetting("stretchStiffness", Number(event.target.value))} /></label>
              <label><span>Bend <output>{effectiveClothSettings.bendStiffness.toFixed(2)}</output></span><input type="range" min="0" max="0.8" step="0.02" value={effectiveClothSettings.bendStiffness} onChange={(event) => updateClothSetting("bendStiffness", Number(event.target.value))} /></label>
              <label><span>Attachment <output>{effectiveClothSettings.attachmentStrength.toFixed(2)}</output></span><input type="range" min="0.1" max="1.5" step="0.05" value={effectiveClothSettings.attachmentStrength} onChange={(event) => updateClothSetting("attachmentStrength", Number(event.target.value))} /></label>
              <label><span>Collision <output>{effectiveClothSettings.collisionThickness.toFixed(3)}</output></span><input type="range" min="0" max="0.05" step="0.002" value={effectiveClothSettings.collisionThickness} onChange={(event) => updateClothSetting("collisionThickness", Number(event.target.value))} /></label>
              <label><span>Iterations <output>{effectiveClothSettings.constraintIterations}</output></span><input type="range" min="1" max="8" step="1" value={effectiveClothSettings.constraintIterations} onChange={(event) => updateClothSetting("constraintIterations", Number(event.target.value))} /></label>
              <button className="button secondary" type="button" onClick={() => setClothSettings(cottonSettings())}>Cotton reset</button>
            </div>
            <label className="debug-toggle">
              <input type="checkbox" checked={skeletonVisible} onChange={(event) => setSkeletonVisible(event.target.checked)} />
              SKELETON
            </label>
            <div className="hand-selector" aria-label="Active hand cursor">
              <span>CURSOR</span>
              {(["LEFT", "RIGHT"] as const).map((hand) => (
                <button key={hand} type="button" aria-pressed={cursorHand === hand} onClick={() => setCursorHand(hand)}>{hand}</button>
              ))}
            </div>
            <p className="shortcut-note">D debug · A avatar · C recalibrate</p>
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
