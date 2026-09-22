# Project State

## Architecture

- Next.js 16 App Router application with React 19, TypeScript, Three.js, React Three Fiber, and Drei.
- `/` owns model selection, validation, inspection, and the Phase 1 viewer; `/mirror` and `/hologram` are route placeholders.
- Local `.glb` files use a short-lived object URL and never leave the browser.
- Pure model inspection lives outside the R3F viewer; transient 3D controls update the cloned Three.js scene directly.
- `/mirror` owns the webcam and MediaPipe Pose Landmarker lifecycle. Raw results are converted to `PoseFrame` immediately and stored in a mutable ref.
- React receives only tracking-state changes and diagnostics throttled to 2.5 Hz; landmark drawing runs directly on a canvas animation loop.

## Important files

- `src/app/` — routes and global styles.
- `src/components/model/` — GLB loading, error boundary, inspection, and viewer UI.
- `src/lib/model/inspectModel.ts` — pure scene validation and name-based avatar/garment classification.
- `public/models/demo-rigged.glb` — generated built-in development asset.
- `scripts/generate-demo-model.mjs` — repeatable demo-asset generator.
- `src/components/tracking/` — webcam lifecycle, MediaPipe runner, debug canvas, and tracking UI.
- `src/lib/tracking/` — MediaPipe-independent pose types, processor, and explicit tracking state machine.
- `src/config/tracking.ts` — confidence, timing, inference, WASM, and model configuration.

## Completed phases

- Phase 1 — Foundation + GLB: complete.
- Checks: peer dependencies, TypeScript, ESLint, production build, built-in GLB browser render, controls, local GLB loading, and `/mirror` navigation all pass.
- Phase 2 — Webcam + MediaPipe: complete.
- Checks: TypeScript, ESLint, production build, camera start/stop cleanup, MediaPipe GPU initialization, live inference (~25 FPS), diagnostics, and browser error overlay checks pass.

## Bone mappings

- Runtime mapping is intentionally deferred to Phase 3.
- Demo asset exposes: `Hips`, `Spine`, `Chest`, `Neck`, `Head`, left/right `Arm`, `ForeArm`, `Hand`, `UpperLeg`, `LowerLeg`, and `Foot` names.

## Unresolved issues

- No production CLO/Blender garment GLB has been supplied or validated yet.
- Drei/R3F currently emits a harmless Three.js `Clock` deprecation warning from dependency code; revisit during Phase 9 hardening.
- MediaPipe emits internal WebGL/projection warnings while inference remains operational; revisit during Phase 9 hardening.
- A person was not centered in the automated webcam frame, so human-in-frame landmark placement needs a quick physical confirmation.
- Next phase: Phase 3 — Calibration + Skeleton Mapping.
