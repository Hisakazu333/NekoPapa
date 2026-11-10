import { normalizeProjectFolder, projectFolderName, readProjectFolders, type ProjectFolderStorage } from "./project-folders";

/**
 * Local projects: a named set of source folders (the first is the primary
 * folder) that workbench chats are grouped under. A chat stores its project's
 * `id`; chats saved before projects existed store a folder path and resolve to
 * the project that holds that folder. Nothing here reads folders or runs commands.
 */

export const PROJECTS_KEY = "nekopapa.projects.v1";
export const PROJECT_LIMIT = 50;
export const PROJECT_NAME_MAX_LENGTH = 80;
export const PROJECT_FOLDER_MAX = 10;

export interface Project {
  id: string;
  name: string;
  /** Source folders; `folders[0]` is the primary folder. */
  folders: string[];
  pinned: boolean;
}

export interface ProjectList {
  projects: Project[];
  /** Set once chats' legacy folder paths have been turned into projects. */
  legacyAdopted: boolean;
}

export type ProjectIdFactory = () => string;

export const newProjectId: ProjectIdFactory = () =>
  `proj_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`;

const PROJECT_ID = /^proj_[A-Za-z0-9-]{1,64}$/;

export const isProjectId = (value: string) => PROJECT_ID.test(value);

/** Trimmed name, or undefined when empty, too long or containing control characters. */
export function normalizeProjectName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  if (!name || name.length > PROJECT_NAME_MAX_LENGTH || /[\u0000-\u001f]/.test(name)) return undefined;
  return name;
}

/** Normalized, de-duplicated folders in order, capped; undefined when none is usable. */
function normalizeFolders(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const folders = [...new Set(value.map(normalizeProjectFolder).filter((folder): folder is string => Boolean(folder)))];
  return folders.length > 0 ? folders.slice(0, PROJECT_FOLDER_MAX) : undefined;
}

function readProject(value: unknown): Project | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const folders = normalizeFolders(record.folders);
  const name = normalizeProjectName(record.name);
  if (typeof record.id !== "string" || !isProjectId(record.id) || !folders || !name) return undefined;
  return { id: record.id, name, folders, pinned: record.pinned === true };
}

export function projectFromFolder(folder: string, makeId: ProjectIdFactory = newProjectId): Project {
  return { id: makeId(), name: projectFolderName(folder).slice(0, PROJECT_NAME_MAX_LENGTH), folders: [folder], pinned: false };
}

/**
 * Reads the project list. Before the first save it is built from the older
 * recent-folder list (one project per folder). Damaged data reads as empty;
 * invalid and duplicate entries are dropped.
 */
export function readProjects(storage: Pick<ProjectFolderStorage, "getItem">, makeId: ProjectIdFactory = newProjectId): ProjectList {
  try {
    const raw = storage.getItem(PROJECTS_KEY);
    if (raw === null) {
      return { projects: readProjectFolders(storage).map((folder) => projectFromFolder(folder, makeId)), legacyAdopted: false };
    }
    const parsed = JSON.parse(raw) as { projects?: unknown; legacyAdopted?: unknown } | null;
    const seen = new Set<string>();
    const projects = (Array.isArray(parsed?.projects) ? parsed.projects : []).map(readProject).filter((project): project is Project => {
      if (!project || seen.has(project.id)) return false;
      seen.add(project.id);
      return true;
    });
    return { projects: projects.slice(0, PROJECT_LIMIT), legacyAdopted: parsed?.legacyAdopted === true };
  } catch {
    return { projects: [], legacyAdopted: false };
  }
}

/** Returns false when the write fails; callers keep the in-memory list and say so. */
export function saveProjects(storage: Pick<ProjectFolderStorage, "setItem">, list: ProjectList): boolean {
  try {
    storage.setItem(PROJECTS_KEY, JSON.stringify({ version: 1, projects: list.projects.slice(0, PROJECT_LIMIT), legacyAdopted: list.legacyAdopted }));
    return true;
  } catch {
    return false;
  }
}

export function projectWithFolder(projects: readonly Project[], folder: string): Project | undefined {
  const normalized = normalizeProjectFolder(folder);
  return normalized ? projects.find((project) => project.folders.includes(normalized)) : undefined;
}

/** A chat's stored project value: a project id, or a legacy folder path matched by folder. */
export function resolveProject(projects: readonly Project[], value: string | undefined): Project | undefined {
  if (!value) return undefined;
  return projects.find((project) => project.id === value) ?? (isProjectId(value) ? undefined : projectWithFolder(projects, value));
}

/** Adds a project for the folder at the front, or returns the project that already holds it. */
export function addFolderProject(list: ProjectList, folder: string, makeId: ProjectIdFactory = newProjectId): { list: ProjectList; project?: Project } {
  const normalized = normalizeProjectFolder(folder);
  if (!normalized) return { list };
  const existing = projectWithFolder(list.projects, normalized);
  if (existing) return { list, project: existing };
  const project = projectFromFolder(normalized, makeId);
  return { list: { ...list, projects: [project, ...list.projects].slice(0, PROJECT_LIMIT) }, project };
}

export interface ProjectDraft { name: string; folders: readonly string[] }

/** Applies an edit; returns the reason instead when the draft cannot be saved. */
export function updateProject(list: ProjectList, id: string, draft: ProjectDraft): { list: ProjectList; error?: string } {
  const name = normalizeProjectName(draft.name);
  if (!name) return { list, error: draft.name.trim() ? `项目名称最多 ${PROJECT_NAME_MAX_LENGTH} 个字符。` : "请输入项目名称。" };
  if (draft.folders.length > PROJECT_FOLDER_MAX) return { list, error: `每个项目最多 ${PROJECT_FOLDER_MAX} 个文件夹。` };
  const folders = normalizeFolders(draft.folders);
  if (!folders) return { list, error: "项目至少需要一个文件夹。" };
  const clash = list.projects.find((project) => project.id !== id && project.folders.some((folder) => folders.includes(folder)));
  if (clash) return { list, error: `有文件夹已属于项目“${clash.name}”。` };
  if (!list.projects.some((project) => project.id === id)) return { list, error: "这个项目已被移除。" };
  return { list: { ...list, projects: list.projects.map((project) => project.id === id ? { ...project, name, folders } : project) } };
}

export function removeProject(list: ProjectList, id: string): ProjectList {
  return { ...list, projects: list.projects.filter((project) => project.id !== id) };
}

export function toggleProjectPinned(list: ProjectList, id: string): ProjectList {
  return { ...list, projects: list.projects.map((project) => project.id === id ? { ...project, pinned: !project.pinned } : project) };
}

/**
 * One-time migration: chats saved before projects stored a folder path. Paths
 * that no project holds become projects (after the existing ones), so their
 * chats stay grouped. Later removals are respected because this runs once.
 */
export function adoptLegacyFolders(list: ProjectList, values: readonly string[], makeId: ProjectIdFactory = newProjectId): ProjectList {
  let projects = list.projects;
  for (const value of values) {
    const folder = normalizeProjectFolder(value);
    if (!folder || isProjectId(folder) || projectWithFolder(projects, folder)) continue;
    projects = [...projects, projectFromFolder(folder, makeId)];
  }
  return { projects: projects.slice(0, PROJECT_LIMIT), legacyAdopted: true };
}
