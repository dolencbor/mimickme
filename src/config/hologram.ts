export type HologramViewId = "front" | "right" | "back" | "left";

export type HologramViewConfig = {
  id: HologramViewId;
  label: string;
  gridColumn: 1 | 2 | 3;
  gridRow: 1 | 2 | 3;
  cameraAzimuthDeg: number;
  cameraElevationDeg: number;
  cameraDistanceMultiplier: number;
  modelRotationOffsetDeg: number;
  viewportRotationDeg: number;
  horizontalFlip: boolean;
  verticalFlip: boolean;
};

// Physical pyramids differ. Keep all view orientation assumptions in this table.
export const HOLOGRAM_VIEWS: readonly HologramViewConfig[] = [
  {
    id: "front",
    label: "FRONT",
    gridColumn: 2,
    gridRow: 1,
    cameraAzimuthDeg: 0,
    cameraElevationDeg: 2,
    cameraDistanceMultiplier: 1,
    modelRotationOffsetDeg: 0,
    viewportRotationDeg: 180,
    horizontalFlip: false,
    verticalFlip: false,
  },
  {
    id: "left",
    label: "LEFT",
    gridColumn: 1,
    gridRow: 2,
    cameraAzimuthDeg: -90,
    cameraElevationDeg: 2,
    cameraDistanceMultiplier: 1,
    modelRotationOffsetDeg: 0,
    viewportRotationDeg: 90,
    horizontalFlip: false,
    verticalFlip: false,
  },
  {
    id: "right",
    label: "RIGHT",
    gridColumn: 3,
    gridRow: 2,
    cameraAzimuthDeg: 90,
    cameraElevationDeg: 2,
    cameraDistanceMultiplier: 1,
    modelRotationOffsetDeg: 0,
    viewportRotationDeg: -90,
    horizontalFlip: false,
    verticalFlip: false,
  },
  {
    id: "back",
    label: "BACK",
    gridColumn: 2,
    gridRow: 3,
    cameraAzimuthDeg: 180,
    cameraElevationDeg: 2,
    cameraDistanceMultiplier: 1,
    modelRotationOffsetDeg: 0,
    viewportRotationDeg: 0,
    horizontalFlip: false,
    verticalFlip: false,
  },
];

export const HOLOGRAM_RENDER_CONFIG = {
  cameraFovDeg: 34,
  framingMargin: 1.6,
  minimumCameraDistance: 1.5,
  maxPixelRatio: 1.25,
} as const;
