/**
 * Which "更多" destinations are pinned into the sidebar's main navigation.
 * Pins are a per-device display preference; they never create content.
 */

export const SIDEBAR_PINS_KEY = "nekopapa.sidebar-pins.v1";

/** Ordered list of destinations offered by the sidebar "更多" panel. */
export const sidebarDestinations = ["knowledge", "projects"] as const;
export type SidebarDestination = (typeof sidebarDestinations)[number];
export const defaultSidebarPins: readonly SidebarDestination[] = [];

export interface SidebarPinStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

const isDestination = (value: unknown): value is SidebarDestination => sidebarDestinations.includes(value as SidebarDestination);
/** Keep the panel's order regardless of the order pins were made in. */
const ordered = (pins: Iterable<SidebarDestination>) => {
  const set = new Set(pins);
  return sidebarDestinations.filter((id) => set.has(id));
};

/** Missing or unreadable data falls back to the defaults; unknown IDs are dropped. */
export function readSidebarPins(storage: Pick<SidebarPinStorage, "getItem">): SidebarDestination[] {
  try {
    const raw = storage.getItem(SIDEBAR_PINS_KEY);
    if (raw === null) return [...defaultSidebarPins];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { pins?: unknown }).pins)) return [...defaultSidebarPins];
    return ordered((parsed as { pins: unknown[] }).pins.filter(isDestination));
  } catch {
    return [...defaultSidebarPins];
  }
}

export function toggleSidebarPin(pins: readonly SidebarDestination[], id: SidebarDestination): SidebarDestination[] {
  return pins.includes(id) ? pins.filter((pin) => pin !== id) : ordered([...pins, id]);
}

/** Returns false when the write fails; callers keep the in-memory pins and say so. */
export function saveSidebarPins(storage: Pick<SidebarPinStorage, "setItem">, pins: readonly SidebarDestination[]): boolean {
  try {
    storage.setItem(SIDEBAR_PINS_KEY, JSON.stringify({ version: 1, pins: ordered(pins) }));
    return true;
  } catch {
    return false;
  }
}
