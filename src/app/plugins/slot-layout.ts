import { isContributionId, type SlotContribution, type SlotId } from "./slot-registry";

/**
 * The user's arrangement of each extension slot, kept on this device:
 * `{ [slotId]: { order, hidden } }` keyed by contribution id. Ids the
 * registry does not know (a plugin removed or not yet loaded) are ignored
 * when arranging but kept, so the arrangement comes back with the entry.
 * Required entries are never hidden. A value that cannot be read leaves the
 * default arrangement in place; unreadable data is copied to a backup key
 * before the next save replaces it.
 */
export const SLOT_LAYOUT_KEY = "nekopapa.slot-layout.v1";
export const SLOT_LAYOUT_BACKUP_KEY = `${SLOT_LAYOUT_KEY}.corrupt`;

export interface SlotArrangement { order: string[]; hidden: string[] }
export type SlotLayout = Partial<Record<string, SlotArrangement>>;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

const ids = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every(isContributionId) ? [...new Set(value as string[])] : undefined;

/** The stored layout, or undefined when the text is not a layout. */
export function parseSlotLayout(text: string): SlotLayout | undefined {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return undefined; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const layout: SlotLayout = {};
  for (const [slot, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return undefined;
    const order = ids((entry as SlotArrangement).order);
    const hidden = ids((entry as SlotArrangement).hidden);
    if (!order || !hidden) return undefined;
    layout[slot] = { order, hidden };
  }
  return layout;
}

export type SlotLayoutRead = { layout: SlotLayout; status: "ok" | "empty" | "corrupt" | "unavailable" };

export function readSlotLayout(storage: Storage | undefined): SlotLayoutRead {
  let text: string | null;
  try {
    if (!storage) return { layout: {}, status: "unavailable" };
    text = storage.getItem(SLOT_LAYOUT_KEY);
  } catch {
    return { layout: {}, status: "unavailable" };
  }
  if (text === null) return { layout: {}, status: "empty" };
  const layout = parseSlotLayout(text);
  if (layout) return { layout, status: "ok" };
  try { storage.setItem(SLOT_LAYOUT_BACKUP_KEY, text); } catch { /* the default layout still applies */ }
  return { layout: {}, status: "corrupt" };
}

/** Returns false when the layout could not be saved (it still applies until reload). */
export function writeSlotLayout(storage: Storage | undefined, layout: SlotLayout): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SLOT_LAYOUT_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

/** The registry's entries in the user's order, split into shown and hidden. */
export function arrangeSlot<T extends SlotContribution>(entries: readonly T[], arrangement: SlotArrangement | undefined): { shown: T[]; hidden: T[] } {
  const rank = new Map((arrangement?.order ?? []).map((id, index) => [id, index]));
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (rank.get(a.entry.id) ?? rank.size + a.index) - (rank.get(b.entry.id) ?? rank.size + b.index)
      || a.index - b.index)
    .map(({ entry }) => entry);
  const hiddenIds = new Set(arrangement?.hidden ?? []);
  return {
    shown: ordered.filter((entry) => entry.required || !hiddenIds.has(entry.id)),
    hidden: ordered.filter((entry) => !entry.required && hiddenIds.has(entry.id)),
  };
}

const arrangementOf = (layout: SlotLayout, slot: SlotId): SlotArrangement => layout[slot] ?? { order: [], hidden: [] };

/** Hides or shows an entry; a required entry stays shown (the layout is returned unchanged). */
export function setSlotEntryHidden(layout: SlotLayout, slot: SlotId, entry: SlotContribution, hidden: boolean): SlotLayout {
  if (hidden && entry.required) return layout;
  const current = arrangementOf(layout, slot);
  const rest = current.hidden.filter((id) => id !== entry.id);
  return { ...layout, [slot]: { ...current, hidden: hidden ? [...rest, entry.id] : rest } };
}

/**
 * Moves an entry one place among the shown entries (`-1` earlier, `1` later),
 * saving the full order so the result does not depend on the registry's.
 */
export function moveSlotEntry<T extends SlotContribution>(layout: SlotLayout, slot: SlotId, entries: readonly T[], id: string, delta: -1 | 1): SlotLayout {
  const current = arrangementOf(layout, slot);
  const { shown, hidden } = arrangeSlot(entries, current);
  const from = shown.findIndex((entry) => entry.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= shown.length) return layout;
  const next = [...shown];
  [next[from], next[to]] = [next[to], next[from]];
  const known = new Set(entries.map((entry) => entry.id));
  // Ids of entries that are not registered now keep their saved places; the
  // known ids fill the other places in their new order.
  const queue = [...next, ...hidden].map((entry) => entry.id);
  const order = current.order.map((other) => (known.has(other) ? queue.shift() : other))
    .filter((other): other is string => other !== undefined).concat(queue);
  return { ...layout, [slot]: { ...current, order } };
}

/** Back to the registry's order with nothing hidden. */
export function resetSlot(layout: SlotLayout, slot: SlotId): SlotLayout {
  const next = { ...layout };
  delete next[slot];
  return next;
}
