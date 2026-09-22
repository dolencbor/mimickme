import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  Bone,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Scene,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.({ target: this });
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.({ target: this });
    });
  }
}

globalThis.FileReader ??= NodeFileReader;

function makeSkeleton() {
  const hips = new Bone(); hips.name = "Hips"; hips.position.y = 0.9;
  const spine = new Bone(); spine.name = "Spine"; spine.position.y = 0.35; hips.add(spine);
  const chest = new Bone(); chest.name = "Chest"; chest.position.y = 0.35; spine.add(chest);
  const neck = new Bone(); neck.name = "Neck"; neck.position.y = 0.32; chest.add(neck);
  const head = new Bone(); head.name = "Head"; head.position.y = 0.2; neck.add(head);

  const leftArm = new Bone(); leftArm.name = "Left_Arm"; leftArm.position.set(0.25, 0.22, 0); chest.add(leftArm);
  const leftForeArm = new Bone(); leftForeArm.name = "Left_ForeArm"; leftForeArm.position.x = 0.42; leftArm.add(leftForeArm);
  const leftHand = new Bone(); leftHand.name = "Left_Hand"; leftHand.position.x = 0.38; leftForeArm.add(leftHand);
  const rightArm = new Bone(); rightArm.name = "Right_Arm"; rightArm.position.set(-0.25, 0.22, 0); chest.add(rightArm);
  const rightForeArm = new Bone(); rightForeArm.name = "Right_ForeArm"; rightForeArm.position.x = -0.42; rightArm.add(rightForeArm);
  const rightHand = new Bone(); rightHand.name = "Right_Hand"; rightHand.position.x = -0.38; rightForeArm.add(rightHand);

  const leftLeg = new Bone(); leftLeg.name = "Left_UpperLeg"; leftLeg.position.set(0.15, -0.05, 0); hips.add(leftLeg);
  const leftLowerLeg = new Bone(); leftLowerLeg.name = "Left_LowerLeg"; leftLowerLeg.position.y = -0.62; leftLeg.add(leftLowerLeg);
  const leftFoot = new Bone(); leftFoot.name = "Left_Foot"; leftFoot.position.set(0, -0.58, 0.08); leftLowerLeg.add(leftFoot);
  const rightLeg = new Bone(); rightLeg.name = "Right_UpperLeg"; rightLeg.position.set(-0.15, -0.05, 0); hips.add(rightLeg);
  const rightLowerLeg = new Bone(); rightLowerLeg.name = "Right_LowerLeg"; rightLowerLeg.position.y = -0.62; rightLeg.add(rightLowerLeg);
  const rightFoot = new Bone(); rightFoot.name = "Right_Foot"; rightFoot.position.set(0, -0.58, 0.08); rightLowerLeg.add(rightFoot);

  return { root: hips, bones: [hips, spine, chest, neck, head, leftArm, leftForeArm, leftHand, rightArm, rightForeArm, rightHand, leftLeg, leftLowerLeg, leftFoot, rightLeg, rightLowerLeg, rightFoot] };
}

function skinnedMesh(name, geometry, material, skeletonData, boneIndex) {
  const positionCount = geometry.attributes.position.count;
  const skinIndices = [];
  const skinWeights = [];
  for (let index = 0; index < positionCount; index += 1) {
    skinIndices.push(boneIndex, 0, 0, 0);
    skinWeights.push(1, 0, 0, 0);
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4));
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = name;
  mesh.add(skeletonData.root);
  mesh.bind(new Skeleton(skeletonData.bones));
  return mesh;
}

const scene = new Scene();
scene.name = "DemoRiggedGarmentScene";
const avatarSkeleton = makeSkeleton();
const avatar = skinnedMesh(
  "Avatar_Body",
  new CylinderGeometry(0.28, 0.22, 1.45, 16),
  new MeshStandardMaterial({ color: new Color("#6f7278"), roughness: 0.8 }),
  avatarSkeleton,
  0,
);
avatar.position.y = 0.7;
scene.add(avatar);

const garmentSkeleton = makeSkeleton();
const garment = skinnedMesh(
  "Garment_Coat",
  new BoxGeometry(0.76, 1.0, 0.34, 3, 6, 2),
  new MeshStandardMaterial({ color: new Color("#d9e4ff"), roughness: 0.55, metalness: 0.05 }),
  garmentSkeleton,
  0,
);
garment.position.y = 0.9;
scene.add(garment);

const exporter = new GLTFExporter();
const binary = await new Promise((resolveExport, reject) => {
  exporter.parse(scene, resolveExport, reject, { binary: true, onlyVisible: true });
});
if (!(binary instanceof ArrayBuffer)) throw new Error("Expected a binary GLB export.");

const output = resolve("public/models/demo-rigged.glb");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(binary));
console.log(`Wrote ${output}`);
