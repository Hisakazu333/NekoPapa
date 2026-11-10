import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/utils/cx";
import { useHoverIntent } from "./use-hover-intent";
import "./sidebar-resize-frame.css";

/**
 * While the sidebar is hidden, resting the mouse on the window's left edge
 * slides it in over the workspace; moving away from it slides it out again.
 * Nothing in the workspace moves, and the hidden choice is unchanged — the
 * title-bar button or ⌘B brings the sidebar back for good. Escape and the
 * panel's close button also dismiss it. Desktop (lg) only.
 */
export function SidebarPeek({ enabled, children }: { enabled: boolean; children: (close: () => void) => ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  // Stay while a menu or popover opened from the panel is open (it renders
  // outside it), or while typing in its search field.
  const keepOpen = () => Boolean(document.querySelector("[data-trigger]"))
    || (document.activeElement instanceof HTMLInputElement && Boolean(panel.current?.contains(document.activeElement)));
  const { open, setOpen, hoverProps } = useHoverIntent({ enabled, openDelay: 200, keepOpen });
  const close = () => setOpen(false);

  useEffect(() => { if (!enabled) setOpen(false); }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
