"use client";

import type { ModelReport, ModelSource } from "@/lib/model/types";

type Props = { source: ModelSource; report: ModelReport | null };

export function ModelInspector({ source, report }: Props) {
  const errors = report?.issues.filter((issue) => issue.level === "error") ?? [];

  return (
    <aside className="inspector" aria-live="polite">
      <div className="inspector-heading">
        <div>
          <p className="eyebrow">MODEL INSPECTOR</p>
          <h2>{source.label}</h2>
        </div>
        <span className={`status-chip ${errors.length ? "invalid" : "valid"}`}>
          <span className="status-dot" />
          {!report ? "Inspecting" : errors.length ? "Needs attention" : "Valid"}
        </span>
      </div>

      {report ? (
        <>
          <dl className="metrics">
            <div><dt>Meshes</dt><dd>{report.meshNames.length}</dd></div>
            <div><dt>Skinned</dt><dd>{report.skinnedMeshNames.length}</dd></div>
            <div><dt>Skeletons</dt><dd>{report.skeletonCount}</dd></div>
            <div><dt>Bones</dt><dd>{report.boneNames.length}</dd></div>
          </dl>

          {report.issues.length > 0 ? (
            <ul className="issues">
              {report.issues.map((issue) => (
                <li className={issue.level} key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          ) : <p className="success-note">Ready for smart-mirror development.</p>}

          <details>
            <summary>Meshes ({report.meshNames.length})</summary>
            <p className="name-list">{report.meshNames.join(" · ")}</p>
          </details>
          <details>
            <summary>Bones ({report.boneNames.length})</summary>
            <p className="name-list">{report.boneNames.join(" · ")}</p>
          </details>
          <details>
            <summary>All scene objects ({report.objectNames.length})</summary>
            <p className="name-list">{report.objectNames.join(" · ")}</p>
          </details>
        </>
      ) : <p className="muted">Reading the scene hierarchy…</p>}
    </aside>
  );
}
