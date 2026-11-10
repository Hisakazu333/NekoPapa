import { useEffect, useRef, useState } from "react";
import { createHoverIntent, HOVER_CLOSE_DELAY, HOVER_OPEN_DELAY } from "@/app/navigation/hover-intent";

/**
 * Open state for a surface that also opens on hover. Spread `hoverProps` on
 * the surface and call `hover` from the trigger's hover events; `setOpen` is
 * for press and keyboard. A surface opened from the keyboard stays open when
 * the mouse moves away, and pressing the trigger of a surface hover already
 * opened keeps it open rather than closing it.
 */
export function useHoverIntent({ openDelay = HOVER_OPEN_DELAY, closeDelay = HOVER_CLOSE_DELAY, enabled = true, keepOpen }: {
  openDelay?: number;
  closeDelay?: number;
  enabled?: boolean;
  /** Checked before a hover close, e.g. while something opened from the surface is still in use. */
  keepOpen?: () => boolean;
} = {}) {
  const keep = useRef(keepOpen);
  keep.current = keepOpen;
  const [open, setOpenState] = useState(false);
  const openRef = useRef(false);
  const sticky = useRef(false);
  const byHover = useRef(false);
  /** One trigger press can report several closes; all of them belong to the confirming click. */
  const confirmedUntil = useRef(0);
  const [intent] = useState(() => createHoverIntent({
    openDelay, closeDelay,
    isOpen: () => openRef.current,
    onChange: (next) => {
      if (!next && (sticky.current || keep.current?.())) return;
      byHover.current = next;
      openRef.current = next;
      setOpenState(next);
    },
  }));
  useEffect(() => () => intent.dispose(), [intent]);

  const setOpen = (next: boolean, { keyboard = false, fromTrigger = false } = {}) => {
    if (!next && fromTrigger && !keyboard && (byHover.current || Date.now() < confirmedUntil.current)) {
      // The click that follows a hover confirms the panel instead of toggling it shut.
      if (byHover.current) confirmedUntil.current = Date.now() + 400;
      byHover.current = false;
      intent.settle(true);
      return;
    }
    byHover.current = false;
    sticky.current = next && keyboard;
    openRef.current = next;
    intent.settle(next);
    setOpenState(next);
  };

  const hover = (inside: boolean, pointerType: string) => {
    if (!enabled) return;
    if (inside) intent.enter(pointerType);
    else intent.leave(pointerType);
  };
  const hoverProps = {
    onPointerEnter: (event: { pointerType: string }) => hover(true, event.pointerType),
    onPointerLeave: (event: { pointerType: string }) => hover(false, event.pointerType),
  };

  return { open, setOpen, hover, hoverProps };
}
