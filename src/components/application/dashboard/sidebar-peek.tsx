import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/utils/cx";
import { useHoverIntent } from "./use-hover-intent";
import "./sidebar-resize-frame.css";

/**
 * While the sidebar is hidden, resting the mouse on the window's left edge
 * or on the title-bar sidebar button slides it in over the workspace; moving
 * away slides it out again. Clicking the button shows the sidebar for good.
 * Nothing in the workspace moves, and the hidden choice is unchanged — the
 * title-bar button or ⌘B brings the sidebar back for good. Escape and the
 * panel's close button also dismiss it. Desktop (lg) only.
 */
export type SidebarPeekController = ReturnType<typeof useSidebarPeek>;

/** Peek state shared by the window edge, the title-bar sidebar button and the panel. */
export function useSidebarPeek(enabled: boolean) {
  const panel = useRef<HTMLDivElement>(null);
  // Stay while a menu or popover opened from the panel is open (it renders
  // outside it), or while typing in its search field.
  const keepOpen = () => Boolean(document.querySelector("[data-trigger]"))
    || (document.activeElement instanceof HTMLInputElement && Boolean(panel.current?.contains(document.activeElement)));
  const intent = useHoverIntent({ enabled, openDelay: 300, keepOpen });
  const { setOpen } = intent;
  useEffect(() => { if (!enabled) setOpen(false); }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...intent, panel, enabled };
}

export function SidebarPeek({ peek, children }: { peek: SidebarPeekController; children: (close: () => void) => ReactNode }) {
  const { open, setOpen, hoverProps, panel, enabled } = peek;
  const close = () => setOpen(false);
  if (!enabled) return null;
  return <>
    <div aria-hidden data-sidebar-peek-edge {...hoverProps} className="absolute inset-y-0 start-0 z-40 hidden w-3 lg:block" />
    {open && <div ref={panel} {...hoverProps} data-sidebar-peek
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
      className={cx("absolute inset-y-0 start-0 z-50 hidden p-3 lg:flex",
        "motion-safe:animate-[sidebar-peek-in_180ms_ease-out]")}>
      <div className="flex h-full rounded-3xl shadow-dropdown">{children(close)}</div>
    </div>}
  </>;
}
