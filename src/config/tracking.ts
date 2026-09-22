export const TRACKING_CONFIG = {
  confidenceThreshold: 0.55,
  lostTrackingTimeoutMs: 650,
  noPersonTimeoutMs: 1_500,
  diagnosticsIntervalMs: 400,
  maxInferenceFps: 30,
  cameraPermissionTimeoutMs: 20_000,
} as const;

export const MEDIAPIPE_CONFIG = {
  wasmRoot: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  modelAssetPath:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
} as const;
