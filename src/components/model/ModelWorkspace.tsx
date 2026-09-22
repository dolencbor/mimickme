"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { ModelReport, ModelSource } from "@/lib/model/types";
import { ModelInspector } from "./ModelInspector";
import { ModelViewer } from "./ModelViewer";

const BUILT_IN_MODEL: ModelSource = {
  id: "demo-rigged",
  label: "Built-in rigged demo",
  url: "/models/demo-rigged.glb",
  kind: "built-in",
};

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ModelWorkspace() {
  const [source, setSource] = useState<ModelSource>(BUILT_IN_MODEL);
  const [report, setReport] = useState<ModelReport | null>(null);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setWebGLAvailable(hasWebGL()));
    return () => {
      window.cancelAnimationFrame(frame);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const selectBuiltIn = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setReport(null);
    setSource(BUILT_IN_MODEL);
  }, []);

  const selectLocal = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      window.alert("Choose a binary .glb file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setReport(null);
    setSource({ id: `${file.name}-${file.lastModified}`, label: file.name, url, kind: "local" });
  }, []);

  const handleInspect = useCallback((nextReport: ModelReport) => setReport(nextReport), []);
  const isValid = report ? report.issues.every((issue) => issue.level !== "error") : false;

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">EXHIBITION PROTOTYPE / PHASE 1</p>
          <h1>Digital Garment Mirror</h1>
        </div>
        <nav aria-label="Primary routes">
          <Link href="/mirror">Mirror</Link>
          <Link href="/hologram">Hologram</Link>
        </nav>
      </header>

      <section className="setup-panel" aria-labelledby="model-setup-title">
        <div>
          <p className="eyebrow">MODEL SOURCE</p>
          <h2 id="model-setup-title">Load a prepared garment</h2>
          <p className="muted">Use the rigged demo or inspect a local GLB. Local files stay in this browser.</p>
        </div>
        <div className="button-row">
          <button className="button secondary" type="button" onClick={selectBuiltIn}>Use built-in demo</button>
          <label className="button primary">
            Choose local GLB
            <input type="file" accept=".glb,model/gltf-binary" onChange={selectLocal} />
          </label>
        </div>
      </section>

      {!webGLAvailable ? (
        <div className="fatal-error" role="alert">WebGL is unavailable. Enable hardware acceleration or use a WebGL-capable browser.</div>
      ) : (
        <section className="model-layout">
          <div className="viewer-shell">
            <div className="viewer-toolbar">
              <span>{source.kind === "local" ? "LOCAL MODEL" : "BUILT-IN MODEL"}</span>
              <div className="toggle-group">
                <label><input type="checkbox" checked={avatarVisible} onChange={(event) => setAvatarVisible(event.target.checked)} /> AVATAR</label>
                <label><input type="checkbox" checked={skeletonVisible} onChange={(event) => setSkeletonVisible(event.target.checked)} /> SKELETON</label>
              </div>
            </div>
            <div className="viewer-canvas">
              <ModelViewer
                key={source.id}
                url={source.url}
                avatarVisible={avatarVisible}
                skeletonVisible={skeletonVisible}
                onInspect={handleInspect}
              />
            </div>
            <p className="viewer-hint">Drag to orbit · Scroll to zoom</p>
          </div>
          <ModelInspector source={source} report={report} />
        </section>
      )}

      <footer className="phase-footer">
        <span>{isValid ? "Model validation passed" : "Waiting for a valid model"}</span>
        <Link className={`button primary ${isValid ? "" : "disabled"}`} href={isValid ? "/mirror" : "#"} aria-disabled={!isValid}>
          Enter Smart Mirror
        </Link>
      </footer>
    </main>
  );
}
