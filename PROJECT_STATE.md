# Project State

## Architecture

- Next.js 16 App Router application with React 19, TypeScript, Three.js, React Three Fiber, and Drei.
- `/` owns model selection, validation, inspection, and the Phase 1 viewer; `/mirror` owns live tracking/calibration; `/hologram` receives processed motion without camera or MediaPipe.
- Local `.glb` files use a short-lived object URL and never leave the browser.
- Pure model inspection lives outside the R3F viewer; transient 3D controls update the cloned Three.js scene directly.
- `/mirror` owns the webcam and MediaPipe Pose Landmarker lifecycle. Raw results are converted to `PoseFrame` immediately and stored in a mutable ref.
- React receives only tracking-state changes and diagnostics throttled to 2.5 Hz; landmark drawing runs directly on a canvas animation loop.
- Calibration samples a stable neutral pose into a `CalibrationProfile`. `SkeletonMapper` converts subsequent landmark directions into quaternion deltas without React state updates per frame.
- The model controller auto-detects exact bone aliases, preserves rest rotations, converts world-space deltas into each bone's parent space, and applies frame-rate-independent quaternion smoothing.
- Phase 4 keeps pose data unmirrored while mirroring only camera/cursor presentation. Calibrated hip-center deltas drive restrained, clamped, smoothed model-root translation.
- Exhibition mode removes developer chrome while preserving camera startup and recalibration; keyboard fallbacks are `D` debug, `A` avatar, and `C` recalibrate.
- One `SkeletalFrame` ref now feeds both the mirror model and the cross-window transmitter. Per-frame quaternions/root motion never enter React state.
- `fashion-hologram-tracking` uses a versioned `BroadcastChannel` protocol with receiver hello/goodbye heartbeats, compact skeletal snapshots, connection timeouts, model configuration, tracking state, and avatar visibility.
- Active model configuration is stored in localStorage; local GLB blobs are persisted in IndexedDB and resolved to short-lived object URLs independently in each window.
- The hologram uses one R3F scene, one cloned rig, and one skeletal update. A custom scissor renderer draws FRONT/RIGHT/BACK/LEFT through four configured cameras into a responsive square cross layout.
- Camera azimuth/elevation/distance, model rotation offset, viewport rotation, and flips are isolated in `src/config/hologram.ts`; model bounds drive shared camera auto-framing.

## Important files

- `src/app/` — routes and global styles.
- `src/components/model/` — GLB loading, error boundary, inspection, and viewer UI.
- `src/lib/model/inspectModel.ts` — pure scene validation and name-based avatar/garment classification.
- `public/models/demo-rigged.glb` — generated built-in development asset.
- `scripts/generate-demo-model.mjs` — repeatable demo-asset generator.
- `src/components/tracking/` — webcam lifecycle, MediaPipe runner, debug canvas, and tracking UI.
- `src/lib/tracking/` — MediaPipe-independent pose types, processor, calibration profile, `SkeletonMapper`, and explicit tracking state machine.
- `src/lib/model/boneMapping.ts` — conservative alias-based bone auto-detection with an explicit manual fallback.
- `src/config/boneMap.ts` — semantic bone names, common aliases, and `MANUAL_BONE_MAP` overrides.
- `src/config/tracking.ts` — confidence, timing, inference, WASM, and model configuration.
- `src/lib/tracking/handCursor.ts` — left/right wrist conversion into mirrored normalized cursor coordinates.
- `src/lib/tracking/skeletalFrame.ts` and `src/components/tracking/useSkeletalMotion.ts` — processed cross-window motion state.
- `src/lib/channel/trackingChannel.ts` and `src/components/channel/` — versioned BroadcastChannel protocol and lifecycle hooks.
- `src/lib/model/modelStorage.ts` — built-in/local model persistence and per-window resolution.
- `src/components/hologram/HologramOutput.tsx` and `FourViewHologram.tsx` — synchronized four-view output, custom camera renderer, and fullscreen control.
- `src/config/hologram.ts` — physical-view orientation and performance/framing defaults.

## Completed phases

- Phase 1 — Foundation + GLB: complete.
- Checks: peer dependencies, TypeScript, ESLint, production build, built-in GLB browser render, controls, local GLB loading, and `/mirror` navigation all pass.
- Phase 2 — Webcam + MediaPipe: complete.
- Checks: TypeScript, ESLint, production build, camera start/stop cleanup, MediaPipe GPU initialization, live inference (~25 FPS), diagnostics, and browser error overlay checks pass.
- Phase 3 — Calibration + Skeleton Mapping: complete.
- Checks: TypeScript, ESLint, production build, WebGL model render, live GPU inference (~25 FPS), 38-frame neutral calibration, auto-mapping, avatar/skeleton debug toggles, and browser error-overlay checks pass.
- Phase 4 — Smart Mirror: complete.
- Checks: TypeScript, ESLint, production build, exact desktop 50/50 split, responsive/exhibition layouts, webcam readiness, GPU inference (~25 FPS), model/avatar isolation, debug controls, hand selection, keyboard controls, and browser console/error-overlay checks pass.
- Phase 5 — Cross-Window System: complete.
- Checks: TypeScript, ESLint, production build, popup launch, bidirectional channel handshake, mirror connection status, black WebGL hologram preview, built-in model configuration, fullscreen action, zero hologram video/camera elements, zero MediaPipe assets in the hologram document, and browser console/error-overlay checks pass.
- Phase 6 — Four-View Hologram: complete.
- Checks: TypeScript, ESLint, production build, one-canvas/four-camera rendering, distinct cross-layout cells, centered square stage, pure-black background, model-bound auto-framing, popup handshake regression, and browser console/error-overlay checks pass.

## Bone mappings

- Runtime mapping uses normalized exact aliases and never silently fuzzy-matches a rig.
- The built-in demo resolves 15/17 semantic bones. Every required motion bone resolves; optional `Spine` and `Chest` remain unresolved because their GLB nodes are not bones.
- Rig-specific overrides belong in `MANUAL_BONE_MAP` in `src/config/boneMap.ts`.

## Unresolved issues

- No production CLO/Blender garment GLB has been supplied or validated yet.
- Drei/R3F currently emits a harmless Three.js `Clock` deprecation warning from dependency code; revisit during Phase 9 hardening.
- MediaPipe emits internal WebGL/projection warnings while inference remains operational; revisit during Phase 9 hardening.
- Automated browser runs completed calibration in Phase 3, but sustained full-body movement was not available long enough to visually validate every limb axis and the full root-translation range; confirm with a fully visible standing subject before exhibition use.
- IndexedDB cross-window support is implemented for local GLBs; validate it with the final production CLO file when supplied.
- Physical pyramid orientation may require changing the isolated view rotation/flip values during on-site calibration.
- Next phase: Phase 7 — Idle + Takeover.
