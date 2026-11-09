import { useCallback, useSyncExternalStore } from "react";
import {
  PROJECT_FOLDERS_KEY, forgetProjectFolder, normalizeProjectFolder, readProjectFolders, rememberProjectFolder, saveProjectFolders,
} from "@/app/project-folders";

const browserStorage = {
  getItem: (key: string) => globalThis.localStorage.getItem(key),
  setItem: (key: string, value: string) => globalThis.localStorage.setItem(key, value),
};

const SAVE_FAILED = "项目文件夹列表未能保存到本机，重启后不会保留。";

/**
 * One in-page copy of the recent project folders, shared by the sidebar and the
 * composer picker so both show the same list. Other windows update it through
 * the `storage` event.
 */
let snapshot: { folders: string[]; notice: string } | undefined;
const listeners = new Set<() => void>();

function current() {
  snapshot ??= { folders: readProjectFolders(browserStorage), notice: "" };
  return snapshot;
}
function publish(next: { folders: string[]; notice: string }) {
  snapshot = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROJECT_FOLDERS_KEY) publish({ folders: readProjectFolders(browserStorage), notice: "" });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
function commit(folders: string[]) {
  publish({ folders, notice: saveProjectFolders(browserStorage, folders) ? "" : SAVE_FAILED });
}

/** Recently chosen project folders, with a visible notice when the device refuses to save them. */
export function useProjectFolders() {
  const { folders, notice } = useSyncExternalStore(subscribe, current, current);
  /** Returns the normalized folder, or undefined when the input cannot be used. */
  const remember = useCallback((folder: string) => {
    const normalized = normalizeProjectFolder(folder);
    if (normalized) commit(rememberProjectFolder(current().folders, normalized));
    return normalized;
  }, []);
  const forget = useCallback((folder: string) => commit(forgetProjectFolder(current().folders, folder)), []);
  return { folders, remember, forget, notice };
}
