"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TrackedModelViewport } from "@/components/model/TrackedModelViewport";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import type { CursorHand } from "@/lib/tracking/handCursor";
import { TRACKED_JOINTS, TrackingState } from "@/lib/tracking/types";
import { CalibrationStatus } from "./CalibrationStatus";
import { HandCursorOverlay } from "./HandCursorOverlay";
import { PoseLandmarkOverlay } from "./PoseLandmarkOverlay";
import { useCalibration } from "./useCalibration";
import { usePoseTracker } from "./usePoseTracker";

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
  const { stage: calibrationStage, profile: calibrationProfile, recalibrate } = useCalibration({
    trackerPhase: phase,
    trackingState,
    poseFrameRef,
    setCalibrating,
  });
  const handleBoneMap = useCallback((report: BoneMappingReport) => setBoneReport(report), []);
  const isRunning = phase === "running";
  const isBusy = phase === "initializing";

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

  return (
    <main className={`tracking-page ${exhibitionMode ? "exhibition-mode" : ""}`}>
      <header className="tracking-header">
        {!exhibitionMode ? (
          <div>
            <p className="eyebrow">SMART MIRROR / PHASE 4</p>
            <h1>Live garment mirror</h1>
          </div>
        ) : <span className={`exhibition-status ${trackingState.toLowerCase()}`}>{STATE_LABEL[trackingState]}</span>}
        <div className="tracking-actions">
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
            poseFrameRef={poseFrameRef}
            calibration={calibrationProfile}
            avatarVisible={avatarVisible}
            skeletonVisible={skeletonVisible}
            onBoneMap={handleBoneMap}
          />
          <div className="camera-badge">Tracked model · Built-in demo</div>
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

          <dl className="metrics tracking-metrics">
            <div><dt>Inference FPS</dt><dd>{diagnostics.fps.toFixed(1)}</dd></div>
            <div><dt>Confidence</dt><dd>{Math.round(diagnostics.confidence * 100)}%</dd></div>
            <div><dt>Backend</dt><dd>{diagnostics.backend ?? "—"}</dd></div>
            <div><dt>People</dt><dd>{diagnostics.people}</dd></div>
          </dl>

          <div className="debug-controls">
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
