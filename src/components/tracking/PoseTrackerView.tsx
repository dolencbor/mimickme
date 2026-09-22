"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { TrackedModelViewport } from "@/components/model/TrackedModelViewport";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import { TRACKED_JOINTS, TrackingState } from "@/lib/tracking/types";
import { CalibrationStatus } from "./CalibrationStatus";
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
  const [debugVisible, setDebugVisible] = useState(true);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [boneReport, setBoneReport] = useState<BoneMappingReport | null>(null);
  const calibration = useCalibration({ trackerPhase: phase, trackingState, poseFrameRef, setCalibrating });
  const handleBoneMap = useCallback((report: BoneMappingReport) => setBoneReport(report), []);
  const isRunning = phase === "running";
  const isBusy = phase === "initializing";

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <div>
          <p className="eyebrow">SMART MIRROR / PHASE 3</p>
          <h1>Skeleton mapping</h1>
        </div>
        <div className="tracking-actions">
          <label className="debug-toggle">
            <input type="checkbox" checked={debugVisible} onChange={(event) => setDebugVisible(event.target.checked)} />
            DEBUG LANDMARKS
          </label>
          <label className="debug-toggle">
            <input type="checkbox" checked={avatarVisible} onChange={(event) => setAvatarVisible(event.target.checked)} />
            AVATAR
          </label>
          <label className="debug-toggle">
            <input type="checkbox" checked={skeletonVisible} onChange={(event) => setSkeletonVisible(event.target.checked)} />
            SKELETON
          </label>
          {isRunning ? (
            <button className="button secondary" type="button" onClick={stop}>Stop camera</button>
          ) : (
            <button className="button primary" type="button" onClick={start} disabled={isBusy}>
              {isBusy ? "Starting…" : "Start camera"}
            </button>
          )}
          <Link className="button secondary" href="/">Model setup</Link>
        </div>
      </header>

      <section className="tracking-layout">
        <div className="camera-shell">
          <video ref={videoRef} className="camera-feed" autoPlay muted playsInline />
          <PoseLandmarkOverlay enabled={debugVisible && isRunning} poseFrameRef={poseFrameRef} videoRef={videoRef} />
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
            calibration={calibration.profile}
            avatarVisible={avatarVisible}
            skeletonVisible={skeletonVisible}
            onBoneMap={handleBoneMap}
          />
          <div className="camera-badge">Tracked model · Built-in demo</div>
        </div>

        <aside className="tracking-diagnostics">
          <div className="diagnostic-heading">
            <div>
              <p className="eyebrow">LIVE STATUS</p>
              <h2>{STATE_LABEL[trackingState]}</h2>
            </div>
            <span className={`tracking-state ${trackingState.toLowerCase()}`}>{trackingState}</span>
          </div>

          {error ? <p className="tracking-error" role="alert">{error}</p> : null}

          <CalibrationStatus
            stage={calibration.stage}
            profile={calibration.profile}
            boneReport={boneReport}
            onRecalibrate={calibration.recalibrate}
          />

          <dl className="metrics tracking-metrics">
            <div><dt>Inference FPS</dt><dd>{diagnostics.fps.toFixed(1)}</dd></div>
            <div><dt>Confidence</dt><dd>{Math.round(diagnostics.confidence * 100)}%</dd></div>
            <div><dt>Backend</dt><dd>{diagnostics.backend ?? "—"}</dd></div>
            <div><dt>People</dt><dd>{diagnostics.people}</dd></div>
          </dl>

          <div className="tracked-joints">
            <p className="eyebrow">TRACKED JOINTS</p>
            <ul>
              {TRACKED_JOINTS.map((joint) => <li key={joint}>{joint.replace(/([A-Z])/g, " $1")}</li>)}
            </ul>
          </div>

          <p className="privacy-note">Pose processing runs locally in this tab. Webcam video is not uploaded.</p>
        </aside>
      </section>
    </main>
  );
}
