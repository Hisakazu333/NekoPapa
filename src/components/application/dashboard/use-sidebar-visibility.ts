import { useCallback, useEffect, useRef, useState } from "react";
import { isSidebarToggleShortcut, readSidebarHidden, sidebarToggleShortcut, writeSidebarHidden } from "@/app/navigation/sidebar-visibility";

const storage = () => (typeof window === "undefined" ? undefined : window.localStorage);
const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);

/**
 * Hides the desktop sidebar completely, from the title-bar button or ⌘B /
 * Ctrl+B, and remembers it. Rich text is not edited anywhere in the app, so
 * the shortcut also works while typing in the composer.
 */
export function useSidebarVisibility() {
  const [hidden, setHidden] = useState(false);
  const loaded = useRef(false);
  // Read after mount: the server render has no storage.
  useEffect(() => { setHidden(readSidebarHidden(storage())); }, []);
  // Saved on change, once the stored choice has been read.
  useEffect(() => {
    if (loaded.current) writeSidebarHidden(storage(), hidden);
    loaded.current = true;
  }, [hidden]);

  const toggle = useCallback(() => setHidden((current) => !current), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isSidebarToggleShortcut(event, platform())) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return { hidden, toggle, shortcut: sidebarToggleShortcut(platform()) };
}
