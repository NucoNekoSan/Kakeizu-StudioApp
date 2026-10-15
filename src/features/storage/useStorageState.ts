import { useSyncExternalStore } from "react";
import {
  isStorageFallback,
  storageStateSnapshot,
  subscribeStorageState,
} from "../../storage/localApi";
import { readStorageMode } from "../../storage/storageMode";

export function useStorageState() {
  useSyncExternalStore(subscribeStorageState, storageStateSnapshot);
  return { mode: readStorageMode(), fallback: isStorageFallback() };
}
