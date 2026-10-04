import { contentKinds, normalizeItem, unique, stringList } from "./workspace-model";
import type { ArchiveRecord, ContentKind, ContentSnapshot, TrashRecord, WorkspaceGroup, WorkspaceItem } from "./workspace-model";

export function isGroup(value: unknown): value is WorkspaceGroup {
  if (!value || typeof value !== "object") return false;
  const group = value as Record<string, unknown>;
  return typeof group.id === "string" && group.id.length > 0 && typeof group.title === "string" && group.title.trim().length > 0 && (group.kind === "space" || group.kind === "project");
}

export function isItem(value: unknown): value is WorkspaceItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && typeof item.title === "string" && item.title.trim().length > 0 && contentKinds.includes(item.kind as ContentKind) && (item.groupId === undefined || typeof item.groupId === "string");
}

interface HydratedRecord { id: string; date: string; archivedAt?: string; snapshot: ContentSnapshot }

function readPositions(value: unknown, items: WorkspaceItem[]): Array<{ id: string; index: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    return typeof entry.id === "string" && items.some((item) => item.id === entry.id) && typeof entry.index === "number" && Number.isInteger(entry.index) && entry.index >= 0 ? [{ id: entry.id, index: entry.index }] : [];
  });
}

function readRecords(value: unknown, dateKey: "archivedAt" | "deletedAt", occupiedItemIds: Set<string>, systemIds: Set<string>, occupiedRecordIds: Set<string> = new Set()): HydratedRecord[] {
  if (!Array.isArray(value)) return [];
  const recordIds = new Set(occupiedRecordIds);
  const itemIds = new Set(occupiedItemIds);
  return value.flatMap((value: unknown): HydratedRecord[] => {
    if (!value || typeof value !== "object") return [];
    const entry = value as Record<string, unknown>;
    const date = entry[dateKey];
    if (typeof entry.id !== "string" || !entry.id || recordIds.has(entry.id) || typeof date !== "string" || !Number.isFinite(Date.parse(date)) || (entry.target !== "item" && entry.target !== "group") || !Array.isArray(entry.items)) return [];
    if (dateKey === "deletedAt" && entry.archivedAt !== undefined && (typeof entry.archivedAt !== "string" || !Number.isFinite(Date.parse(entry.archivedAt)))) return [];
    const group = isGroup(entry.group) ? { ...entry.group } : undefined;
    if (entry.target === "group" && !group) return [];
    const acceptedIds = new Set<string>();
    const items = entry.items.filter(isItem).filter((item) => {
      if (systemIds.has(item.id) || itemIds.has(item.id) || acceptedIds.has(item.id)) return false;
      acceptedIds.add(item.id);
      return true;
    }).map(normalizeItem);
    if (entry.target === "item" && items.length !== 1) return [];
    // Different archive/delete episodes may share a parent snapshot, but never a content ID.
    recordIds.add(entry.id);
    for (const id of acceptedIds) itemIds.add(id);
    const positions = readPositions(entry.itemPositions, items);
    return [{
      id: entry.id, date, archivedAt: typeof entry.archivedAt === "string" ? entry.archivedAt : undefined,
      snapshot: {
        target: entry.target, group, items,
        favoriteIds: stringList(entry.favoriteIds) ? unique(entry.favoriteIds).filter((id) => acceptedIds.has(id)) : [],
        favoritePositions: Array.isArray(entry.favoritePositions) ? readPositions(entry.favoritePositions, items) : undefined,
        itemPositions: items.map((item, index) => positions.find((position) => position.id === item.id) ?? { id: item.id, index }),
        groupPosition: typeof entry.groupPosition === "number" && Number.isInteger(entry.groupPosition) && entry.groupPosition >= 0 ? entry.groupPosition : undefined,
        expanded: typeof entry.expanded === "boolean" ? entry.expanded : undefined,
      },
    }];
  });
}

export function readArchives(value: unknown, activeIds: Set<string>, systemIds: Set<string>): ArchiveRecord[] {
  return readRecords(value, "archivedAt", activeIds, systemIds).map(({ id, date, snapshot }) => ({ ...snapshot, id, archivedAt: date }));
}

export function readTrash(value: unknown, occupiedIds: Set<string>, systemIds: Set<string>, archiveIds: Set<string>): TrashRecord[] {
  return readRecords(value, "deletedAt", occupiedIds, systemIds, archiveIds).map(({ id, date, snapshot, archivedAt }) => ({ ...snapshot, id, deletedAt: date, ...(archivedAt ? { archivedAt } : {}) }));
}

export function hasRecordDamage(value: unknown, records: ContentSnapshot[]): boolean {
  if (value === undefined) return false;
  if (!Array.isArray(value)) return true;
  const savedItems = value.reduce((count, record) => count + (Array.isArray(record?.items) ? record.items.length : 0), 0);
  return value.length !== records.length || savedItems !== records.reduce((count, record) => count + record.items.length, 0);
}
