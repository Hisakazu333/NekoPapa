import { itemMode, navigationModes } from "./workspace-model";
import type { ShellState, WorkspaceGroup, WorkspaceItem } from "./workspace-model";

// Exact signatures of the old development seed, never a new-workspace template.
const legacyGroups: Record<string, readonly [string, string]> = {
  daily: ["日常陪伴", "space"], ideas: ["工作与灵感", "space"], "project-neko": ["NekoPapa", "project"],
};
const legacyItems: Record<string, readonly [string, string, string]> = {
  today: ["今天的陪伴", "conversation", "daily"], night: ["睡前聊聊", "conversation", "daily"],
  weekend: ["周末计划", "page", "ideas"], inspiration: ["灵感收集", "page", "ideas"],
  "project-session": ["桌面页面开发", "coding", "project-neko"],
};
const knownFields = new Set(["id", "title", "kind", "groupId", "companionId", "activity"]);
function originalGroup(group?: WorkspaceGroup): boolean {
  const signature = group && legacyGroups[group.id];
  return !!signature && group!.title === signature[0] && group!.kind === signature[1];
}
function originalItem(item: WorkspaceItem, group?: WorkspaceGroup): boolean {
  const signature = legacyItems[item.id];
  if (!signature || !originalGroup(group) || item.title !== signature[0] || item.kind !== signature[1] || item.groupId !== signature[2]) return false;
  if (Object.keys(item).some((key) => !knownFields.has(key)) || (item.companionId && item.companionId !== "lumia")) return false;
  const activity = item.activity;
  // A recorded update or an intentional pin/read change makes the entry user data.
  return !activity || ((!activity.status || activity.status === "idle") && !activity.updatedAt && !activity.summary && !activity.pinned && !activity.unread);
}

export function removeLegacySamples(state: ShellState): void {
  if (state.sampleCleanupVersion === 1) return;
  state.items = state.items.filter((item) => !originalItem(item, state.groups.find((group) => group.id === item.groupId)));
  state.archives = state.archives.flatMap((record) => {
    const items = record.items.filter((item) => !originalItem(item, record.group));
    if (!items.length && (record.target === "item" || originalGroup(record.group))) return [];
    const valid = new Set(items.map((item) => item.id));
    return [{ ...record, items, favoriteIds: record.favoriteIds.filter((id) => valid.has(id)), favoritePositions: record.favoritePositions?.filter(({ id }) => valid.has(id)), itemPositions: record.itemPositions.filter(({ id }) => valid.has(id)) }];
  });
  state.groups = state.groups.filter((group) => !originalGroup(group) || state.items.some((item) => item.groupId === group.id));
  const ids = new Set(state.items.map((item) => item.id));
  state.tabs = state.tabs.filter((id) => id === "home" || ids.has(id));
  if (!state.tabs.length) state.tabs.push("home");
  if (!state.tabs.includes(state.activeId)) state.activeId = state.tabs[0];
  state.favorites = state.favorites.filter((id) => ids.has(id));
  state.recent = state.recent.filter((id) => ids.has(id));
  state.expanded = state.expanded.filter((id) => state.groups.some((group) => group.id === id));
  for (const mode of navigationModes) {
    if (!state.tabs.includes(state.lastActive[mode] ?? "")) delete state.lastActive[mode];
    if (!state.groups.some((group) => group.id === state.groupContext[mode])) delete state.groupContext[mode];
  }
  const active = state.items.find((item) => item.id === state.activeId);
  state.lastActive[active ? itemMode(active, state.groups) : "home"] = state.activeId;
  state.sampleCleanupVersion = 1;
}
