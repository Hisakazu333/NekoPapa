/**
 * Hover intent: a surface opens once the pointer has rested on its trigger
 * for `openDelay`, and closes once the pointer has been away from both the
 * trigger and the surface for `closeDelay`. Passing over the trigger on the
 * way elsewhere opens nothing, and crossing the gap between trigger and
 * surface closes nothing. Only a mouse hovers: touch and pen use press.
 */
export interface HoverIntentOptions {
  openDelay: number;
  closeDelay: number;
  isOpen: () => boolean;
  onChange: (open: boolean) => void;
  /** Injected so tests can drive time. */
  schedule?: (run: () => void, delay: number) => unknown;
  cancel?: (handle: unknown) => void;
}

export const HOVER_OPEN_DELAY = 150;
export const HOVER_CLOSE_DELAY = 300;

export function createHoverIntent({
  openDelay, closeDelay, isOpen, onChange,
  schedule = (run, delay) => setTimeout(run, delay),
  cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: HoverIntentOptions) {
  let pending: unknown;
  let inside = 0;
  const clear = () => {
    if (pending !== undefined) cancel(pending);
    pending = undefined;
  };
  return {
    /** The pointer entered the trigger or the surface. */
    enter(pointerType = "mouse") {
      if (pointerType !== "mouse") return;
      inside += 1;
      clear();
      if (!isOpen()) pending = schedule(() => { pending = undefined; onChange(true); }, openDelay);
    },
    /** The pointer left the trigger or the surface. */
    leave(pointerType = "mouse") {
      if (pointerType !== "mouse") return;
      inside = Math.max(0, inside - 1);
      if (inside > 0) return;
      clear();
      if (isOpen()) pending = schedule(() => { pending = undefined; if (inside === 0) onChange(false); }, closeDelay);
    },
    /**
     * Opened or closed some other way (press, Escape, choosing an item):
     * drop any pending change. A closed surface is unmounted without a
     * pointer leave, so closing also forgets where the pointer was.
     */
    settle(open: boolean) {
      clear();
      if (!open) inside = 0;
    },
    dispose: clear,
  };
}
