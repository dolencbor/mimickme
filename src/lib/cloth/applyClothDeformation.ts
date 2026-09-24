import { Material, Object3D, Quaternion, SkinnedMesh, Vector3 } from "three";
import { isGarmentMeshName } from "@/lib/model/inspectModel";

const CLOTH_SHADER_KEY = "mimickme-secondary-cloth-v1";

type ClothBinding = {
  mesh: SkinnedMesh;
  offset: { value: Vector3 };
  influence: { value: number };
};

export class ClothDeformer {
  private readonly bindings: ClothBinding[] = [];
  private readonly ownedMaterials: Material[] = [];
  private readonly inverseWorldQuaternion = new Quaternion();
  private readonly worldScale = new Vector3();
  private readonly localOffset = new Vector3();

  constructor(root: Object3D) {
    root.traverse((object) => {
      if (!(object instanceof SkinnedMesh) || !isGarmentMeshName(object.name)) return;
      this.bindMesh(object);
    });
  }

  get active() {
    return this.bindings.length > 0;
  }

  setWorldOffset(worldOffset: Vector3, influence: number) {
    for (const binding of this.bindings) {
      binding.mesh.getWorldQuaternion(this.inverseWorldQuaternion).invert();
      binding.mesh.getWorldScale(this.worldScale);
      this.localOffset.copy(worldOffset).applyQuaternion(this.inverseWorldQuaternion);
      this.localOffset.set(
        this.worldScale.x === 0 ? 0 : this.localOffset.x / this.worldScale.x,
        this.worldScale.y === 0 ? 0 : this.localOffset.y / this.worldScale.y,
        this.worldScale.z === 0 ? 0 : this.localOffset.z / this.worldScale.z,
      );
      binding.offset.value.copy(this.localOffset);
      binding.influence.value = influence;
    }
  }

  dispose() {
    this.ownedMaterials.forEach((material) => material.dispose());
  }

  private bindMesh(mesh: SkinnedMesh) {
    const offset = { value: new Vector3() };
    const influence = { value: 0 };
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = sourceMaterials.map((sourceMaterial) => {
      const material = sourceMaterial.clone();
      const previousCompile = material.onBeforeCompile;
      const previousCacheKey = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previousCompile.call(material, shader, renderer);
        shader.uniforms.mimickmeClothOffset = offset;
        shader.uniforms.mimickmeClothInfluence = influence;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform vec3 mimickmeClothOffset;\nuniform float mimickmeClothInfluence;",
          )
          .replace(
            "#include <skinning_vertex>",
            "#include <skinning_vertex>\ntransformed += mimickmeClothOffset * mimickmeClothInfluence;",
          );
      };
      material.customProgramCacheKey = () => `${previousCacheKey()}|${CLOTH_SHADER_KEY}`;
      material.needsUpdate = true;
      this.ownedMaterials.push(material);
      return material;
    });

    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    this.bindings.push({ mesh, offset, influence });
  }
}
