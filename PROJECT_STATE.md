# Project State

## Architecture

- Next.js 16 App Router application with React 19, TypeScript, Three.js, React Three Fiber, and Drei.
- `/` owns model selection, validation, inspection, and the Phase 1 viewer; `/mirror` owns live tracking, calibration, and rig control; `/hologram` remains a route placeholder.
- Local `.glb` files use a short-lived object URL and never leave the browser.
- Pure model inspection lives outside the R3F viewer; transient 3D controls update the cloned Three.js scene directly.
- `/mirror` owns the webcam and MediaPipe Pose Landmarker lifecycle. Raw results are converted to `PoseFrame` immediately and stored in a mutable ref.
- React receives only tracking-state changes and diagnostics throttled to 2.5 Hz; landmark drawing runs directly on a canvas animation loop.
- Calibration samples a stable neutral pose into a `CalibrationProfile`. `SkeletonMapper` converts subsequent landmark directions into quaternion deltas without React state updates per frame.
- The model controller auto-detects exact bone aliases, preserves rest rotations, converts world-space deltas into each bone's parent space, and applies frame-rate-independent quaternion smoothing.
- Phase 4 keeps pose data unmirrored while mirroring only camera/cursor presentation. Calibrated hip-center deltas drive restrained, clamped, smoothed model-root translation.
- Exhibition mode removes developer chrome while preserving camera startup and recalibration; keyboard fallbacks are `D` debug, `A` avatar, and `C` recalibrate.

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

## Completed phases

- Phase 1 — Foundation + GLB: complete.
- Checks: peer dependencies, TypeScript, ESLint, production build, built-in GLB browser render, controls, local GLB loading, and `/mirror` navigation all pass.
- Phase 2 — Webcam + MediaPipe: complete.
- Checks: TypeScript, ESLint, production build, camera start/stop cleanup, MediaPipe GPU initialization, live inference (~25 FPS), diagnostics, and browser error overlay checks pass.
- Phase 3 — Calibration + Skeleton Mapping: complete.
- Checks: TypeScript, ESLint, production build, WebGL model render, live GPU inference (~25 FPS), 38-frame neutral calibration, auto-mapping, avatar/skeleton debug toggles, and browser error-overlay checks pass.
- Phase 4 — Smart Mirror: complete.
- Checks: TypeScript, ESLint, production build, exact desktop 50/50 split, responsive/exhibition layouts, webcam readiness, GPU inference (~25 FPS), model/avatar isolation, debug controls, hand selection, keyboard controls, and browser console/error-overlay checks pass.

## Bone mappings

- Runtime mapping uses normalized exact aliases and never silently fuzzy-matches a rig.
- The built-in demo resolves 15/17 semantic bones. Every required motion bone resolves; optional `Spine` and `Chest` remain unresolved because their GLB nodes are not bones.
- Rig-specific overrides belong in `MANUAL_BONE_MAP` in `src/config/boneMap.ts`.

## Unresolved issues

- No production CLO/Blender garment GLB has been supplied or validated yet.
- Drei/R3F currently emits a harmless Three.js `Clock` deprecation warning from dependency code; revisit during Phase 9 hardening.
- MediaPipe emits internal WebGL/projection warnings while inference remains operational; revisit during Phase 9 hardening.
- Automated browser runs completed calibration in Phase 3, but sustained full-body movement was not available long enough to visually validate every limb axis and the full root-translation range; confirm with a fully visible standing subject before exhibition use.
- Next phase: Phase 5 — Cross-Window System.
