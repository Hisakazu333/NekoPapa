import { WorkspacePersistence } from "./workspace-storage";
import { activitySections } from "./activity";
import { featureById, maxPinnedFeatures } from "./feature-model";
import type { FeatureId } from "./feature-model";
import { companionById } from "./companion-model";
import { normalizeSidebarPreferences } from "./sidebar-query";
import { contentSnapshot, detachGroup, restoreContent, canDeleteContent } from "./workspace-lifecycle";
import type { RestoreResult } from "./workspace-lifecycle";
import type { SidebarPreferences } from "./sidebar-query";
import { systemItems, groupOverview, itemMode, navigationModes, reordered, isSession, sessionStatuses, validTimestamp, contentKinds, normalizeItem } from "./workspace-model";
import type { ShellState, WorkspaceStorage, WorkspaceItem, WorkspaceGroup, NavigationMode, ContentKind, GroupKind, ActivityFilter, SessionActivityUpdate, ArchiveRecord } from "./workspace-model";
export * from "./workspace-model";

export class WorkspaceStore {
  state: ShellState;
  history: string[];
  historyIndex = 0;
  private persistence: WorkspacePersistence;
  get storageAvailable(): boolean { return this.persistence.storageAvailable; }
  get recoveryData(): string | null { return this.persistence.recoveryData; }
  private closedTabs: Array<{ tabs: Array<{ id: string; index: number }>; activeId: string; fallbackHome: boolean }> = [];

  constructor(storage?: WorkspaceStorage) {
    this.persistence = new WorkspacePersistence(storage);
    this.state = this.persistence.load();
    this.history = [this.state.activeId];
  }

  item(id: string): WorkspaceItem | undefined {
    return systemItems.find((item) => item.id === id) ?? this.state.items.find((item) => item.id === id) ?? groupOverview(id, this.state.groups);
  }

  persist(): void { this.persistence.save(this.state); }

  selectCompanion(id: string): boolean {
    const companion = companionById(id);
    if (!companion || this.state.selectedCompanionId === id) return false;
    this.state.selectedCompanionId = companion.id;
    this.persist();
    return true;
  }

  setSidebarPreferences(update: Partial<SidebarPreferences>): boolean {
    const previous = this.state.sidebarPreferences;
    const next = normalizeSidebarPreferences(update, previous);
    if (next.listLimit === previous.listLimit && next.conversationScope === previous.conversationScope) return false;
    this.state.sidebarPreferences = next;
    this.persist();
    return true;
  }

  toggleFeaturePin(id: FeatureId): boolean {
    if (!featureById(id)) return false;
    const pinned = this.state.pinnedFeatures.includes(id);
    if (!pinned && this.state.pinnedFeatures.length >= maxPinnedFeatures) return false;
    this.state.pinnedFeatures = pinned ? this.state.pinnedFeatures.filter((entry) => entry !== id) : [...this.state.pinnedFeatures, id];
    this.persist();
    return true;
  }

  modeFor(id: string): NavigationMode | undefined {
    const item = this.item(id);
    return item ? itemMode(item, this.state.groups) : undefined;
  }

  open(id: string, recordHistory = true): boolean {
    const item = this.item(id);
    if (!item || (id !== "home" && !this.state.items.some((entry) => entry.id === id))) return false;
    if (!this.state.tabs.includes(id)) this.state.tabs.push(id);
    if (recordHistory && this.state.activeId !== id) {
      this.history = [...this.history.slice(0, this.historyIndex + 1), id];
      this.historyIndex = this.history.length - 1;
    }
    this.state.activeId = id;
    this.state.lastActive[this.modeFor(id)!] = id;
    // A moved item must not remain the remembered destination of its old category.
    for (const mode of navigationModes) {
      const last = this.state.lastActive[mode];
      if (last && this.modeFor(last) !== mode) delete this.state.lastActive[mode];
    }
    const group = this.state.groups.find((entry) => entry.id === item.groupId);
    const mode = this.state.navigationMode;
    const visible = !this.state.activityVisible && group && ((mode === "library" && group.kind === "space") || (mode === "projects" && group.kind === "project"));
    if (visible) this.revealGroup(group.id);
    else if (group && (mode === "home" || (mode === "chat" && item.kind === "conversation"))) this.state.groupContext[mode] = group.id;
    if (isSession(item) && item.activity) item.activity.unread = false;
    if (this.state.items.some((entry) => entry.id === id)) this.state.recent = [id, ...this.state.recent.filter((entry) => entry !== id)].slice(0, 8);
    if (!this.state.activityVisible) {
      let section: string | undefined;
      if (mode === "home") section = this.state.favorites.includes(id) ? "home-favorites" : "home-recent";
      if (mode === "chat" && item.kind === "conversation") {
        const chatSection = activitySections({ ...this.state, activityFilter: "all" }).find((entry) => entry.entries.some((entry) => entry.item.id === id));
        if (chatSection) section = `chat-${chatSection.id}`;
      }
      if (section) this.state.collapsedSections = this.state.collapsedSections.filter((entry) => entry !== section);
    }
    this.persist();
    return true;
  }

  close(id: string): boolean { return this.closeMany([id]); }

  get canRestoreClosed(): boolean {
    return this.closedTabs.some((batch) => batch.tabs.some((tab) => this.item(tab.id)));
  }

  moveTab(id: string, delta: -1 | 1): boolean {
    const index = this.state.tabs.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= this.state.tabs.length || (delta !== -1 && delta !== 1)) return false;
    [this.state.tabs[index], this.state.tabs[next]] = [this.state.tabs[next], this.state.tabs[index]];
    this.persist();
    return true;
  }

  moveGroup(id: string, delta: -1 | 1): boolean {
    const group = this.state.groups.find((entry) => entry.id === id);
    if (!group || (delta !== -1 && delta !== 1)) return false;
    const peers = this.state.groups.filter((entry) => entry.kind === group.kind);
    const neighbor = peers[peers.indexOf(group) + delta];
    if (!neighbor) return false;
    const index = this.state.groups.indexOf(group);
    const next = this.state.groups.indexOf(neighbor);
    [this.state.groups[index], this.state.groups[next]] = [this.state.groups[next], this.state.groups[index]];
    this.persist();
    return true;
  }

  reorderRail(id: NavigationMode, beforeId?: NavigationMode): boolean {
    const result = reordered(this.state.railOrder, id, beforeId);
    if (!result) return false;
    this.state.railOrder = result;
    this.persist();
    return true;
  }

  reorderTab(id: string, beforeId?: string): boolean {
    const result = reordered(this.state.tabs, id, beforeId);
    if (!result) return false;
    this.state.tabs = result;
    this.persist();
    return true;
  }

  reorderGroup(id: string, beforeId?: string): boolean {
    const group = this.state.groups.find((entry) => entry.id === id);
    if (!group) return false;
    const peers = this.state.groups.filter((entry) => entry.kind === group.kind);
    const result = reordered(peers, id, beforeId);
    if (!result) return false;
    let index = 0;
    this.state.groups = this.state.groups.map((entry) => entry.kind === group.kind ? result[index++] : entry);
    this.persist();
    return true;
  }

  reorderItem(id: string, beforeId: string | undefined, groupId: string): boolean {
    const item = this.state.items.find((entry) => entry.id === id);
    const group = this.state.groups.find((entry) => entry.id === groupId);
    const before = beforeId === undefined ? undefined : this.state.items.find((entry) => entry.id === beforeId);
    if (!item || !group || (item.kind === "coding" && group.kind !== "project") || beforeId === id || (beforeId !== undefined && (!before || before.groupId !== groupId))) return false;
    const result = this.state.items.filter((entry) => entry.id !== id);
    const lastInGroup = result.map((entry) => entry.groupId).lastIndexOf(groupId);
    const index = beforeId !== undefined ? result.findIndex((entry) => entry.id === beforeId) : lastInGroup < 0 ? result.length : lastInGroup + 1;
    result.splice(index, 0, item);
    if (item.groupId === groupId && result.every((entry, position) => entry === this.state.items[position])) return false;
    this.move(id, groupId);
    this.state.items = result;
    this.persist();
    return true;
  }

  reorderFavorite(id: string, beforeId?: string): boolean {
    const result = reordered(this.state.favorites, id, beforeId);
    if (!result) return false;
    this.state.favorites = result;
    this.persist();
    return true;
  }

  closeMany(ids: string[]): boolean {
    const previousTabs = [...this.state.tabs];
    const closed = previousTabs.flatMap((id, index) => ids.includes(id) ? [{ id, index }] : []);
    if (!closed.length || (previousTabs.length === 1 && previousTabs[0] === "home")) return false;
    const previousActive = this.state.activeId;
    this.closedTabs.push({ tabs: closed, activeId: previousActive, fallbackHome: closed.length === previousTabs.length && !previousTabs.includes("home") });
    this.closedTabs = this.closedTabs.slice(-20);
    this.state.tabs = previousTabs.filter((id) => !ids.includes(id));
    if (!this.state.tabs.length) this.state.tabs.push("home");
    const active = this.state.tabs.includes(previousActive) ? previousActive : this.state.tabs[Math.min(previousTabs.indexOf(previousActive), this.state.tabs.length - 1)];
    const visitedBefore = this.history.slice(0, this.historyIndex + 1).filter((id) => this.state.tabs.includes(id)).length;
    this.history = this.history.filter((id) => this.state.tabs.includes(id));
    this.historyIndex = Math.max(0, visitedBefore - 1);
    if (!this.history.length) { this.history = [active]; this.historyIndex = 0; }
    if (this.history[this.historyIndex] !== active) {
      this.history = [...this.history.slice(0, this.historyIndex + 1), active];
      this.historyIndex = this.history.length - 1;
    }
    for (const mode of navigationModes) {
      if (!this.state.tabs.includes(this.state.lastActive[mode] ?? "")) delete this.state.lastActive[mode];
    }
    if (active !== previousActive) this.open(active, false);
    this.persist();
    return true;
  }

  restoreClosed(): string | undefined {
    const batch = this.closedTabs.pop();
    if (!batch) return;
    const restored = batch.tabs.filter((tab) => tab.id === "home" || this.state.items.some((item) => item.id === tab.id));
    if (batch.fallbackHome && this.state.tabs.length === 1 && this.state.tabs[0] === "home" && restored.length) {
      this.state.tabs = [];
      this.history = [];
      this.historyIndex = -1;
      delete this.state.lastActive.home;
    }
    for (const tab of restored) {
      if (!this.state.tabs.includes(tab.id)) this.state.tabs.splice(Math.min(tab.index, this.state.tabs.length), 0, tab.id);
    }
    const active = restored.find((tab) => tab.id === batch.activeId)?.id ?? restored.at(-1)?.id;
    if (active) this.open(active);
    return active;
  }

  travel(delta: number): void {
    const next = this.historyIndex + delta;
    if (next < 0 || next >= this.history.length) return;
    this.historyIndex = next;
    this.open(this.history[next], false);
  }

  toggleGroup(id: string): void {
    if (!this.state.groups.some((group) => group.id === id)) return;
    this.state.expanded = this.state.expanded.includes(id) ? this.state.expanded.filter((entry) => entry !== id) : [...this.state.expanded, id];
    this.persist();
  }

  navigate(mode: NavigationMode): void {
    if (!navigationModes.includes(mode)) return;
    this.state.sidebarVisible = true;
    this.state.navigationMode = mode;
    this.state.activityVisible = false;
    this.persist();
  }

  toggleActivity(): void {
    this.state.activityVisible = !this.state.activityVisible || !this.state.sidebarVisible;
    this.state.sidebarVisible = true;
    this.persist();
  }

  setActivityFilter(filter: ActivityFilter): void {
    if (filter !== "all" && filter !== "unread") return;
    this.state.activityFilter = filter;
    this.persist();
  }

  pinSession(id: string): boolean {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item || !isSession(item)) return false;
    item.activity ??= { status: "idle", unread: false, pinned: false };
    item.activity.pinned = !item.activity.pinned;
    if (item.activity.pinned) this.state.collapsedSections = this.state.collapsedSections.filter((id) => id !== "activity-priority" && id !== "chat-activity-priority");
    this.persist();
    return true;
  }

  markSessionRead(id: string, read = true): boolean {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item || !isSession(item)) return false;
    item.activity ??= { status: "idle", unread: false, pinned: false };
    item.activity.unread = !read;
    this.persist();
    return true;
  }

  markAllSessionsRead(): void {
    for (const item of this.state.items) if (isSession(item) && item.activity) item.activity.unread = false;
    this.persist();
  }

  // Agent adapters report actual session events here; visiting a tab never invents an update.
  recordSessionActivity(id: string, update: SessionActivityUpdate, viewed = false): boolean {
    const item = this.state.items.find((entry) => entry.id === id) ?? this.state.archives.flatMap((record) => record.items).find((entry) => entry.id === id);
    if (!item || !isSession(item) || !sessionStatuses.includes(update.status) || !validTimestamp(update.updatedAt)) return false;
    const previous = item.activity ?? { status: "idle", unread: false, pinned: false };
    if (previous.updatedAt && Date.parse(update.updatedAt) < Date.parse(previous.updatedAt)) return false;
    const summary = update.summary === undefined ? previous.summary : update.summary.trim().slice(0, 480) || undefined;
    const changed = previous.status !== update.status || previous.summary !== summary || previous.updatedAt !== update.updatedAt;
    if (!changed) return false;
    item.activity = { ...previous, status: update.status, summary, updatedAt: update.updatedAt, unread: viewed ? false : true };
    this.persist();
    return true;
  }

  toggleSection(id: string): void {
    this.state.collapsedSections = this.state.collapsedSections.includes(id) ? this.state.collapsedSections.filter((entry) => entry !== id) : [...this.state.collapsedSections, id];
    this.persist();
  }

  locateGroup(id: string, preserveContext = false): boolean {
    const group = this.state.groups.find((entry) => entry.id === id);
    if (!group) return false;
    this.state.activityVisible = false;
    this.state.sidebarVisible = true;
    const mode = this.state.navigationMode;
    const visible = (mode === "library" && group.kind === "space") || (mode === "projects" && group.kind === "project");
    if (!(preserveContext && visible)) this.state.navigationMode = group.kind === "project" ? "projects" : "library";
    this.revealGroup(id);
    this.persist();
    return true;
  }

  locateItem(id: string): boolean {
    const item = this.state.items.find((entry) => entry.id === id);
    return !!item?.groupId && this.locateGroup(item.groupId);
  }

  private revealGroup(id: string): void {
    if (!this.state.expanded.includes(id)) this.state.expanded.push(id);
    const group = this.state.groups.find((entry) => entry.id === id);
    const mode = this.state.navigationMode;
    this.state.groupContext[mode] = id;
    const section = mode === "home" ? group?.kind === "project" ? "home-projects" : "home-spaces" : mode === "chat" ? "chat-groups" : mode === "library" ? "library-pages" : "projects-groups";
    this.state.collapsedSections = this.state.collapsedSections.filter((entry) => entry !== section);
  }

  creationGroups(kind: ContentKind): WorkspaceGroup[] {
    return this.state.groups.filter((group) => kind !== "coding" || group.kind === "project");
  }

  creationGroup(kind: ContentKind, preferredGroup?: string): string | undefined {
    const allowed = this.creationGroups(kind);
    const activeGroup = this.item(this.state.activeId)?.groupId;
    const context = this.state.groupContext[this.state.navigationMode];
    const candidates = [preferredGroup, context, activeGroup, kind === "coding" ? this.state.groupContext.projects : undefined];
    return candidates.find((id) => allowed.some((group) => group.id === id)) ?? allowed.find((group) => group.kind === (kind === "coding" || this.state.navigationMode === "projects" ? "project" : "space"))?.id ?? allowed[0]?.id;
  }

  addItem(kind: ContentKind, title: string, groupId: string, companionId: string = this.state.selectedCompanionId): string | undefined {
    const group = this.creationGroups(kind).find((entry) => entry.id === groupId);
    title = title.trim();
    if (!group || !title || !contentKinds.includes(kind)) return;
    const id = crypto.randomUUID();
    this.state.items.push(normalizeItem({ id, kind, title, groupId, ...(kind === "conversation" ? { companionId } : {}), ...(kind !== "page" ? { activity: { status: "idle", unread: false, pinned: false, updatedAt: new Date().toISOString() } } : {}) }));
    this.open(id);
    return id;
  }

  addItemWithGroup(kind: ContentKind, title: string, groupTitle: string, groupKind: GroupKind = kind === "coding" ? "project" : "space", companionId: string = this.state.selectedCompanionId): string | undefined {
    title = title.trim(); groupTitle = groupTitle.trim();
    if (!title || !groupTitle || !contentKinds.includes(kind) || (groupKind !== "space" && groupKind !== "project") || (kind === "coding" && groupKind !== "project")) return;
    const groupId = crypto.randomUUID();
    this.state.groups.push({ id: groupId, kind: groupKind, title: groupTitle });
    return this.addItem(kind, title, groupId, companionId);
  }

  addGroup(kind: GroupKind, title: string): string | undefined {
    title = title.trim();
    if (!title || (kind !== "space" && kind !== "project")) return;
    const id = crypto.randomUUID();
    this.state.groups.push({ id, kind, title });
    this.revealGroup(id);
    this.persist();
    return id;
  }

  rename(id: string, title: string): void {
    title = title.trim();
    if (!title) return;
    const item = this.state.items.find((entry) => entry.id === id) ?? this.state.groups.find((entry) => entry.id === id);
    if (item) item.title = title;
    this.persist();
  }

  favorite(id: string): void {
    if (!this.state.items.some((item) => item.id === id)) return;
    this.state.favorites = this.state.favorites.includes(id) ? this.state.favorites.filter((entry) => entry !== id) : [...this.state.favorites, id];
    if (this.state.favorites.includes(id)) this.state.collapsedSections = this.state.collapsedSections.filter((entry) => !entry.endsWith("-favorites"));
    this.persist();
  }

  move(id: string, groupId: string): boolean {
    const item = this.state.items.find((entry) => entry.id === id);
    const group = this.state.groups.find((entry) => entry.id === groupId);
    if (!item || !group || (item.kind === "coding" && group.kind !== "project")) return false;
    item.groupId = groupId;
    // Moving a background entry must not replace the user's current view.
    if (this.state.activeId === id) this.open(id, false);
    else {
      for (const mode of navigationModes) {
        const last = this.state.lastActive[mode];
        if (last && this.modeFor(last) !== mode) delete this.state.lastActive[mode];
      }
    }
    this.persist();
    return true;
  }

  archiveItem(id: string): string | undefined {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item) return;
    const group = this.state.groups.find((entry) => entry.id === item.groupId);
    const record = this.archiveSnapshot("item", [item], group);
    this.state.archives.unshift(record);
    this.removeContentViews([id]);
    return record.id;
  }

  archiveGroup(id: string): string | undefined {
    const group = this.state.groups.find((entry) => entry.id === id);
    if (!group) return;
    const items = this.state.items.filter((item) => item.groupId === id);
    const record = this.archiveSnapshot("group", items, group);
    this.state.archives.unshift(record);
    detachGroup(this.state, id);
    this.removeContentViews(items.map((item) => item.id), [`group:${id}`]);
    return record.id;
  }

  restoreArchive(id: string): RestoreResult | undefined {
    const record = this.state.archives.find((entry) => entry.id === id);
    if (!record) return;
    const result = restoreContent(this.state, record);
    this.state.archives = this.state.archives.filter((entry) => entry.id !== id);
    this.persist();
    return result;
  }

  deleteItem(id: string): string | undefined {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item || !canDeleteContent([item])) return;
    const group = this.state.groups.find((entry) => entry.id === item.groupId);
    const record = { ...contentSnapshot(this.state, "item", [item], group), id: crypto.randomUUID(), deletedAt: new Date().toISOString() };
    this.state.trash.unshift(record);
    this.removeContentViews([id]);
    return record.id;
  }

  deleteGroup(id: string): string | undefined {
    const group = this.state.groups.find((entry) => entry.id === id);
    const items = this.state.items.filter((entry) => entry.groupId === id);
    if (!group || !canDeleteContent(items)) return;
    const record = { ...contentSnapshot(this.state, "group", items, group), id: crypto.randomUUID(), deletedAt: new Date().toISOString() };
    this.state.trash.unshift(record);
    detachGroup(this.state, id);
    this.removeContentViews(items.map((item) => item.id), [`group:${id}`]);
    return record.id;
  }

  deleteArchive(id: string): string | undefined {
    const record = this.state.archives.find((entry) => entry.id === id);
    if (!record || !canDeleteContent(record.items)) return;
    this.state.trash.unshift({ ...record, deletedAt: new Date().toISOString() });
    this.state.archives = this.state.archives.filter((entry) => entry.id !== id);
    this.persist();
    return id;
  }

  restoreTrash(id: string): RestoreResult | undefined {
    const record = this.state.trash.find((entry) => entry.id === id);
    if (!record) return;
    let result: RestoreResult;
    if (record.archivedAt) {
      const { deletedAt: _deletedAt, ...snapshot } = record;
      this.state.archives.unshift({ ...snapshot, archivedAt: record.archivedAt });
      result = { archiveId: id };
    } else result = restoreContent(this.state, record);
    this.state.trash = this.state.trash.filter((entry) => entry.id !== id);
    this.persist();
    return result;
  }

  private archiveSnapshot(target: ArchiveRecord["target"], items: WorkspaceItem[], group?: WorkspaceGroup): ArchiveRecord {
    return { ...contentSnapshot(this.state, target, items, group), id: crypto.randomUUID(), archivedAt: new Date().toISOString() };
  }

  private removeContentViews(itemIds: string[], otherIds: string[] = []): void {
    const removed = new Set([...itemIds, ...otherIds]);
    this.state.items = this.state.items.filter((item) => !removed.has(item.id));
    this.state.favorites = this.state.favorites.filter((id) => !removed.has(id));
    this.state.recent = this.state.recent.filter((id) => !removed.has(id));
    this.closeMany([...removed]);
    // Closing a view is reversible with the tab shortcut; archive and trash recover content explicitly.
    this.closedTabs = this.closedTabs.flatMap((batch) => {
      const tabs = batch.tabs.filter((tab) => !removed.has(tab.id));
      return tabs.length ? [{ ...batch, tabs, activeId: removed.has(batch.activeId) ? tabs.at(-1)!.id : batch.activeId }] : [];
    });
    this.persist();
  }
}
