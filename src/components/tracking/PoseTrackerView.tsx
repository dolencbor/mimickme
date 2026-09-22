"use client";

import Link from "next/link";
import { useState } from "react";
import { TRACKED_JOINTS, TrackingState } from "@/lib/tracking/types";
import { PoseLandmarkOverlay } from "./PoseLandmarkOverlay";
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
  } = usePoseTracker();
  const [debugVisible, setDebugVisible] = useState(true);
  const isRunning = phase === "running";
  const isBusy = phase === "initializing";

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <div>
          <p className="eyebrow">SMART MIRROR / PHASE 2</p>
          <h1>Pose tracking</h1>
        </div>
        <div className="tracking-actions">
          <label className="debug-toggle">
            <input type="checkbox" checked={debugVisible} onChange={(event) => setDebugVisible(event.target.checked)} />
            DEBUG LANDMARKS
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

        <aside className="tracking-diagnostics">
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
