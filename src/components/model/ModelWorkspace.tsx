"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  BUILT_IN_MODEL_CONFIG,
  getActiveModelConfiguration,
  resolveModelSource,
  setActiveModelConfiguration,
  storeLocalModel,
} from "@/lib/model/modelStorage";
import type { ModelReport, ModelSource } from "@/lib/model/types";
import { AppHeader } from "@/components/ui/AppHeader";
import { SwitchControl } from "@/components/ui/SwitchControl";
import { ModelInspector } from "./ModelInspector";
import { ModelViewer } from "./ModelViewer";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ModelWorkspace() {
  const [source, setSource] = useState<ModelSource>({ ...BUILT_IN_MODEL_CONFIG } as ModelSource);
  const [report, setReport] = useState<ModelReport | null>(null);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [garmentVisible, setGarmentVisible] = useState(true);
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => setWebGLAvailable(hasWebGL()));
    resolveModelSource(getActiveModelConfiguration())
      .then((resolved) => {
        if (!active) {
          if (resolved.kind === "local") URL.revokeObjectURL(resolved.url);
          return;
        }
        if (resolved.kind === "local") objectUrlRef.current = resolved.url;
        setSource(resolved);
      })
      .catch(() => {
        setActiveModelConfiguration(BUILT_IN_MODEL_CONFIG);
        setSource({ ...BUILT_IN_MODEL_CONFIG } as ModelSource);
      });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const selectBuiltIn = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setReport(null);
    setActiveModelConfiguration(BUILT_IN_MODEL_CONFIG);
    setSource({ ...BUILT_IN_MODEL_CONFIG } as ModelSource);
  }, []);

  const selectLocal = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      window.alert("Choose a binary .glb file.");
      return;
    }
    try {
      const configuration = await storeLocalModel(file);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setReport(null);
      setSource({ ...configuration, url } as ModelSource);
    } catch {
      window.alert("The local model could not be stored in this browser.");
    }
  }, []);

  const handleInspect = useCallback((nextReport: ModelReport) => setReport(nextReport), []);
  const isValid = report ? report.issues.every((issue) => issue.level !== "error") : false;

  return (
    <main className="workspace">
      <AppHeader current="model" />

      {!webGLAvailable ? (
        <div className="fatal-error" role="alert">WebGL is unavailable. Enable hardware acceleration or use a WebGL-capable browser.</div>
      ) : (
        <section className="model-layout" aria-label="Model preview and inspection">
          <ModelInspector source={source} report={report} />
          <div className="model-stage-shell studio-card" aria-label="Interactive model preview">
            <div className="viewer-canvas">
              <ModelViewer
                key={source.id}
                url={source.url}
                avatarVisible={avatarVisible}
                garmentVisible={garmentVisible}
                skeletonVisible={skeletonVisible}
                onInspect={handleInspect}
              />
            </div>
            <div className="camera-badge">Model preview · {source.kind === "local" ? "Local model" : "Exhibition avatar"}</div>
            <div className="model-stage-controls" aria-labelledby="model-setup-title">
              <div className="model-source-heading">
                <p className="eyebrow">model source</p>
                <h2 id="model-setup-title">Choose your avatar</h2>
              </div>
              <div className="button-row">
                <button className="button secondary" type="button" onClick={selectBuiltIn}>Use exhibition avatar</button>
                <label className="button primary">
                  Choose local GLB
                  <input type="file" accept=".glb,model/gltf-binary" onChange={selectLocal} />
                </label>
              </div>
              <div className="toggle-group" aria-label="Model visibility">
                <SwitchControl compact label="Avatar" checked={avatarVisible} onChange={setAvatarVisible} />
                <SwitchControl compact label="Clothes" checked={garmentVisible} onChange={setGarmentVisible} />
                <SwitchControl compact label="Skeleton" checked={skeletonVisible} onChange={setSkeletonVisible} />
              </div>
            </div>
            <p className="model-stage-hint">Drag to orbit · Scroll to zoom</p>
          </div>
        </section>
      )}

      <footer className="phase-footer">
        <span className={`footer-status ${isValid ? "valid" : ""}`}><span className="status-dot" />{isValid ? "Model validation passed" : "Waiting for a valid model"}</span>
        <Link className={`button primary ${isValid ? "" : "disabled"}`} href={isValid ? "/mirror" : "#"} aria-disabled={!isValid}>
          Enter Smart Mirror
        </Link>
      </footer>
    </main>
  );
}
