import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { GlobeIcon, PanelRightIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";

export type BrowserDropZone = "tab" | "side";

interface DragState { from: BrowserDropZone; x: number; y: number; over: BrowserDropZone | null; label: string }

const THRESHOLD = 6;

/** The drop zone under the pointer: an element marked `data-browser-drop`. */
function zoneAt(x: number, y: number): BrowserDropZone | null {
  const zone = document.elementFromPoint(x, y)?.closest("[data-browser-drop]")?.getAttribute("data-browser-drop");
  return zone === "tab" || zone === "side" ? zone : null;
}

/**
 * Drags the built-in browser between the side area and the title-bar tabs.
 * Pointer events rather than HTML drag and drop: the native page view must
 * step aside while dragging (it would cover the drop zones), and the host's
 * file-drop handling can swallow HTML drag events. A press that does not
 * move counts as a click. Escape cancels.
 */
export function useBrowserDrag(onDrop: (zone: BrowserDropZone) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const cleanup = useRef<() => void>(undefined);
  useEffect(() => () => cleanup.current?.(), []);

  const begin = useCallback((event: ReactPointerEvent, from: BrowserDropZone, label: string, onClick?: () => void) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    let over: BrowserDropZone | null = null;
    const move = (next: PointerEvent) => {
      if (!dragging && Math.hypot(next.clientX - startX, next.clientY - startY) < THRESHOLD) return;
      dragging = true;
      next.preventDefault();
      const zone = zoneAt(next.clientX, next.clientY);
      over = zone === from ? null : zone;
      setDrag({ from, x: next.clientX, y: next.clientY, over, label });
    };
    const finish = (commit: boolean) => {
      cleanup.current?.();
      setDrag(null);
      if (!dragging) { if (commit) onClick?.(); return; }
      if (commit && over) onDropRef.current(over);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (next: KeyboardEvent) => { if (next.key === "Escape") { next.preventDefault(); cancel(); } };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      cleanup.current = undefined;
    };
  }, []);

  return { drag, begin };
}

/**
 * What a drag shows: the dragged chip under the pointer and, when dragging the
 * tab out, the side drop zone over the right of the work area. The title-bar
 * drop zone is drawn by the tab strip itself.
 */
export function BrowserDragLayer({ drag }: { drag: DragState | null }) {
  if (!drag) return null;
  return <>
    {drag.from === "tab" && <div data-browser-drop="side" aria-hidden className={cx(
      "fixed inset-y-14 end-3 z-40 flex w-[38%] min-w-60 items-center justify-center rounded-3xl border-2 border-dashed transition-colors",
      drag.over === "side" ? "border-border-focus-ring bg-background-tertiary-default" : "border-border-button-default bg-background-secondary-default/80",
    )}>
      <span className="flex items-center gap-2 text-body-medium text-text-secondary"><PanelRightIcon className="size-5" aria-hidden />放到侧边</span>
    </div>}
    <div aria-hidden style={{ left: drag.x + 12, top: drag.y + 12 }}
      className="pointer-events-none fixed z-50 flex max-w-56 items-center gap-1.5 rounded-lg bg-background-primary-default px-2.5 py-1.5 text-body-2-medium text-text-primary shadow-lg">
      <GlobeIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span className="truncate">{drag.label}</span>
    </div>
    <span role="status" className="sr-only">{drag.over ? (drag.over === "tab" ? "松开后放到标题栏标签" : "松开后放到侧边") : "拖到标题栏或侧边，按 Esc 取消"}</span>
  </>;
}
