import {
  BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  SkinnedMesh,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import { isGarmentMeshName } from "@/lib/model/inspectModel";
import { createBodyColliders, updateBodyColliders, type CapsuleCollider } from "./ClothCollisions";
import { deriveClothAttachment } from "./ClothInfluence";
import { COTTON_PRESET, type ClothSettings } from "./ClothMaterialPresets";

type ConstraintSet = { pairs: Int32Array; targetLengths: Float32Array };

function buildConstraints(mesh: SkinnedMesh) {
  const index = mesh.geometry.getIndex();
  if (!index) return { stretch: { pairs: new Int32Array(), targetLengths: new Float32Array() }, bend: { pairs: new Int32Array(), targetLengths: new Float32Array() } };
  const edges = new Map<string, { a: number; b: number; opposite: number[] }>();
  const values = index.array;
  for (let cursor = 0; cursor < values.length; cursor += 3) {
    const a = values[cursor];
    const b = values[cursor + 1];
    const c = values[cursor + 2];
    for (const [left, right, opposite] of [[a, b, c], [b, c, a], [c, a, b]] as const) {
      const low = Math.min(left, right);
      const high = Math.max(left, right);
      const key = `${low}:${high}`;
      const existing = edges.get(key);
      if (existing) existing.opposite.push(opposite);
      else edges.set(key, { a: low, b: high, opposite: [opposite] });
    }
  }

  const stretchPairs = new Int32Array(edges.size * 2);
  const bend: number[] = [];
  let pair = 0;
  for (const edge of edges.values()) {
    stretchPairs[pair * 2] = edge.a;
    stretchPairs[pair * 2 + 1] = edge.b;
    pair += 1;
    if (edge.opposite.length === 2) bend.push(edge.opposite[0], edge.opposite[1]);
  }
  return {
    stretch: { pairs: stretchPairs, targetLengths: new Float32Array(edges.size) },
    bend: { pairs: Int32Array.from(bend), targetLengths: new Float32Array(bend.length / 2) },
  };
}

function patchMaterial(material: Material) {
  const patched = material.clone();
  if (!(patched instanceof MeshStandardMaterial)) return patched;
  patched.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 clothOffset;")
      .replace("#include <skinning_vertex>", "#include <skinning_vertex>\ntransformed += clothOffset;");
  };
  patched.customProgramCacheKey = () => "mimickme-cloth-offset-v1";
  patched.needsUpdate = true;
  return patched;
}

class GarmentSimulation {
  readonly attachment: Float32Array;
  private settings: ClothSettings = { ...COTTON_PRESET };
  private readonly mesh: SkinnedMesh;
  private readonly rest: Float32Array;
  private readonly positions: Float32Array;
  private readonly previous: Float32Array;
  private readonly targets: Float32Array;
  private readonly targetLocal: Float32Array;
  private readonly offsets: Float32Array;
  private readonly stretch: ConstraintSet;
  private readonly bend: ConstraintSet;
  private readonly colliders: CapsuleCollider[];
  private initialized = false;
  private failed = false;
  private readonly base = new Vector3();
  private readonly accumulated = new Vector3();
  private readonly transformed = new Vector3();
  private readonly desiredLocal = new Vector3();
  private readonly boneMatrix = new Matrix4();
  private readonly worldInverse = new Matrix4();
  private readonly originalMaterials: Material[];

  constructor(mesh: SkinnedMesh) {
    this.mesh = mesh;
    this.mesh.geometry = mesh.geometry.clone();
    const position = this.mesh.geometry.getAttribute("position");
    this.rest = new Float32Array(position.count * 3);
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const offset = vertex * 3;
      this.rest[offset] = position.getX(vertex);
      this.rest[offset + 1] = position.getY(vertex);
      this.rest[offset + 2] = position.getZ(vertex);
    }
    this.positions = new Float32Array(position.count * 3);
    this.previous = new Float32Array(position.count * 3);
    this.targets = new Float32Array(position.count * 3);
    this.targetLocal = new Float32Array(position.count * 3);
    this.offsets = new Float32Array(position.count * 3);
    this.mesh.geometry.setAttribute("clothOffset", new BufferAttribute(this.offsets, 3));
    this.attachment = deriveClothAttachment(this.mesh);
    this.mesh.geometry.setAttribute("clothInfluence", new BufferAttribute(Float32Array.from(this.attachment, (value) => 1 - value), 1));
    const constraints = buildConstraints(this.mesh);
    this.stretch = constraints.stretch;
    this.bend = constraints.bend;
    this.colliders = createBodyColliders(this.mesh.skeleton.bones);
    this.originalMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
    const patched = this.originalMaterials.map(patchMaterial);
    this.mesh.material = Array.isArray(mesh.material) ? patched : patched[0];
  }

  setSettings(settings: ClothSettings) {
    this.settings = settings;
    if (!settings.enabled) this.clearOffsets();
  }

  private skinVertex(vertex: number, target: Vector3) {
    const skinIndex = this.mesh.geometry.getAttribute("skinIndex");
    const skinWeight = this.mesh.geometry.getAttribute("skinWeight");
    const offset = vertex * 3;
    this.base.set(this.rest[offset], this.rest[offset + 1], this.rest[offset + 2]).applyMatrix4(this.mesh.bindMatrix);
    target.set(0, 0, 0);
    for (let influence = 0; influence < 4; influence += 1) {
      const weight = skinWeight.getComponent(vertex, influence);
      if (weight <= 0) continue;
      const boneIndex = skinIndex.getComponent(vertex, influence);
      this.boneMatrix.fromArray(this.mesh.skeleton.boneMatrices!, boneIndex * 16);
      this.transformed.copy(this.base).applyMatrix4(this.boneMatrix).multiplyScalar(weight);
      target.add(this.transformed);
    }
    return target.applyMatrix4(this.mesh.bindMatrixInverse);
  }

  private updateTargets() {
    this.mesh.skeleton.update();
    for (let vertex = 0; vertex < this.attachment.length; vertex += 1) {
      const offset = vertex * 3;
      this.skinVertex(vertex, this.accumulated);
      this.targetLocal[offset] = this.accumulated.x;
      this.targetLocal[offset + 1] = this.accumulated.y;
      this.targetLocal[offset + 2] = this.accumulated.z;
      this.accumulated.applyMatrix4(this.mesh.matrixWorld);
      this.targets[offset] = this.accumulated.x;
      this.targets[offset + 1] = this.accumulated.y;
      this.targets[offset + 2] = this.accumulated.z;
    }
  }

  private updateTargetLengths(constraints: ConstraintSet) {
    const pairs = constraints.pairs;
    for (let pair = 0; pair < constraints.targetLengths.length; pair += 1) {
      const a = pairs[pair * 2] * 3;
      const b = pairs[pair * 2 + 1] * 3;
      const x = this.targets[b] - this.targets[a];
      const y = this.targets[b + 1] - this.targets[a + 1];
      const z = this.targets[b + 2] - this.targets[a + 2];
      constraints.targetLengths[pair] = Math.hypot(x, y, z);
    }
  }

  private solve(constraints: ConstraintSet, stiffness: number) {
    const pairs = constraints.pairs;
    for (let pair = 0; pair < constraints.targetLengths.length; pair += 1) {
      const vertexA = pairs[pair * 2];
      const vertexB = pairs[pair * 2 + 1];
      const a = vertexA * 3;
      const b = vertexB * 3;
      const x = this.positions[b] - this.positions[a];
      const y = this.positions[b + 1] - this.positions[a + 1];
      const z = this.positions[b + 2] - this.positions[a + 2];
      const distance = Math.hypot(x, y, z);
      if (distance < 1e-7) continue;
      const inverseMassA = Math.max(0.03, 1 - this.attachment[vertexA] * 0.96);
      const inverseMassB = Math.max(0.03, 1 - this.attachment[vertexB] * 0.96);
      const correction = ((distance - constraints.targetLengths[pair]) / distance) * stiffness;
      const weight = inverseMassA + inverseMassB;
      const scaleA = correction * inverseMassA / weight;
      const scaleB = correction * inverseMassB / weight;
      this.positions[a] += x * scaleA;
      this.positions[a + 1] += y * scaleA;
      this.positions[a + 2] += z * scaleA;
      this.positions[b] -= x * scaleB;
      this.positions[b + 1] -= y * scaleB;
      this.positions[b + 2] -= z * scaleB;
    }
  }

  private solveAttachments(deltaSeconds: number) {
    for (let vertex = 0; vertex < this.attachment.length; vertex += 1) {
      const offset = vertex * 3;
      const attachment = this.attachment[vertex];
      const rate = this.settings.attachmentStrength * (2 + 42 * attachment * attachment);
      const follow = 1 - Math.exp(-rate * deltaSeconds);
      this.positions[offset] += (this.targets[offset] - this.positions[offset]) * follow;
      this.positions[offset + 1] += (this.targets[offset + 1] - this.positions[offset + 1]) * follow;
      this.positions[offset + 2] += (this.targets[offset + 2] - this.positions[offset + 2]) * follow;
    }
  }

  private solveCollisions() {
    const thickness = this.settings.collisionThickness;
    for (let vertex = 0; vertex < this.attachment.length; vertex += 1) {
      const offset = vertex * 3;
      let px = this.positions[offset];
      let py = this.positions[offset + 1];
      let pz = this.positions[offset + 2];
      let collided = false;
      for (const collider of this.colliders) {
        const abx = collider.end.x - collider.start.x;
        const aby = collider.end.y - collider.start.y;
        const abz = collider.end.z - collider.start.z;
        const lengthSq = abx * abx + aby * aby + abz * abz;
        const apx = px - collider.start.x;
        const apy = py - collider.start.y;
        const apz = pz - collider.start.z;
        const t = lengthSq > 1e-8 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / lengthSq)) : 0;
        const cx = collider.start.x + abx * t;
        const cy = collider.start.y + aby * t;
        const cz = collider.start.z + abz * t;
        const dx = px - cx;
        const dy = py - cy;
        const dz = pz - cz;
        const distance = Math.hypot(dx, dy, dz);
        const radius = collider.radius + thickness;
        if (distance > 1e-7 && distance < radius) {
          collided = true;
          const push = (radius - distance) / distance;
          px += dx * push;
          py += dy * push;
          pz += dz * push;
        }
      }
      this.positions[offset] = px;
      this.positions[offset + 1] = py;
      this.positions[offset + 2] = pz;
      if (collided) {
        const friction = this.settings.collisionFriction;
        this.previous[offset] += (px - this.previous[offset]) * friction;
        this.previous[offset + 1] += (py - this.previous[offset + 1]) * friction;
        this.previous[offset + 2] += (pz - this.previous[offset + 2]) * friction;
      }
    }
  }

  step(deltaSeconds: number) {
    if (this.failed || !this.settings.enabled) return;
    try {
      const delta = Math.min(1 / 30, Math.max(1 / 240, deltaSeconds));
      this.updateTargets();
      updateBodyColliders(this.mesh.skeleton.bones, this.colliders);
      this.updateTargetLengths(this.stretch);
      this.updateTargetLengths(this.bend);
      if (!this.initialized) {
        this.positions.set(this.targets);
        this.previous.set(this.targets);
        this.initialized = true;
      }

      const drag = Math.max(0, 1 - (this.settings.damping + this.settings.airDrag) / Math.sqrt(Math.max(0.1, this.settings.mass)));
      const gravity = -9.81 * this.settings.gravityScale * delta * delta;
      for (let offset = 0; offset < this.positions.length; offset += 3) {
        const x = this.positions[offset];
        const y = this.positions[offset + 1];
        const z = this.positions[offset + 2];
        this.positions[offset] += (x - this.previous[offset]) * drag;
        this.positions[offset + 1] += (y - this.previous[offset + 1]) * drag + gravity;
        this.positions[offset + 2] += (z - this.previous[offset + 2]) * drag;
        this.previous[offset] = x;
        this.previous[offset + 1] = y;
        this.previous[offset + 2] = z;
      }

      for (let iteration = 0; iteration < this.settings.constraintIterations; iteration += 1) {
        this.solveAttachments(delta);
        this.solve(this.stretch, this.settings.stretchStiffness);
        this.solve(this.bend, this.settings.bendStiffness);
        this.solveCollisions();
      }

      this.worldInverse.copy(this.mesh.matrixWorld).invert();
      for (let vertex = 0; vertex < this.attachment.length; vertex += 1) {
        const offset = vertex * 3;
        this.desiredLocal
          .set(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2])
          .applyMatrix4(this.worldInverse);
        this.offsets[offset] = this.desiredLocal.x - this.targetLocal[offset];
        this.offsets[offset + 1] = this.desiredLocal.y - this.targetLocal[offset + 1];
        this.offsets[offset + 2] = this.desiredLocal.z - this.targetLocal[offset + 2];
      }
      (this.mesh.geometry.getAttribute("clothOffset") as BufferAttribute).needsUpdate = true;
    } catch (error) {
      console.warn(`Cloth simulation disabled for ${this.mesh.name}.`, error);
      this.failed = true;
      this.clearOffsets();
    }
  }

  private clearOffsets() {
    this.offsets.fill(0);
    const attribute = this.mesh.geometry.getAttribute("clothOffset") as BufferAttribute;
    attribute.needsUpdate = true;
    this.initialized = false;
  }

  dispose() {
    const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
    materials.forEach((material) => material.dispose());
    this.mesh.material = this.originalMaterials.length === 1 ? this.originalMaterials[0] : this.originalMaterials;
    this.mesh.geometry.dispose();
  }
}

export class ClothSimulation {
  private readonly garments: GarmentSimulation[] = [];

  constructor(root: Object3D) {
    root.traverse((object) => {
      if (!(object instanceof SkinnedMesh) || !isGarmentMeshName(object.name)) return;
      if (!object.geometry.getAttribute("skinIndex") || !object.geometry.getAttribute("skinWeight")) return;
      this.garments.push(new GarmentSimulation(object));
    });
  }

  get active() {
    return this.garments.length > 0;
  }

  setSettings(settings: ClothSettings) {
    this.garments.forEach((garment) => garment.setSettings(settings));
  }

  step(deltaSeconds: number) {
    this.garments.forEach((garment) => garment.step(deltaSeconds));
  }

  dispose() {
    this.garments.forEach((garment) => garment.dispose());
  }
}
