import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The sidebar's collapsed state, plus a temporary rail on request: while
 * `preferRail` holds (the built-in browser or a tool panel is open) an expanded sidebar folds
 * to its icon rail to give the page room, and opens again when the request
 * ends. Collapsing or expanding by hand in between is the user's choice and
 * is kept: the sidebar is then not reopened automatically.
 */
export function useSidebarCollapse(preferRail: boolean, enabled: boolean) {
  const [collapsed, setCollapsedState] = useState(false);
  const folded = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (preferRail) {
      setCollapsedState((current) => {
        if (!current) folded.current = true;
        return true;
      });
    } else if (folded.current) {
      folded.current = false;
      setCollapsedState(false);
    }
  }, [preferRail, enabled]);

  const setCollapsed = useCallback((next: boolean) => {
    folded.current = false;
    setCollapsedState(next);
  }, []);

  return [collapsed, setCollapsed] as const;
}
