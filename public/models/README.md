# Model assets

`mimickme-avatar.glb` is the canonical exhibition asset, cleaned from the supplied
`TEST_1-blender_export.glb`. It retains the FV2.1 mannequin's 88-bone hierarchy,
separate skinned avatar and garment meshes, and exact bone names while excluding
the source-backup garment that was accidentally present in the supplied export.

Future designs may change garment geometry and materials but must preserve the
avatar hierarchy documented in `src/config/boneMap.ts`. `demo-rigged.glb` remains
only as the small generated development fixture for `npm run generate:demo-model`.
