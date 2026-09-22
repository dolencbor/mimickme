export type ModelIssue = {
  level: "error" | "warning";
  message: string;
};

export type ModelReport = {
  objectNames: string[];
  meshNames: string[];
  skinnedMeshNames: string[];
  avatarMeshNames: string[];
  garmentMeshNames: string[];
  boneNames: string[];
  skeletonCount: number;
  issues: ModelIssue[];
};

export type ModelSource = {
  id: string;
  label: string;
  url: string;
  kind: "built-in" | "local";
};
