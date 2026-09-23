"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTrackingReceiver } from "@/components/channel/useTrackingReceiver";
import { TrackedModelViewport } from "@/components/model/TrackedModelViewport";
import { useResolvedModel } from "@/components/model/useResolvedModel";

export function HologramOutput() {
  const { skeletalFrameRef, status, trackingState, model, avatarVisible } = useTrackingReceiver();
  const { source, error: modelError } = useResolvedModel(model);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const ignoreBoneReport = useCallback(() => {}, []);

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
      if (event.key.toLowerCase() === "f" && !event.repeat) void enterFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enterFullscreen]);

  return (
    <main className="hologram-output phase-five-hologram">
      <div className="hologram-preview">
        <TrackedModelViewport
          modelUrl={source.url}
          skeletalFrameRef={skeletalFrameRef}
          avatarVisible={avatarVisible}
          skeletonVisible={false}
          onBoneMap={ignoreBoneReport}
          backgroundColor="#000000"
        />
      </div>

      <header className="hologram-controls">
        <div>
          <p className="eyebrow">HOLOGRAM OUTPUT / PHASE 5</p>
          <h1>Live synchronized preview</h1>
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
        <span>{source.label}</span>
      </div>
      {modelError ? <p className="hologram-error" role="alert">{modelError}</p> : null}
      {fullscreenError ? <p className="hologram-error" role="alert">{fullscreenError}</p> : null}
    </main>
  );
}
