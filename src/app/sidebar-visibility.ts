/**
 * Whether the main sidebar is hidden altogether (beyond its icon rail). Kept
 * on this device so the window opens the way it was left.
 */
export const SIDEBAR_HIDDEN_KEY = "nekopapa.sidebar-hidden.v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function readSidebarHidden(storage: Storage | undefined): boolean {
  try {
    return storage?.getItem(SIDEBAR_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Returns false when the choice could not be saved (it still applies until reload). */
export function writeSidebarHidden(storage: Storage | undefined, hidden: boolean): boolean {
  try {
    storage?.setItem(SIDEBAR_HIDDEN_KEY, hidden ? "1" : "0");
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function sidebarToggleShortcut(platform: string) {
  return /mac|iphone|ipad/i.test(platform) ? "⌘B" : "Ctrl+B";
}

/** ⌘B on Apple platforms, Ctrl+B elsewhere; no other modifiers. */
export function isSidebarToggleShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing" | "repeat">,
  platform: string,
) {
  if (event.altKey || event.shiftKey || event.isComposing || event.repeat || event.key.toLowerCase() !== "b") return false;
  return /mac|iphone|ipad/i.test(platform) ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
