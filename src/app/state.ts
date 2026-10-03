export type ItemKind = "home" | "conversation" | "coding" | "page" | "companion" | "memory" | "workflow" | "tasks" | "settings" | "connections";
export type GroupKind = "space" | "project";

export interface WorkspaceItem {
  id: string;
  title: string;
  kind: ItemKind;
  groupId?: string;
}

export interface WorkspaceGroup {
  id: string;
  title: string;
  kind: GroupKind;
}

export interface ShellState {
  version: 1;
  groups: WorkspaceGroup[];
  items: WorkspaceItem[];
  tabs: string[];
  activeId: string;
  expanded: string[];
  favorites: string[];
  recent: string[];
  sidebarVisible: boolean;
  sidebarWidth: number;
}

const STORAGE_KEY = "nekopapa.workspace-shell.v1";
const kinds: ItemKind[] = ["home", "conversation", "coding", "page", "companion", "memory", "workflow", "tasks", "settings", "connections"];

export const systemItems: WorkspaceItem[] = [
  { id: "home", title: "首页", kind: "home" },
  { id: "lumia", title: "Lumia", kind: "companion" },
  { id: "tasks", title: "任务", kind: "tasks" },
  { id: "memory", title: "记忆", kind: "memory" },
  { id: "workflows", title: "工作流", kind: "workflow" },
  { id: "connections", title: "连接器", kind: "connections" },
  { id: "settings", title: "设置", kind: "settings" },
];

function initialState(): ShellState {
  return {
    version: 1,
    groups: [
      { id: "daily", title: "日常陪伴", kind: "space" },
      { id: "ideas", title: "工作与灵感", kind: "space" },
      { id: "project-neko", title: "NekoPapa", kind: "project" },
    ],
    items: [
      { id: "today", title: "今天的陪伴", kind: "conversation", groupId: "daily" },
      { id: "night", title: "睡前聊聊", kind: "conversation", groupId: "daily" },
      { id: "weekend", title: "周末计划", kind: "page", groupId: "ideas" },
      { id: "inspiration", title: "灵感收集", kind: "page", groupId: "ideas" },
      { id: "project-session", title: "桌面页面开发", kind: "coding", groupId: "project-neko" },
    ],
    tabs: ["home", "today", "weekend"],
    activeId: "home",
    expanded: ["daily", "project-neko", "recent-section"],
    favorites: [],
    recent: [],
    sidebarVisible: true,
    sidebarWidth: 232,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isGroup(value: unknown): value is WorkspaceGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Record<string, unknown>;
  return typeof group.id === "string" && group.id.length > 0 && typeof group.title === "string" && group.title.trim().length > 0 && (group.kind === "space" || group.kind === "project");
}

function isItem(value: unknown): value is WorkspaceItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && typeof item.title === "string" && item.title.trim().length > 0 && kinds.includes(item.kind as ItemKind) && (item.groupId === undefined || typeof item.groupId === "string");
}

function readState(): ShellState {
  const fallback = initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<ShellState>;
    if (data.version !== 1 || !Array.isArray(data.groups) || !data.groups.every(isGroup) || !Array.isArray(data.items) || !data.items.every(isItem)) return fallback;
    const groups = data.groups.filter((group, index, all) => all.findIndex((candidate) => candidate.id === group.id) === index);
    const groupIds = new Set(groups.map((group) => group.id));
    const systemIds = new Set(systemItems.map((item) => item.id));
    const items = data.items.filter((item, index, all) => !systemIds.has(item.id) && all.findIndex((candidate) => candidate.id === item.id) === index && (!item.groupId || groupIds.has(item.groupId)));
    const validIds = new Set([...systemIds, ...items.map((item) => item.id)]);
    const tabs = unique(stringList(data.tabs) ? data.tabs : fallback.tabs).filter((id) => validIds.has(id));
    if (tabs.length === 0) tabs.push("home");
    return {
      version: 1,
      groups,
      items,
      tabs,
      activeId: typeof data.activeId === "string" && tabs.includes(data.activeId) ? data.activeId : tabs[0],
      expanded: stringList(data.expanded) ? unique(data.expanded) : fallback.expanded,
      favorites: stringList(data.favorites) ? unique(data.favorites).filter((id) => validIds.has(id)) : [],
      recent: stringList(data.recent) ? unique(data.recent).filter((id) => validIds.has(id)).slice(0, 8) : [],
      sidebarVisible: typeof data.sidebarVisible === "boolean" ? data.sidebarVisible : true,
      sidebarWidth: typeof data.sidebarWidth === "number" && Number.isFinite(data.sidebarWidth) ? Math.max(196, Math.min(320, data.sidebarWidth)) : 232,
    };
  } catch {
    return fallback;
  }
}

export class WorkspaceStore {
  state = readState();
  history = [this.state.activeId];
  historyIndex = 0;
  storageAvailable = true;

  item(id: string): WorkspaceItem | undefined {
    return systemItems.find((item) => item.id === id) ?? this.state.items.find((item) => item.id === id);
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.storageAvailable = true;
    } catch {
      this.storageAvailable = false;
    }
  }

  open(id: string, recordHistory = true): void {
    const item = this.item(id);
    if (!item) return;
    if (!this.state.tabs.includes(id)) this.state.tabs.push(id);
    if (recordHistory && this.state.activeId !== id) {
      this.history = [...this.history.slice(0, this.historyIndex + 1), id];
      this.historyIndex = this.history.length - 1;
    }
    this.state.activeId = id;
    if (item.groupId && !this.state.expanded.includes(item.groupId)) this.state.expanded.push(item.groupId);
    if (!systemItems.some((entry) => entry.id === id)) this.state.recent = [id, ...this.state.recent.filter((entry) => entry !== id)].slice(0, 8);
    this.persist();
  }

  close(id: string): void {
    const index = this.state.tabs.indexOf(id);
    if (index < 0) return;
    this.state.tabs.splice(index, 1);
    if (this.state.tabs.length === 0) this.state.tabs.push("home");
    if (this.state.activeId === id) this.open(this.state.tabs[Math.min(index, this.state.tabs.length - 1)]);
    this.persist();
  }

  travel(delta: number): void {
    const next = this.historyIndex + delta;
    if (next < 0 || next >= this.history.length) return;
    this.historyIndex = next;
    this.open(this.history[next], false);
  }

  toggleGroup(id: string): void {
    this.state.expanded = this.state.expanded.includes(id) ? this.state.expanded.filter((entry) => entry !== id) : [...this.state.expanded, id];
    this.persist();
  }

  addItem(kind: "conversation" | "coding" | "page", title: string, groupId: string): string {
    const id = crypto.randomUUID();
    this.state.items.push({ id, kind, title, groupId });
    this.open(id);
    return id;
  }

  addGroup(kind: GroupKind, title: string): string {
    const id = crypto.randomUUID();
    this.state.groups.push({ id, kind, title });
    this.state.expanded.push(id);
    this.persist();
    return id;
  }

  rename(id: string, title: string): void {
    const item = this.state.items.find((entry) => entry.id === id) ?? this.state.groups.find((entry) => entry.id === id);
    if (item) item.title = title;
    this.persist();
  }

  favorite(id: string): void {
    this.state.favorites = this.state.favorites.includes(id) ? this.state.favorites.filter((entry) => entry !== id) : [...this.state.favorites, id];
    this.persist();
  }
}
