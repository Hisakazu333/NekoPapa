import { defaultPinnedFeatures } from "./feature-model";
import type { FeatureId } from "./feature-model";
import { defaultCompanionId } from "./companion-model";
import type { CompanionId } from "./companion-model";

export type ItemKind = "home" | "overview" | "conversation" | "coding" | "page" | "companion" | "memory" | "workflow" | "tasks" | "settings" | "connections";
export type ContentKind = "conversation" | "coding" | "page";
export type GroupKind = "space" | "project";
export type SessionStatus = "idle" | "running" | "waiting" | "completed" | "failed";
export type ActivityFilter = "all" | "unread";
export interface SessionActivity {
  status: SessionStatus;
  unread: boolean;
  pinned: boolean;
  updatedAt?: string;
  summary?: string;
}
export interface SessionActivityUpdate {
  status: SessionStatus;
  updatedAt: string;
  summary?: string;
}
export type NavigationMode = "home" | "chat" | "library" | "projects" | "tasks" | "tools";
export const navigationModes: NavigationMode[] = ["home", "chat", "library", "projects", "tasks", "tools"];
export const defaultRailOrder: NavigationMode[] = ["home", "chat", "library", "tasks", "tools", "projects"];

export interface WorkspaceItem {
  id: string;
  title: string;
  kind: ItemKind;
  groupId?: string;
  companionId?: string;
  activity?: SessionActivity;
}

export interface WorkspaceGroup {
  id: string;
  title: string;
  kind: GroupKind;
}

export interface ArchiveRecord {
  id: string;
  archivedAt: string;
  target: "item" | "group";
  group?: WorkspaceGroup;
  items: WorkspaceItem[];
  favoriteIds: string[];
  favoritePositions?: Array<{ id: string; index: number }>;
  itemPositions: Array<{ id: string; index: number }>;
  groupPosition?: number;
  expanded?: boolean;
}

export interface ShellState {
  version: 1;
  sampleCleanupVersion: 0 | 1;
  groups: WorkspaceGroup[];
  items: WorkspaceItem[];
  archives: ArchiveRecord[];
  tabs: string[];
  activeId: string;
  expanded: string[];
  favorites: string[];
  recent: string[];
  sidebarVisible: boolean;
  sidebarWidth: number;
  navigationMode: NavigationMode;
  railOrder: NavigationMode[];
  pinnedFeatures: FeatureId[];
  selectedCompanionId: CompanionId;
  collapsedSections: string[];
  lastActive: Partial<Record<NavigationMode, string>>;
  groupContext: Partial<Record<NavigationMode, string>>;
  activityVisible: boolean;
  activityFilter: ActivityFilter;
}

export const STORAGE_KEY = "nekopapa.workspace-shell.v1";
export const contentKinds: ContentKind[] = ["conversation", "coding", "page"];

export const navigationDestinations: Record<NavigationMode, string> = {
  home: "home", chat: "chat", library: "library", projects: "projects", tasks: "tasks", tools: "tools",
};

export function creationKind(mode: NavigationMode): ContentKind | undefined {
  return mode === "home" || mode === "chat" ? "conversation" : mode === "library" ? "page" : mode === "projects" ? "coding" : undefined;
}

export function sidebarCreationKind(state: Pick<ShellState, "navigationMode" | "activityVisible">): ContentKind | undefined {
  return state.activityVisible ? state.navigationMode === "projects" ? "coding" : "conversation" : creationKind(state.navigationMode);
}

export function isSession(item: WorkspaceItem): boolean {
  return item.kind === "conversation" || item.kind === "coding";
}

export const sessionStatuses: SessionStatus[] = ["idle", "running", "waiting", "completed", "failed"];
export function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const systemItems: WorkspaceItem[] = [
  { id: "home", title: "首页", kind: "home" },
  { id: "lumia", title: "Lumia", kind: "companion" },
  { id: "tasks", title: "任务", kind: "tasks" },
  { id: "memory", title: "记忆", kind: "memory" },
  { id: "workflows", title: "工作流", kind: "workflow" },
  { id: "connections", title: "连接器", kind: "connections" },
  { id: "settings", title: "设置", kind: "settings" },
  { id: "chat", title: "所有对话", kind: "overview" },
  { id: "library", title: "所有空间", kind: "overview" },
  { id: "projects", title: "所有项目", kind: "overview" },
  { id: "tools", title: "工具与连接", kind: "overview" },
];

export function groupOverview(id: string, groups: WorkspaceGroup[]): WorkspaceItem | undefined {
  if (!id.startsWith("group:")) return;
  const group = groups.find((entry) => entry.id === id.slice(6));
  return group ? { id, title: group.title, kind: "overview", groupId: group.id } : undefined;
}

export function itemMode(item: WorkspaceItem, groups: WorkspaceGroup[]): NavigationMode {
  const systemMode: Partial<Record<string, NavigationMode>> = {
    home: "home", chat: "chat", library: "library", projects: "projects", tasks: "tasks", tools: "tools",
    lumia: "chat", memory: "library", workflows: "tasks", connections: "tools", settings: "tools",
  };
  if (Object.hasOwn(systemMode, item.id)) return systemMode[item.id]!;
  if (item.kind === "overview" && item.groupId) return groups.some((group) => group.id === item.groupId && group.kind === "project") ? "projects" : "library";
  if (item.kind === "coding" || groups.some((group) => group.id === item.groupId && group.kind === "project")) return "projects";
  return item.kind === "page" ? "library" : "chat";
}

export function initialState(): ShellState {
  return {
    version: 1,
    sampleCleanupVersion: 1,
    groups: [],
    items: [],
    archives: [],
    tabs: ["home"],
    activeId: "home",
    expanded: [],
    favorites: [],
    recent: [],
    sidebarVisible: true,
    sidebarWidth: 232,
    navigationMode: "home",
    railOrder: [...defaultRailOrder],
    pinnedFeatures: [...defaultPinnedFeatures],
    selectedCompanionId: defaultCompanionId,
    collapsedSections: [],
    lastActive: { home: "home" },
    groupContext: {},
    activityVisible: false,
    activityFilter: "all",
  };
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function reordered<T extends string | { id: string }>(values: T[], id: string, beforeId?: string): T[] | undefined {
  const key = (value: T) => typeof value === "string" ? value : value.id;
  const moved = values.find((entry) => key(entry) === id);
  if (!moved || beforeId === id || (beforeId !== undefined && !values.some((entry) => key(entry) === beforeId))) return;
  const result = values.filter((entry) => key(entry) !== id);
  result.splice(beforeId === undefined ? result.length : result.findIndex((entry) => key(entry) === beforeId), 0, moved);
  return result.every((entry, index) => entry === values[index]) ? undefined : result;
}

export function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function normalizeItem(item: WorkspaceItem): WorkspaceItem {
  const normalized = item.kind === "conversation" ? { ...item, companionId: typeof item.companionId === "string" && item.companionId.trim() ? item.companionId.trim() : "lumia" } : { ...item };
  if (isSession(item)) {
    const saved = item.activity && typeof item.activity === "object" ? item.activity : undefined;
    normalized.activity = {
      status: saved && sessionStatuses.includes(saved.status) ? saved.status : "idle",
      unread: saved?.unread === true,
      pinned: saved?.pinned === true,
      updatedAt: validTimestamp(saved?.updatedAt) ? saved.updatedAt : undefined,
      summary: typeof saved?.summary === "string" ? saved.summary.trim().slice(0, 480) || undefined : undefined,
    };
  } else delete normalized.activity;
  return normalized;
}
