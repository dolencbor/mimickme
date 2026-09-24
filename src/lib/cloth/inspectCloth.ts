import { Box3, Object3D, SkinnedMesh } from "three";
import { isGarmentMeshName } from "@/lib/model/inspectModel";

type ClothDiagnostic = {
  valid: boolean;
  meshes: number;
  vertices: number;
  materials: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
};

const loggedUrls = new Set<string>();

export function inspectRuntimeCloth(root: Object3D): ClothDiagnostic {
  const clothMeshes: SkinnedMesh[] = [];
  const materialNames = new Set<string>();
  const bounds = new Box3();
  let hasBounds = false;
  let vertices = 0;
  let valid = true;

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof SkinnedMesh) || !isGarmentMeshName(object.name)) return;
    clothMeshes.push(object);
    const position = object.geometry.getAttribute("position");
    const skinIndex = object.geometry.getAttribute("skinIndex");
    const skinWeight = object.geometry.getAttribute("skinWeight");
    vertices += position?.count ?? 0;
    valid &&= Boolean(object.skeleton && position && skinIndex && skinWeight);

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => materialNames.add(material.name || "unnamed"));

    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) {
      bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      hasBounds = true;
    }
  });

  valid &&= clothMeshes.length > 0;
  return {
    valid,
    meshes: clothMeshes.length,
    vertices,
    materials: [...materialNames],
    bounds: hasBounds
      ? { min: bounds.min.toArray(), max: bounds.max.toArray() }
      : null,
  };
}

export function logRuntimeClothDiagnostic(root: Object3D, url: string) {
  if (process.env.NODE_ENV !== "development" || loggedUrls.has(url)) return;
  loggedUrls.add(url);
  console.info("[MimickMe cloth]", inspectRuntimeCloth(root));
}
