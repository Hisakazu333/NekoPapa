import { STORAGE_KEY, contentKinds, normalizeItem, initialState, systemItems, unique, stringList, groupOverview, itemMode, navigationModes, defaultRailOrder } from "./workspace-model";
import type { ArchiveRecord, WorkspaceItem, WorkspaceGroup, WorkspaceStorage, ShellState, GroupKind, NavigationMode, ContentKind } from "./workspace-model";
import { removeLegacySamples } from "./workspace-migration";
import { normalizePinnedFeatures } from "./feature-model";
import { normalizeSelectedCompanion } from "./companion-model";

function isGroup(value: unknown): value is WorkspaceGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Record<string, unknown>;
  return typeof group.id === "string" && group.id.length > 0 && typeof group.title === "string" && group.title.trim().length > 0 && (group.kind === "space" || group.kind === "project");
}

function isItem(value: unknown): value is WorkspaceItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && typeof item.title === "string" && item.title.trim().length > 0 && contentKinds.includes(item.kind as ContentKind) && (item.groupId === undefined || typeof item.groupId === "string");
}

function readArchives(value: unknown, activeIds: Set<string>, systemIds: Set<string>): ArchiveRecord[] {
  if (!Array.isArray(value)) return [];
  const archiveIds = new Set<string>();
  const itemIds = new Set(activeIds);
  const groupIds = new Set<string>();
  return value.flatMap((value: unknown): ArchiveRecord[] => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    if (typeof entry.id !== "string" || !entry.id || archiveIds.has(entry.id) || typeof entry.archivedAt !== "string" || !Number.isFinite(Date.parse(entry.archivedAt)) || (entry.target !== "item" && entry.target !== "group") || !Array.isArray(entry.items)) return [];
    const group = isGroup(entry.group) ? { ...entry.group } : undefined;
    if (entry.target === "group" && (!group || groupIds.has(group.id))) return [];
    const items = entry.items.filter(isItem).filter((item) => {
      if (systemIds.has(item.id) || itemIds.has(item.id)) return false;
      itemIds.add(item.id);
      return true;
    }).map(normalizeItem);
    if (entry.target === "item" && items.length !== 1) {
      for (const item of items) itemIds.delete(item.id);
      return [];
    }
    archiveIds.add(entry.id);
    if (entry.target === "group") groupIds.add(group!.id);
    const positions = Array.isArray(entry.itemPositions) ? entry.itemPositions.flatMap((value: unknown) => {
      if (!value || typeof value !== "object") return [];
      const position = value as Record<string, unknown>;
      return typeof position.id === "string" && items.some((item) => item.id === position.id) && typeof position.index === "number" && Number.isInteger(position.index) && position.index >= 0 ? [{ id: position.id, index: position.index }] : [];
    }) : [];
    const favoritePositions = Array.isArray(entry.favoritePositions) ? entry.favoritePositions.flatMap((value: unknown) => {
      if (!value || typeof value !== "object") return [];
      const position = value as Record<string, unknown>;
      return typeof position.id === "string" && items.some((item) => item.id === position.id) && typeof position.index === "number" && Number.isInteger(position.index) && position.index >= 0 ? [{ id: position.id, index: position.index }] : [];
    }) : undefined;
    return [{
      id: entry.id, archivedAt: entry.archivedAt, target: entry.target, group, items,
      favoriteIds: stringList(entry.favoriteIds) ? unique(entry.favoriteIds).filter((id) => items.some((item) => item.id === id)) : [],
      favoritePositions,
      itemPositions: items.map((item, index) => positions.find((position) => position.id === item.id) ?? { id: item.id, index }),
      groupPosition: typeof entry.groupPosition === "number" && Number.isInteger(entry.groupPosition) && entry.groupPosition >= 0 ? entry.groupPosition : undefined,
      expanded: typeof entry.expanded === "boolean" ? entry.expanded : undefined,
    }];
  });
}

function readState(storage: WorkspaceStorage | null, recover: (raw: string | null) => void): ShellState {
  const fallback = initialState();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<ShellState>;
    if (data.version !== 1 || !Array.isArray(data.groups) || !Array.isArray(data.items)) { recover(raw); return fallback; }
    const groups = data.groups.filter(isGroup).filter((group, index, all) => all.findIndex((candidate) => candidate.id === group.id) === index);
    const systemIds = new Set(systemItems.map((item) => item.id));
    const reservedIds = new Set([...systemIds, "archive"]);
    const items = data.items.filter(isItem).filter((item, index, all) => !reservedIds.has(item.id) && all.findIndex((candidate) => candidate.id === item.id) === index).map(normalizeItem);
    const archives = readArchives(data.archives, new Set(items.map((item) => item.id)), reservedIds);
    const savedArchiveItems = Array.isArray(data.archives) ? data.archives.reduce((count, entry) => count + (Array.isArray(entry?.items) ? entry.items.length : 0), 0) : 0;
    if (groups.length !== data.groups.length || items.length !== data.items.length || (data.archives !== undefined && !Array.isArray(data.archives)) || (Array.isArray(data.archives) && (archives.length !== data.archives.length || archives.reduce((count, entry) => count + entry.items.length, 0) !== savedArchiveItems))) recover(raw);
    // Repair orphaned content without dropping a user's saved item or open tab.
    const recovered = new Map<GroupKind, string>();
    for (const item of items) {
      const group = groups.find((entry) => entry.id === item.groupId);
      if (group && (item.kind !== "coding" || group.kind === "project")) continue;
      const kind = item.kind === "coding" ? "project" : "space";
      let id = recovered.get(kind);
      if (!id) {
        id = `recovered-${kind}`;
        while (groups.some((entry) => entry.id === id)) id += "-1";
        groups.push({ id, kind, title: kind === "project" ? "恢复的项目" : "恢复的内容" });
        recovered.set(kind, id);
      }
      item.groupId = id;
    }
    const validIds = new Set(["home", ...items.map((item) => item.id)]);
    const tabs = unique(stringList(data.tabs) ? data.tabs : fallback.tabs).filter((id) => validIds.has(id));
    if (tabs.length === 0) tabs.push("home");
    const activeId = typeof data.activeId === "string" && tabs.includes(data.activeId) ? data.activeId : tabs[0];
    const findItem = (id: string) => systemItems.find((item) => item.id === id) ?? items.find((item) => item.id === id) ?? groupOverview(id, groups);
    const mode = data.navigationMode === "chat" || data.navigationMode === "library" || data.navigationMode === "projects" ? data.navigationMode : "home";
    const savedRail = stringList(data.railOrder) ? unique(data.railOrder).filter((entry): entry is NavigationMode => navigationModes.includes(entry as NavigationMode)) : [];
    const railOrder = [...savedRail, ...defaultRailOrder.filter((entry) => !savedRail.includes(entry))];
    const lastActive: ShellState["lastActive"] = {};
    const groupContext: ShellState["groupContext"] = {};
    for (const entry of navigationModes) {
      const last = data.lastActive?.[entry];
      if (typeof last === "string" && tabs.includes(last) && itemMode(findItem(last)!, groups) === entry) lastActive[entry] = last;
      const context = data.groupContext?.[entry];
      if (typeof context === "string" && groups.some((group) => group.id === context)) groupContext[entry] = context;
    }
    lastActive[itemMode(findItem(activeId)!, groups)] = activeId;
    return {
      version: 1,
      sampleCleanupVersion: data.sampleCleanupVersion === 1 ? 1 : 0,
      groups,
      items,
      archives,
      tabs,
      activeId,
      expanded: (stringList(data.expanded) ? unique(data.expanded) : fallback.expanded).filter((id) => groups.some((group) => group.id === id)),
      favorites: stringList(data.favorites) ? unique(data.favorites).filter((id) => items.some((item) => item.id === id)) : [],
      recent: stringList(data.recent) ? unique(data.recent).filter((id) => items.some((item) => item.id === id)).slice(0, 8) : [],
      sidebarVisible: typeof data.sidebarVisible === "boolean" ? data.sidebarVisible : true,
      sidebarWidth: typeof data.sidebarWidth === "number" && Number.isFinite(data.sidebarWidth) ? Math.max(196, Math.min(320, data.sidebarWidth)) : 232,
      navigationMode: mode,
      railOrder,
      pinnedFeatures: normalizePinnedFeatures(data.pinnedFeatures),
      selectedCompanionId: normalizeSelectedCompanion(data.selectedCompanionId),
      collapsedSections: stringList(data.collapsedSections) ? unique(data.collapsedSections) : fallback.collapsedSections,
      lastActive,
      groupContext,
      activityVisible: data.activityVisible === true,
      activityFilter: data.activityFilter === "unread" ? "unread" : "all",
    };
  } catch {
    recover(raw);
    return fallback;
  }
}

export class WorkspacePersistence {
  storageAvailable = true;
  recoveryData: string | null = null;
  private recoveryBlocked = false;
  private storage: WorkspaceStorage | null;

  constructor(storage?: WorkspaceStorage) {
    try { this.storage = storage ?? localStorage; }
    catch { this.storage = null; this.storageAvailable = false; }
    
    if (!this.recoveryData) {
      try { this.recoveryData = this.storage?.getItem(`${STORAGE_KEY}.recovery.latest`) ?? this.storage?.getItem(`${STORAGE_KEY}.recovery`) ?? null; }
      catch { /* The primary workspace can still be used if the optional backup cannot be read. */ }
    }
  }

  load(): ShellState {
    const state = readState(this.storage, (raw) => this.preserveRecovery(raw));
    if (state.sampleCleanupVersion === 0) {
      removeLegacySamples(state);
      this.save(state);
    }
    return state;
  }

  save(state: ShellState): void {
    try {
      if (!this.storage || this.recoveryBlocked) throw new Error("Workspace storage is unavailable");
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.storageAvailable = true;
    } catch {
      this.storageAvailable = false;
    }
  }

  private preserveRecovery(raw: string | null): void {
    if (raw === null || !this.storage) { this.recoveryBlocked = true; this.storageAvailable = false; return; }
    this.recoveryData = raw;
    try {
      const key = `${STORAGE_KEY}.recovery`;
      const previous = this.storage.getItem(key);
      if (!previous) this.storage.setItem(key, raw);
      else if (previous !== raw) this.storage.setItem(`${key}.${Date.now()}.${crypto.randomUUID()}`, raw);
      // Retain older backups and export the newest preserved source after a restart.
      this.storage.setItem(`${key}.latest`, raw);
    } catch {
      // Keep the unreadable source intact until it can be exported or backed up safely.
      this.recoveryBlocked = true;
      this.storageAvailable = false;
    }
  }

}
