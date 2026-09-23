import { HOLOGRAM_VIEWS, type HologramViewId } from "@/config/hologram";

const STORAGE_KEY = "fashion-hologram-calibration-v1";

export type HologramViewCalibration = {
  rotationDeg: number;
  horizontalFlip: boolean;
  verticalFlip: boolean;
};

export type HologramCalibration = {
  version: 1;
  scale: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  cameraDistance: number;
  viewSize: number;
  views: Record<HologramViewId, HologramViewCalibration>;
};

export const HOLOGRAM_CALIBRATION_LIMITS = {
  scale: { min: 0.5, max: 2, step: 0.01 },
  offset: { min: -1, max: 1, step: 0.01 },
  cameraDistance: { min: 0.6, max: 1.8, step: 0.01 },
  viewSize: { min: 0.6, max: 1.25, step: 0.01 },
  rotationDeg: { min: -180, max: 180, step: 1 },
} as const;

export const DEFAULT_HOLOGRAM_CALIBRATION: HologramCalibration = {
  version: 1,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  cameraDistance: 1,
  viewSize: 1,
  views: Object.fromEntries(HOLOGRAM_VIEWS.map((view) => [view.id, {
    rotationDeg: view.viewportRotationDeg,
    horizontalFlip: view.horizontalFlip,
    verticalFlip: view.verticalFlip,
  }])) as Record<HologramViewId, HologramViewCalibration>,
};

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function cloneDefaults(): HologramCalibration {
  return {
    ...DEFAULT_HOLOGRAM_CALIBRATION,
    views: Object.fromEntries(Object.entries(DEFAULT_HOLOGRAM_CALIBRATION.views).map(([id, view]) => [id, { ...view }])) as Record<HologramViewId, HologramViewCalibration>,
  };
}

export function readHologramCalibration(): HologramCalibration {
  const defaults = cloneDefaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<HologramCalibration>;
    if (parsed.version !== 1) return defaults;
    const parsedViews = parsed.views as Partial<Record<HologramViewId, Partial<HologramViewCalibration>>> | undefined;
    return {
      version: 1,
      scale: finiteNumber(parsed.scale, defaults.scale, HOLOGRAM_CALIBRATION_LIMITS.scale.min, HOLOGRAM_CALIBRATION_LIMITS.scale.max),
      offsetX: finiteNumber(parsed.offsetX, defaults.offsetX, HOLOGRAM_CALIBRATION_LIMITS.offset.min, HOLOGRAM_CALIBRATION_LIMITS.offset.max),
      offsetY: finiteNumber(parsed.offsetY, defaults.offsetY, HOLOGRAM_CALIBRATION_LIMITS.offset.min, HOLOGRAM_CALIBRATION_LIMITS.offset.max),
      offsetZ: finiteNumber(parsed.offsetZ, defaults.offsetZ, HOLOGRAM_CALIBRATION_LIMITS.offset.min, HOLOGRAM_CALIBRATION_LIMITS.offset.max),
      cameraDistance: finiteNumber(parsed.cameraDistance, defaults.cameraDistance, HOLOGRAM_CALIBRATION_LIMITS.cameraDistance.min, HOLOGRAM_CALIBRATION_LIMITS.cameraDistance.max),
      viewSize: finiteNumber(parsed.viewSize, defaults.viewSize, HOLOGRAM_CALIBRATION_LIMITS.viewSize.min, HOLOGRAM_CALIBRATION_LIMITS.viewSize.max),
      views: Object.fromEntries(HOLOGRAM_VIEWS.map((view) => {
        const stored = parsedViews?.[view.id];
        return [view.id, {
          rotationDeg: finiteNumber(stored?.rotationDeg, defaults.views[view.id].rotationDeg, HOLOGRAM_CALIBRATION_LIMITS.rotationDeg.min, HOLOGRAM_CALIBRATION_LIMITS.rotationDeg.max),
          horizontalFlip: typeof stored?.horizontalFlip === "boolean" ? stored.horizontalFlip : defaults.views[view.id].horizontalFlip,
          verticalFlip: typeof stored?.verticalFlip === "boolean" ? stored.verticalFlip : defaults.views[view.id].verticalFlip,
        }];
      })) as Record<HologramViewId, HologramViewCalibration>,
    };
  } catch {
    return defaults;
  }
}

export function writeHologramCalibration(calibration: HologramCalibration) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    // Calibration still works for the current session when storage is unavailable.
  }
}

export function resetHologramCalibration() {
  const defaults = cloneDefaults();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Keep the in-memory defaults even when storage is unavailable.
  }
  return defaults;
}
