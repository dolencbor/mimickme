import type { ModelSource } from "./types";

const DB_NAME = "fashion-mirror-models";
const DB_VERSION = 1;
const STORE_NAME = "models";
const ACTIVE_MODEL_KEY = "fashion-mirror-active-model-v1";

export const BUILT_IN_MODEL_CONFIG: ModelConfiguration = {
  id: "mimickme-avatar-v2",
  label: "MimickMe exhibition avatar",
  kind: "built-in",
  url: "/models/mimickme-avatar.glb?v=2",
};

export type ModelConfiguration = {
  id: string;
  label: string;
  kind: "built-in" | "local";
  url?: string;
};

type StoredLocalModel = ModelConfiguration & {
  kind: "local";
  blob: Blob;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local model storage."));
  });
}

function completeTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local model storage failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local model storage was cancelled."));
  });
}

export function setActiveModelConfiguration(configuration: ModelConfiguration) {
  localStorage.setItem(ACTIVE_MODEL_KEY, JSON.stringify(configuration));
}

export function getActiveModelConfiguration(): ModelConfiguration {
  try {
    const stored = localStorage.getItem(ACTIVE_MODEL_KEY);
    if (!stored) return BUILT_IN_MODEL_CONFIG;
    const parsed = JSON.parse(stored) as ModelConfiguration;
    if (!parsed.id || !parsed.label || !parsed.kind) return BUILT_IN_MODEL_CONFIG;
    if (parsed.kind === "built-in") return BUILT_IN_MODEL_CONFIG;
    return parsed;
  } catch {
    return BUILT_IN_MODEL_CONFIG;
  }
}

export async function storeLocalModel(file: File): Promise<ModelConfiguration> {
  const configuration: ModelConfiguration & { kind: "local" } = {
    id: `${file.name}-${file.lastModified}-${file.size}`,
    label: file.name,
    kind: "local",
  };
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put({ ...configuration, blob: file } satisfies StoredLocalModel);
  await completeTransaction(transaction);
  database.close();
  setActiveModelConfiguration(configuration);
  return configuration;
}

export async function resolveModelSource(configuration = getActiveModelConfiguration()): Promise<ModelSource> {
  if (configuration.kind === "built-in") {
    return { ...BUILT_IN_MODEL_CONFIG } as ModelSource;
  }

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).get(configuration.id);
  const stored = await new Promise<StoredLocalModel | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as StoredLocalModel | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local model."));
  });
  database.close();
  if (!stored?.blob) throw new Error(`Local model “${configuration.label}” is unavailable in this browser.`);
  return { id: configuration.id, label: configuration.label, kind: "local", url: URL.createObjectURL(stored.blob) };
}

export function modelConfigurationFromSource(source: ModelSource): ModelConfiguration {
  return {
    id: source.id,
    label: source.label,
    kind: source.kind,
    ...(source.kind === "built-in" ? { url: source.url } : {}),
  };
}
