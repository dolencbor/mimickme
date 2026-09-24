import { Vector3 } from "three";

export type SecondaryClothSettings = {
  gravity: readonly [number, number, number];
  damping: number;
  stiffness: number;
};

const FIXED_STEP_SECONDS = 1 / 60;
const MAX_SUBSTEPS = 4;
const MAX_FRAME_SECONDS = FIXED_STEP_SECONDS * MAX_SUBSTEPS;
const MAX_ACCELERATION = 15;
const MAX_OFFSET_METERS = 0.08;
const INERTIA_SCALE = 0.03;

export class SecondaryClothMotion {
  readonly offset = new Vector3();

  private readonly velocity = new Vector3();
  private readonly previousAnchor = new Vector3();
  private readonly previousAnchorVelocity = new Vector3();
  private readonly anchorVelocity = new Vector3();
  private readonly anchorAcceleration = new Vector3();
  private readonly force = new Vector3();
  private readonly gravity = new Vector3();
  private accumulator = 0;
  private initialized = false;

  reset(anchor?: Vector3) {
    this.offset.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.previousAnchorVelocity.set(0, 0, 0);
    this.accumulator = 0;
    this.initialized = Boolean(anchor);
    if (anchor) this.previousAnchor.copy(anchor);
  }

  update(anchor: Vector3, deltaSeconds: number, settings: SecondaryClothSettings) {
    if (!this.initialized) {
      this.reset(anchor);
      return this.offset;
    }

    const frameSeconds = Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_SECONDS);
    if (frameSeconds === 0) return this.offset;

    this.anchorVelocity.copy(anchor).sub(this.previousAnchor).divideScalar(frameSeconds);
    this.anchorAcceleration
      .copy(this.anchorVelocity)
      .sub(this.previousAnchorVelocity)
      .divideScalar(frameSeconds)
      .clampLength(0, MAX_ACCELERATION);
    this.previousAnchor.copy(anchor);
    this.previousAnchorVelocity.copy(this.anchorVelocity);
    this.gravity.fromArray(settings.gravity);
    this.accumulator = Math.min(this.accumulator + frameSeconds, MAX_FRAME_SECONDS);

    while (this.accumulator >= FIXED_STEP_SECONDS) {
      this.force
        .copy(this.offset)
        .multiplyScalar(-settings.stiffness)
        .addScaledVector(this.velocity, -settings.damping)
        .add(this.gravity)
        .addScaledVector(this.anchorAcceleration, -INERTIA_SCALE);
      this.velocity.addScaledVector(this.force, FIXED_STEP_SECONDS);
      this.offset.addScaledVector(this.velocity, FIXED_STEP_SECONDS);
      if (this.offset.lengthSq() > MAX_OFFSET_METERS * MAX_OFFSET_METERS) {
        this.offset.clampLength(0, MAX_OFFSET_METERS);
        this.velocity.multiplyScalar(0.5);
      }
      this.accumulator -= FIXED_STEP_SECONDS;
    }

    return this.offset;
  }
}
