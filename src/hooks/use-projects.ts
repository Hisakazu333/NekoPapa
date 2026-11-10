import { useCallback, useSyncExternalStore } from "react";
import {
  PROJECTS_KEY, addFolderProject, adoptLegacyFolders, readProjects, removeProject, saveProjects, toggleProjectPinned, updateProject,
  type Project, type ProjectDraft, type ProjectList,
} from "@/app/projects/projects";

const browserStorage = {
  getItem: (key: string) => globalThis.localStorage.getItem(key),
  setItem: (key: string, value: string) => globalThis.localStorage.setItem(key, value),
};

const SAVE_FAILED = "项目列表未能保存到本机，重启后不会保留。";

/**
 * One in-page copy of the local projects, shared by the sidebar, the composer
 * picker, the edit dialog and the profile page. Other windows update it
 * through the `storage` event.
 */
let snapshot: { list: ProjectList; notice: string } | undefined;
const listeners = new Set<() => void>();

function current() {
  snapshot ??= { list: readProjects(browserStorage), notice: "" };
  return snapshot;
}
function publish(next: { list: ProjectList; notice: string }) {
  snapshot = next;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROJECTS_KEY) publish({ list: readProjects(browserStorage), notice: "" });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
function commit(list: ProjectList) {
  publish({ list, notice: saveProjects(browserStorage, list) ? "" : SAVE_FAILED });
}

/** Local projects with a visible notice when the device refuses to save them. */
export function useProjects() {
  const { list, notice } = useSyncExternalStore(subscribe, current, current);
  /** The project for a checked folder: a new one (`created`), or the one already holding it. */
  const addFolder = useCallback((folder: string): { project?: Project; created: boolean } => {
    const result = addFolderProject(current().list, folder);
    const created = result.list !== current().list;
    if (created) commit(result.list);
    return { project: result.project, created };
  }, []);
  /** Returns the reason when the edit cannot be saved. */
  const update = useCallback((id: string, draft: ProjectDraft): string | undefined => {
    const result = updateProject(current().list, id, draft);
    if (result.error) return result.error;
    commit(result.list);
    return undefined;
  }, []);
  const remove = useCallback((id: string) => commit(removeProject(current().list, id)), []);
  const togglePinned = useCallback((id: string) => commit(toggleProjectPinned(current().list, id)), []);
  /** One-time migration of chats' legacy folder paths; later calls do nothing. */
  const adoptLegacy = useCallback((values: readonly string[]) => {
    if (!current().list.legacyAdopted) commit(adoptLegacyFolders(current().list, values));
  }, []);
  return { projects: list.projects, legacyAdopted: list.legacyAdopted, notice, addFolder, update, remove, togglePinned, adoptLegacy };
}
