/**
 * Signals between the Agent's tools and the 更改 panel, inside one window:
 * a project's files changed (the panel refreshes), and the user asked to see
 * one file's change (the chat opens 更改 and the panel opens that file).
 * The requested file is also kept until a panel takes it, so a panel that
 * mounts after the request still opens it.
 */

const CHANGED = "nekopapa:project-changed";
const FOCUS = "nekopapa:focus-change";

let pending: string | undefined;

/** Sent when the folder is not known (an undo): every listener treats it as theirs. */
export const ANY_PROJECT = "*";

const target = () => (typeof window === "undefined" ? undefined : window);

export function announceProjectChange(root: string): void {
  target()?.dispatchEvent(new CustomEvent(CHANGED, { detail: { root } }));
}

export function onProjectChange(listener: (root: string) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<{ root: string }>).detail.root);
  target()?.addEventListener(CHANGED, handle);
  return () => target()?.removeEventListener(CHANGED, handle);
}

/** Asks for one file's change (a path relative to the project root) to be shown. */
export function focusChange(path: string): void {
  pending = path;
  target()?.dispatchEvent(new CustomEvent(FOCUS, { detail: { path } }));
}

export function onFocusChange(listener: (path: string) => void): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<{ path: string }>).detail.path);
  target()?.addEventListener(FOCUS, handle);
  return () => target()?.removeEventListener(FOCUS, handle);
}

/** The file waiting to be shown, once: the panel that shows it clears it. */
export function takeFocusedChange(): string | undefined {
  const path = pending;
  pending = undefined;
  return path;
}
