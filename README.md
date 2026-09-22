# mimickme

**A real-time digital fashion smart mirror and holographic garment experience.**

mimickme uses computer vision and skeletal tracking to translate a person's movements onto a digital garment in real time. A single webcam tracks the visitor while a rigged 3D garment mimics their movement, creating an interactive bridge between the physical body and digital fashion.

The project is being developed as an exhibition prototype for the Master Digital Design programme at the Amsterdam University of Applied Sciences.

## Concept

The experience consists of two connected outputs.

### Smart Mirror

A visitor stands in front of a webcam.

The interface shows:

- the live camera feed on one side;
- the digital avatar or garment on the other;
- real-time movement translated from the visitor to the 3D model.

The physical person acts as the input while the digital garment becomes their virtual counterpart.

### Hologram

The smart mirror can open a dedicated hologram output on a second display.

The same animated garment is rendered simultaneously from four virtual camera angles:

```text
              FRONT

        LEFT         RIGHT

               BACK
```

These views are designed for a four-sided Pepper's Ghost display, creating the illusion of a three-dimensional digital garment.

Only one physical webcam is required. The four holographic perspectives are generated from the same 3D scene.

## How it works

```text
Webcam
   ↓
MediaPipe Pose Tracking
   ↓
Body landmarks
   ↓
Pose processing
   ↓
Skeleton mapping
   ↓
Three.js armature
   ↓
Rigged 3D garment
   ↓
   ├── Smart Mirror
   │
   └── Four-view Hologram
```

The visitor's body is never required as part of the holographic output. It is used only as the real-time input controlling the digital skeleton.

## 3D garment workflow

Garments are created in **CLO 3D** and prepared for real-time rendering in **Blender**.

```text
CLO 3D
   ↓
Blender
   ↓
Rig + optimize
   ↓
GLB
   ↓
mimickme
```

The final GLB contains:

- humanoid armature;
- skinned garment;
- optional skinned avatar;
- optimized real-time materials.

The avatar and garment remain separate, allowing the avatar to be hidden while the garment continues responding to the skeleton.

## Technology

- Next.js
- React
- TypeScript
- Three.js
- React Three Fiber
- MediaPipe Pose Landmarker
- WebGL
- BroadcastChannel API
- Blender
- CLO 3D
- Vercel

## Tracking

A standard webcam is used for body tracking.

MediaPipe detects the visitor's body landmarks and converts them into pose information. The application maps these movements to the humanoid skeleton controlling the garment.

Movement is smoothed and translated into skeletal rotations rather than directly copying landmark positions.

## Hologram idle state

When nobody is being tracked, the garment enters an ambient idle state:

- slow rotation around its vertical axis;
- subtle sinusoidal vertical movement.

When a visitor is detected, the idle animation transitions into real-time body tracking.

When tracking is lost, the garment gradually returns to its idle state.

## Project status

mimickme is currently an experimental exhibition prototype.

Current development focuses on:

- GLB garment loading;
- webcam body tracking;
- real-time skeletal animation;
- smart mirror interaction;
- four-direction hologram rendering;
- responsive Pepper's Ghost output;
- exhibition calibration.

Real-time cloth physics and automatic garment fitting are currently outside the scope of the prototype.

## Running locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

Camera access must be allowed in the browser.

## Model requirements

For real-time skeletal tracking, imported GLB files should contain:

- a humanoid armature;
- a skinned garment;
- normalized vertex weights;
- a maximum of approximately four bone influences per vertex;
- separate garment and avatar meshes where applicable;
- web-optimized geometry and materials.

Static OBJ files are not suitable for the real-time skeletal workflow without additional rigging.

## Deployment

The application is designed to be deployable through Vercel.

Production deployment requires HTTPS for browser camera access.

## Project

Master Digital Design  
Interaction Design  
Amsterdam University of Applied Sciences  
2026

## Author

Bor Dolenc
