export type ClothSettings = {
  enabled: boolean;
  mass: number;
  gravityScale: number;
  damping: number;
  airDrag: number;
  stretchStiffness: number;
  bendStiffness: number;
  attachmentStrength: number;
  constraintIterations: number;
  collisionFriction: number;
  collisionThickness: number;
};

export const COTTON_PRESET: Readonly<ClothSettings> = {
  enabled: true,
  mass: 0.72,
  gravityScale: 0.72,
  damping: 0.075,
  airDrag: 0.025,
  stretchStiffness: 0.82,
  bendStiffness: 0.16,
  attachmentStrength: 0.78,
  constraintIterations: 4,
  collisionFriction: 0.18,
  collisionThickness: 0.012,
};

export function cottonSettings(): ClothSettings {
  return { ...COTTON_PRESET };
}
