# mimickme

## What the project is

mimickme is an exhibition prototype that maps one visitor's webcam-tracked body movement onto a rigged digital garment. The smart-mirror route owns MediaPipe tracking; a separate four-view Pepper's Ghost output receives processed skeletal motion through `BroadcastChannel` and does not access the camera.

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer
- A WebGL-capable computer and webcam
- A modern browser with camera, WebGL, IndexedDB, and `BroadcastChannel` support

## Install

```bash
pnpm install --frozen-lockfile
```

## Dev

```bash
pnpm dev
```

Open `http://localhost:3000`. Model setup is at `/`, tracking is at `/mirror`, and the Pepper's Ghost output is at `/hologram`.

## Build

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm start
```

## Model requirements

Use a web-optimized binary `.glb` containing a humanoid armature and skinned garment. Keep garment and avatar meshes separate when the avatar must be hidden. Use normalized weights, approximately four influences per vertex, compact textures/materials, and bone names matching `src/config/boneMap.ts` or its manual overrides. Static OBJ files cannot receive skeletal tracking without rigging.

## How to use

1. Select the built-in demo or load a local `.glb` on `/`.
2. Open `/mirror`, start the camera, stand fully in frame, and hold a neutral pose until calibration completes.
3. Choose **Make it a hologram** to open the synchronized output window.
4. Use **F** for fullscreen and **K** for the hidden hologram calibration panel.
5. Adjust scale, offsets, camera distance, view size, rotations, and flips against the physical display. Calibration persists in that browser.

Debug shortcuts on the mirror are **D** for diagnostics, **A** for avatar visibility, and **C** to recalibrate. Webcam frames and locally loaded models remain in the browser.

## Deployment

Deploy the repository as a Next.js project on Vercel. No environment variables or server-side services are required. Git-connected deployments build with `pnpm build`; Vercel supplies the HTTPS origin needed for camera access.

## Relevant browser requirements

Camera access works only on HTTPS origins or `localhost` and requires explicit user permission. Allow popups for the separate hologram window. Both windows must use the same origin for `BroadcastChannel`, localStorage, and IndexedDB synchronization. WebGL and hardware acceleration should be enabled; a current Chromium-based browser is recommended for the exhibition installation.
