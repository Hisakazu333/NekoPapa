import { normalizeItem, navigationModes, isSession } from "./workspace-model";
import type { ContentSnapshot, ShellState, WorkspaceGroup, WorkspaceItem } from "./workspace-model";

export interface RestoreResult { itemId?: string; groupId?: string; archiveId?: string }

export function canDeleteContent(items: WorkspaceItem[]): boolean {
  return !items.some((item) => isSession(item) && (item.activity?.status === "running" || item.activity?.status === "waiting"));
}

export function contentSnapshot(state: ShellState, target: ContentSnapshot["target"], items: WorkspaceItem[], group?: WorkspaceGroup): ContentSnapshot {
  return {
    target,
    group: group ? { ...group } : undefined,
    items: items.map(normalizeItem),
    favoriteIds: state.favorites.filter((id) => items.some((item) => item.id === id)),
    favoritePositions: state.favorites.flatMap((id, index) => items.some((item) => item.id === id) ? [{ id, index }] : []),
    itemPositions: items.map((item) => ({ id: item.id, index: state.items.indexOf(item) })),
    groupPosition: group ? state.groups.indexOf(group) : undefined,
    expanded: group ? state.expanded.includes(group.id) : undefined,
  };
}

export function detachGroup(state: ShellState, id: string): void {
  state.groups = state.groups.filter((entry) => entry.id !== id);
  state.expanded = state.expanded.filter((entry) => entry !== id);
  for (const mode of navigationModes) {
    if (state.groupContext[mode] === id) delete state.groupContext[mode];
  }
}

export function restoreContent(state: ShellState, record: ContentSnapshot): RestoreResult {
  if (record.group && !state.groups.some((group) => group.id === record.group!.id)) {
    // Separate item snapshots can predate a later archive or deletion of their parent.
    const parents = [...state.archives, ...state.trash].filter((entry) => entry.target === "group" && entry.group?.id === record.group!.id);
    const parentRecord = parents.sort((a, b) => Date.parse("deletedAt" in b ? b.deletedAt : b.archivedAt) - Date.parse("deletedAt" in a ? a.deletedAt : a.archivedAt))[0] ?? record;
    state.groups.splice(Math.min(parentRecord.groupPosition ?? state.groups.length, state.groups.length), 0, { ...parentRecord.group! });
    if (parentRecord.expanded && !state.expanded.includes(parentRecord.group!.id)) state.expanded.push(parentRecord.group!.id);
  }
  const positions = new Map(record.itemPositions.map((entry) => [entry.id, entry.index]));
  for (const saved of [...record.items].sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0))) {
    if (state.items.some((item) => item.id === saved.id)) continue;
    const item = { ...saved };
    const parent = state.groups.find((group) => group.id === item.groupId);
    if (!parent || (item.kind === "coding" && parent.kind !== "project")) {
      const kind = item.kind === "coding" ? "project" : "space";
      const snapshot = record.group ? state.groups.find((group) => group.id === record.group!.id && (kind !== "project" || group.kind === "project")) : undefined;
      if (snapshot) item.groupId = snapshot.id;
      else {
        let recoveredId = `recovered-${kind}`;
        while (state.groups.some((group) => group.id === recoveredId && group.kind !== kind)) recoveredId += "-1";
        if (!state.groups.some((group) => group.id === recoveredId)) state.groups.push({ id: recoveredId, kind, title: kind === "project" ? "恢复的项目" : "恢复的内容" });
        item.groupId = recoveredId;
      }
    }
    state.items.splice(Math.min(positions.get(item.id) ?? state.items.length, state.items.length), 0, item);
  }
  const favoritePositions = new Map(record.favoritePositions?.map((entry) => [entry.id, entry.index]));
  const favorites = record.favoriteIds.filter((id) => state.items.some((item) => item.id === id)).sort((a, b) => (favoritePositions.get(a) ?? Infinity) - (favoritePositions.get(b) ?? Infinity));
  for (const id of favorites) {
    if (!state.favorites.includes(id)) state.favorites.splice(Math.min(favoritePositions.get(id) ?? state.favorites.length, state.favorites.length), 0, id);
  }
  return record.target === "item" ? { itemId: record.items[0]?.id, groupId: state.items.find((item) => item.id === record.items[0]?.id)?.groupId } : { groupId: record.group?.id };
}
