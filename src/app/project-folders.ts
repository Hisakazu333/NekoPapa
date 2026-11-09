/**
 * Project folders a workbench chat can belong to. A folder is identified by the
 * text the user chose (an absolute path, or only a folder name when the browser
 * picker cannot reveal the path). Choosing one only groups chats; nothing here
 * reads the folder, runs commands or connects the NekoBuddy backend.
 */

export const PROJECT_FOLDERS_KEY = "nekopapa.project-folders.v1";
export const PROJECT_FOLDER_LIMIT = 12;
export const PROJECT_FOLDER_MAX_LENGTH = 1024;

export interface ProjectFolderStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Trims and drops trailing separators; returns undefined for unusable input. */
export function normalizeProjectFolder(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const folder = trimmed.length > 1 ? trimmed.replace(/[\\/]+$/, "") : trimmed;
  if (!folder || folder.length > PROJECT_FOLDER_MAX_LENGTH || /[\u0000-\u001f]/.test(folder)) return undefined;
  return folder;
}

/** The last path segment, shown as the folder's label. */
export function projectFolderName(folder: string): string {
  const segments = folder.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? folder;
}

/** Missing or damaged data reads as an empty list; invalid and duplicate entries are dropped. */
export function readProjectFolders(storage: Pick<ProjectFolderStorage, "getItem">): string[] {
  try {
    const raw = storage.getItem(PROJECT_FOLDERS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = parsed && typeof parsed === "object" ? (parsed as { folders?: unknown }).folders : undefined;
    if (!Array.isArray(list)) return [];
    return mergeProjectFolders(list.map(normalizeProjectFolder).filter((folder): folder is string => Boolean(folder)));
  } catch {
    return [];
  }
}

/** Most recent first, without duplicates, capped at the limit. */
export function mergeProjectFolders(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const folder of lists.flat()) {
    if (seen.has(folder)) continue;
    seen.add(folder);
    merged.push(folder);
  }
  return merged.slice(0, PROJECT_FOLDER_LIMIT);
}

/** Moves a folder to the front; unusable input leaves the list unchanged. */
export function rememberProjectFolder(folders: readonly string[], folder: string): string[] {
  const normalized = normalizeProjectFolder(folder);
  return normalized ? mergeProjectFolders([normalized], folders) : [...folders];
}

export function forgetProjectFolder(folders: readonly string[], folder: string): string[] {
  return folders.filter((entry) => entry !== folder);
}

/** Returns false when the write fails; callers keep the in-memory list and say so. */
export function saveProjectFolders(storage: Pick<ProjectFolderStorage, "setItem">, folders: readonly string[]): boolean {
  try {
    storage.setItem(PROJECT_FOLDERS_KEY, JSON.stringify({ version: 1, folders: mergeProjectFolders(folders) }));
    return true;
  } catch {
    return false;
  }
}
