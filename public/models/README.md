# Model assets

`mimickme-avatar.glb` is the validated exhibition asset installed from the supplied
`hopefully.glb`. It contains one 65-bone Mixamo armature plus separate, normalized,
skinned `body.001` and `Cloth` meshes that share the same skeleton.

Future designs may change garment geometry and materials but must preserve a bone
hierarchy supported by the exact aliases in `src/config/boneMap.ts`. `demo-rigged.glb`
remains only as the small generated development fixture for `npm run generate:demo-model`.
