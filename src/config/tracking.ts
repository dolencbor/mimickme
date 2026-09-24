export const TRACKING_CONFIG = {
  confidenceThreshold: 0.55,
  lostTrackingTimeoutMs: 650,
  noPersonTimeoutMs: 1_500,
  diagnosticsIntervalMs: 400,
  maxInferenceFps: 30,
  cameraPermissionTimeoutMs: 20_000,
  neutralHoldMs: 1_000,
  calibrationDurationMs: 1_400,
  minimumCalibrationFrames: 12,
  rotationSmoothingMinSpeed: 10,
  rotationSmoothingMaxSpeed: 28,
  rotationResponseAngle: 0.65,
  positionSmoothingMinSpeed: 7,
  positionSmoothingMaxSpeed: 18,
  positionResponseDistance: 0.25,
  rootHorizontalScale: 1.8,
  rootVerticalScale: 1.1,
  rootDepthScale: 1.25,
  rootHorizontalLimit: 0.65,
  rootVerticalLimit: 0.35,
  rootDepthLimit: 0.45,
  handCursorConfidenceThreshold: 0.5,
} as const;

export const MEDIAPIPE_CONFIG = {
  wasmRoot: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  modelAssetPath:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
} as const;
