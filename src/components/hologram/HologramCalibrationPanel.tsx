"use client";

import { HOLOGRAM_VIEWS, type HologramViewId } from "@/config/hologram";
import { HOLOGRAM_CALIBRATION_LIMITS, type HologramCalibration } from "@/lib/hologram/calibration";
import { SwitchControl } from "@/components/ui/SwitchControl";

type Props = {
  calibration: HologramCalibration;
  onChange: (update: (current: HologramCalibration) => HologramCalibration) => void;
  onClose: () => void;
  onReset: () => void;
};

type NumericKey = "scale" | "offsetX" | "offsetY" | "offsetZ" | "cameraDistance" | "viewSize";

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function RangeControl({ label, value, min, max, step, onChange }: RangeControlProps) {
  return (
    <label className="calibration-range">
      <span>{label}<output>{value.toFixed(2)}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

export function HologramCalibrationPanel({ calibration, onChange, onClose, onReset }: Props) {
  const updateNumber = (key: NumericKey, value: number) => onChange((current) => ({ ...current, [key]: value }));
  const updateView = (id: HologramViewId, update: Partial<HologramCalibration["views"][HologramViewId]>) => {
    onChange((current) => ({
      ...current,
      views: { ...current.views, [id]: { ...current.views[id], ...update } },
    }));
  };

  return (
    <aside className="hologram-calibration-panel" aria-label="Hologram calibration">
      <div className="calibration-panel-heading">
        <div>
          <p className="eyebrow">PHYSICAL ALIGNMENT</p>
          <h2>Hologram calibration</h2>
        </div>
        <button className="calibration-close" type="button" onClick={onClose} aria-label="Close calibration">×</button>
      </div>

      <section className="calibration-section">
        <h3>Model</h3>
        <RangeControl label="Scale" value={calibration.scale} {...HOLOGRAM_CALIBRATION_LIMITS.scale} onChange={(value) => updateNumber("scale", value)} />
        <RangeControl label="Offset X" value={calibration.offsetX} {...HOLOGRAM_CALIBRATION_LIMITS.offset} onChange={(value) => updateNumber("offsetX", value)} />
        <RangeControl label="Offset Y" value={calibration.offsetY} {...HOLOGRAM_CALIBRATION_LIMITS.offset} onChange={(value) => updateNumber("offsetY", value)} />
        <RangeControl label="Offset Z" value={calibration.offsetZ} {...HOLOGRAM_CALIBRATION_LIMITS.offset} onChange={(value) => updateNumber("offsetZ", value)} />
      </section>

      <section className="calibration-section">
        <h3>Projection</h3>
        <RangeControl label="Camera distance" value={calibration.cameraDistance} {...HOLOGRAM_CALIBRATION_LIMITS.cameraDistance} onChange={(value) => updateNumber("cameraDistance", value)} />
        <RangeControl label="View size" value={calibration.viewSize} {...HOLOGRAM_CALIBRATION_LIMITS.viewSize} onChange={(value) => updateNumber("viewSize", value)} />
      </section>

      <section className="calibration-section">
        <h3>Views</h3>
        <div className="calibration-view-list">
          {HOLOGRAM_VIEWS.map((view) => {
            const value = calibration.views[view.id];
            return (
              <fieldset className="calibration-view" key={view.id}>
                <legend>{view.label}</legend>
                <label className="calibration-range compact">
                  <span>Rotation<output>{value.rotationDeg}°</output></span>
                  <input
                    type="range"
                    value={value.rotationDeg}
                    {...HOLOGRAM_CALIBRATION_LIMITS.rotationDeg}
                    onChange={(event) => updateView(view.id, { rotationDeg: event.currentTarget.valueAsNumber })}
                  />
                </label>
                <SwitchControl compact label="H flip" checked={value.horizontalFlip} onChange={(checked) => updateView(view.id, { horizontalFlip: checked })} />
                <SwitchControl compact label="V flip" checked={value.verticalFlip} onChange={(checked) => updateView(view.id, { verticalFlip: checked })} />
              </fieldset>
            );
          })}
        </div>
      </section>

      <div className="calibration-panel-actions">
        <button className="button secondary" type="button" onClick={onReset}>Reset defaults</button>
        <button className="button primary" type="button" onClick={onClose}>Done</button>
      </div>
      <p className="calibration-shortcut">Press K to show or hide this panel.</p>
    </aside>
  );
}
