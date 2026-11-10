/**
 * Folder paths used by local projects (see projects.ts). The recent-folder
 * list under `PROJECT_FOLDERS_KEY` is the format before projects existed; it
 * is only read, to build the first project list. Nothing here reads the
 * folder, runs commands or connects the NekoBuddy backend.
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
function mergeProjectFolders(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const folder of lists.flat()) {
    if (seen.has(folder)) continue;
    seen.add(folder);
    merged.push(folder);
  }
  return merged.slice(0, PROJECT_FOLDER_LIMIT);
}
