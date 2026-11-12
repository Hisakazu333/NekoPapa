import { useSyncExternalStore } from "react";
import { toast } from "@/components/base/toast/toast";
import {
  arrangeSlot, moveSlotEntry, readSlotLayout, resetSlot, setSlotEntryHidden, writeSlotLayout,
  type SlotLayout,
} from "@/app/plugins/slot-layout";
import type { SlotContribution, SlotId } from "@/app/plugins/slot-registry";

/*
 * One shared copy of the user's slot layout for the window, so the work
 * panel, the command palette and the layout settings change together. It is
 * read once from local storage; each change is applied at once and saved,
 * and a save that fails says so (the change holds until reload).
 */

const storage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
let layout: SlotLayout | undefined;
const listeners = new Set<() => void>();

function current(): SlotLayout {
  if (!layout) {
    const read = readSlotLayout(storage());
    layout = read.layout;
    if (read.status === "corrupt") queueMicrotask(() => toast.error("界面布局记录已损坏", { description: "已按默认布局显示，原记录另存了一份备份。" }));
  }
  return layout;
}

function commit(next: SlotLayout) {
  if (next === layout) return;
  layout = next;
  listeners.forEach((listener) => listener());
  if (!writeSlotLayout(storage(), next)) toast.error("界面布局没有保存", { description: "这次调整暂时有效，重新打开后恢复为上次保存的布局。" });
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useSlotLayout<T extends SlotContribution>(slot: SlotId, entries: readonly T[]) {
  const value = useSyncExternalStore(subscribe, current, current);
  const arranged = arrangeSlot(entries, value[slot]);
  return {
    ...arranged,
    /** Whether the user changed this slot from the default arrangement. */
    customized: Boolean(value[slot]),
    hide: (entry: T) => commit(setSlotEntryHidden(current(), slot, entry, true)),
    show: (entry: T) => commit(setSlotEntryHidden(current(), slot, entry, false)),
    move: (entry: T, delta: -1 | 1) => commit(moveSlotEntry(current(), slot, entries, entry.id, delta)),
    reset: () => commit(resetSlot(current(), slot)),
  };
}
