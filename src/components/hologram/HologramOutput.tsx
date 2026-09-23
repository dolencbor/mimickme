"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTrackingReceiver } from "@/components/channel/useTrackingReceiver";
import { useResolvedModel } from "@/components/model/useResolvedModel";
import { FourViewHologram } from "./FourViewHologram";
import { HologramCalibrationPanel } from "./HologramCalibrationPanel";
import { useHologramCalibration } from "./useHologramCalibration";

export function HologramOutput() {
  const { skeletalFrameRef, status, trackingState, model, avatarVisible } = useTrackingReceiver();
  const { source, error: modelError } = useResolvedModel(model);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const { calibration, updateCalibration, resetCalibration } = useHologramCalibration();

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenError(null);
    } catch {
      setFullscreenError("Fullscreen was blocked. Use the browser menu or try again.");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat || target?.matches("input, textarea, select")) return;
      if (event.key.toLowerCase() === "f") void enterFullscreen();
      if (event.key.toLowerCase() === "k") setCalibrationOpen((current) => !current);
      if (event.key === "Escape") setCalibrationOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enterFullscreen]);

  return (
    <main className="hologram-output phase-five-hologram">
      <div className="hologram-preview">
        <FourViewHologram
          modelUrl={source.url}
          skeletalFrameRef={skeletalFrameRef}
          trackingState={trackingState}
          avatarVisible={avatarVisible}
          calibration={calibration}
        />
      </div>

      <header className="hologram-controls">
        <div>
          <p className="eyebrow">HOLOGRAM OUTPUT / PHASE 8</p>
          <h1>Calibrated hologram</h1>
        </div>
        <div className="button-row">
          <button className="button primary" type="button" onClick={enterFullscreen}>Enter fullscreen</button>
          <Link className="button secondary" href="/mirror">Open mirror</Link>
        </div>
      </header>

      <div className="hologram-status" aria-live="polite">
        <span className={`connection-dot ${status}`} />
        <span>{status === "connected" ? "Mirror connected" : status === "unsupported" ? "BroadcastChannel unavailable" : "Waiting for mirror"}</span>
        <span>{trackingState.replace("_", " ")}</span>
        <span>{trackingState === "TRACKING" ? "Live takeover" : "Idle motion"}</span>
        <span>{source.label}</span>
      </div>
      {calibrationOpen ? (
        <HologramCalibrationPanel
          calibration={calibration}
          onChange={updateCalibration}
          onClose={() => setCalibrationOpen(false)}
          onReset={resetCalibration}
        />
      ) : null}
      {modelError ? <p className="hologram-error" role="alert">{modelError}</p> : null}
      {fullscreenError ? <p className="hologram-error" role="alert">{fullscreenError}</p> : null}
    </main>
  );
}
