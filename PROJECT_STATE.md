# Project State

## Architecture

- Next.js 16 App Router application with React 19, TypeScript, Three.js, React Three Fiber, and Drei.
- `/` owns model selection, validation, inspection, and the Phase 1 viewer; `/mirror` and `/hologram` are route placeholders.
- Local `.glb` files use a short-lived object URL and never leave the browser.
- Pure model inspection lives outside the R3F viewer; transient 3D controls update the cloned Three.js scene directly.

## Important files

- `src/app/` — routes and global styles.
- `src/components/model/` — GLB loading, error boundary, inspection, and viewer UI.
- `src/lib/model/inspectModel.ts` — pure scene validation and name-based avatar/garment classification.
- `public/models/demo-rigged.glb` — generated built-in development asset.
- `scripts/generate-demo-model.mjs` — repeatable demo-asset generator.

## Completed phases

- Phase 1 — Foundation + GLB: complete.
- Checks: peer dependencies, TypeScript, ESLint, production build, built-in GLB browser render, controls, local GLB loading, and `/mirror` navigation all pass.

## Bone mappings

- Runtime mapping is intentionally deferred to Phase 3.
- Demo asset exposes: `Hips`, `Spine`, `Chest`, `Neck`, `Head`, left/right `Arm`, `ForeArm`, `Hand`, `UpperLeg`, `LowerLeg`, and `Foot` names.

## Unresolved issues

- No production CLO/Blender garment GLB has been supplied or validated yet.
- Drei/R3F currently emits a harmless Three.js `Clock` deprecation warning from dependency code; revisit during Phase 9 hardening.
- Next phase: Phase 2 — Webcam + MediaPipe.
