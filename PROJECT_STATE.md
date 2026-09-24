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
- Hologram idle motion and tracking takeover run entirely in the R3F frame loop. A reusable `trackingInfluence` ref blends the cached live pose/root from 0–1 while a separate presentation transform handles slow Y rotation and sinusoidal float.
- Tracking takeover lasts 0.75 seconds. Tracking loss holds the last valid pose for 0.9 seconds before blending smoothly back to rest and idle motion; all timings and amplitudes are centralized in `src/config/hologram.ts`.
- Phase 8 adds a hidden `K`-key calibration panel. It adjusts model scale and XYZ offsets, shared camera distance, rendered view size, and each view's rotation/horizontal flip/vertical flip without source edits.
- Hologram calibration uses a validated, clamped, versioned localStorage schema. Changes persist immediately, malformed or outdated data falls back safely, and reset removes the override and restores the Phase 6 orientation table.
- Phase 9 pauses debug and cursor animation loops while their overlays are hidden, stops calibration polling after completion, and avoids starting skeletal animation work until a mapper exists.
- Runtime and type dependencies are pinned to exact versions for reproducible installs. Three.js is pinned to `0.182.0`, the last compatible release before the `Clock` deprecation warning surfaced through React Three Fiber.
- Camera, MediaPipe, object-URL, BroadcastChannel, and animation-frame lifecycles all have explicit cleanup paths. Production camera access is limited to secure contexts (`https://` or localhost).
- The built-in model is the validated FV2.1 production structure. Future clothing/design variants must preserve its 88-bone avatar hierarchy; runtime mapping is pinned to those exact bone names.
- `src/lib/model/modelBounds.ts` handles the FV2.1 export's centimeter skeleton root and already-metered skinned vertices, preventing Three.js CPU bounds from framing the rendered avatar 100× too closely without changing bind matrices.
- All four Pepper's Ghost viewports default to a vertical flip, with the top, left, right, and bottom heads oriented toward their respective outside edges. Calibration storage is versioned to apply the corrected orientation on existing browsers.
- Skeletal motion is confidence-gated per body segment. Visible limbs and torso regions can move independently, while off-camera or low-confidence regions return to their neutral pose until their required landmarks are reliable again; neutral calibration still requires a reliable full-body pose.

## Important files

- `src/app/` — routes and global styles.
- `src/components/model/` — GLB loading, error boundary, inspection, and viewer UI.
- `src/lib/model/inspectModel.ts` — pure scene validation and name-based avatar/garment classification.
- `public/models/mimickme-avatar.glb` — validated canonical exhibition avatar and garment.
- `public/models/demo-rigged.glb` — generated development fixture; no longer the application default.
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
- `src/components/hologram/HologramOutput.tsx`, `FourViewHologram.tsx`, and `HologramMotionController.tsx` — synchronized four-view output, idle/takeover blending, custom camera renderer, and fullscreen control.
- `src/components/hologram/HologramCalibrationPanel.tsx` and `useHologramCalibration.ts` — hidden calibration controls and persistent client state.
- `src/lib/hologram/calibration.ts` — calibration schema, bounds, defaults, validation, persistence, and reset.
- `src/config/hologram.ts` — physical-view orientation, motion, transition, and performance/framing defaults.
- `README.md` — concise setup, model, operation, deployment, and browser requirements.

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
- Phase 7 — Idle + Takeover: complete.
- Checks: TypeScript, ESLint, production build, visible four-view idle transform, separated per-view and shared-motion transforms, mirror connection regression, and browser console/error-overlay checks pass. The transition controller preserves the last tracked pose through the loss delay and blends pose/root influence in both directions without React state updates per frame.
- Phase 8 — Hologram Calibration: complete.
- Checks: TypeScript, ESLint, production build, hidden keyboard toggle, live global/per-view control updates, persistence across reload, complete reset, responsive panel layout, and browser console/error-overlay checks pass.
- Phase 9 — Harden + Deploy: complete.
- Checks: strict unused-symbol TypeScript check, ESLint, diff hygiene, reproducible dependency lock, production build, `next start`, all three routes, cross-window mirror connection, one-canvas/no-video hologram isolation, calibration shortcut, and zero production console warnings or errors all pass.

## Bone mappings

- Runtime mapping uses normalized exact aliases and never silently fuzzy-matches a rig.
- The built-in FV2.1 mannequin resolves all 17 semantic bones through the exact `MANUAL_BONE_MAP` contract in `src/config/boneMap.ts`.
- Canonical mappings include `Pelvis`, `Spine`, `Spine3`, limb names such as `Left_Arm`/`Left_ForeArm`, and ankle bones as semantic feet.

## Unresolved issues

- The supplied production structure has been validated and installed. Its accidental unskinned `Cloth_SOURCE_BACKUP_CURRENT` export was excluded from the clean built-in GLB.
- Automated browser runs completed calibration in Phase 3, but sustained full-body movement was not available long enough to visually validate every limb axis and the full root-translation range; confirm with a fully visible standing subject before exhibition use.
- IndexedDB cross-window support remains available for local compatible GLBs.
- Physical pyramid orientation may require changing the isolated view rotation/flip values during on-site calibration.
- Final full-body validation should confirm the subjective takeover feel and adjust the centralized 0.75-second blend or 0.9-second loss delay if needed in the exhibition space.
- Physical Pepper's Ghost hardware is required for final calibration values; the browser currently stores defaults until adjusted on-site.
- All requested MVP implementation phases are complete. Remaining work is production-model, full-body, and physical-hardware validation.
