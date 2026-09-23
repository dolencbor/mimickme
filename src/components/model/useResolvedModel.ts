"use client";

import { useEffect, useState } from "react";
import {
  BUILT_IN_MODEL_CONFIG,
  resolveModelSource,
  type ModelConfiguration,
} from "@/lib/model/modelStorage";
import type { ModelSource } from "@/lib/model/types";

export function useResolvedModel(configuration: ModelConfiguration) {
  const [source, setSource] = useState<ModelSource>({ ...BUILT_IN_MODEL_CONFIG } as ModelSource);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    resolveModelSource(configuration)
      .then((resolved) => {
        if (!active) {
          if (resolved.kind === "local") URL.revokeObjectURL(resolved.url);
          return;
        }
        if (resolved.kind === "local") objectUrl = resolved.url;
        setSource(resolved);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "The selected model could not be loaded.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [configuration]);

  return { source, error };
}
