"use client";

import { SEMANTIC_BONES } from "@/config/boneMap";
import type { BoneMappingReport } from "@/lib/model/boneMapping";
import type { CalibrationProfile } from "@/lib/tracking/calibration";
import type { CalibrationStage } from "./useCalibration";

const STAGE_COPY: Record<CalibrationStage, string> = {
  STAND_IN_FRAME: "Stand in frame",
  HOLD_NEUTRAL: "Hold a neutral pose",
  CALIBRATING: "Calibrating…",
  READY: "Ready",
};

type Props = {
  stage: CalibrationStage;
  profile: CalibrationProfile | null;
  boneReport: BoneMappingReport | null;
  onRecalibrate: () => void;
  showDebugDetails?: boolean;
};

export function CalibrationStatus({ stage, profile, boneReport, onRecalibrate, showDebugDetails = false }: Props) {
  return (
    <section className={`calibration-status ${stage.toLowerCase()}`}>
      <div>
        <p className="eyebrow">CALIBRATION</p>
        <h3>{STAGE_COPY[stage]}</h3>
        <p>
          {stage === "STAND_IN_FRAME" ? "Keep shoulders, hips, knees, and ankles visible." : null}
          {stage === "HOLD_NEUTRAL" ? "Face forward with arms relaxed and feet apart." : null}
          {stage === "CALIBRATING" ? "Keep still while neutral pose offsets are captured." : null}
          {stage === "READY" ? `${profile?.sampleCount ?? 0} neutral-pose samples captured.` : null}
        </p>
      </div>
      {stage === "READY" ? <button className="button secondary" type="button" onClick={onRecalibrate}>Recalibrate</button> : null}

      {showDebugDetails && boneReport ? (
        <details className="bone-map-details">
          <summary>Bone mapping ({SEMANTIC_BONES.length - boneReport.unresolved.length}/{SEMANTIC_BONES.length})</summary>
          {boneReport.missingRequired.length > 0 ? (
            <p className="bone-warning">Missing required: {boneReport.missingRequired.join(", ")}. Add exact names in <code>MANUAL_BONE_MAP</code>.</p>
          ) : <p className="success-note">Required motion bones detected.</p>}
          <dl className="bone-map-list">
            {SEMANTIC_BONES.map((semantic) => (
              <div key={semantic}>
                <dt>{semantic}</dt>
                <dd>{boneReport.mapping[semantic] ?? "Unresolved"}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
