import { useEffect, useRef } from "react";

/** Somewhere Enter or Esc already means something: a field with text in it, a control, a menu or dialog. */
function taken(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[role=dialog], [role=menu], [role=listbox], [aria-modal=true]")) return true;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value.trim() !== "";
  if (target.isContentEditable) return true;
  // A focused button or link answers Enter itself.
  return key === "Enter" && Boolean(target.closest("button, a[href], [role=button], select, summary"));
}

/**
 * Enter allows and Esc denies the approval waiting first, from anywhere in
 * the window except where those keys already do something: typing (a field
 * with text), a focused control, an open menu or dialog, or an IME
 * composition. An empty composer does not count as typing. Only one card
 * listens at a time (`active`).
 */
export function useApprovalKeys(active: boolean, allow: () => void, deny: () => void) {
  const actions = useRef({ allow, deny });
  useEffect(() => { actions.current = { allow, deny }; }, [allow, deny]);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.key !== "Enter" && event.key !== "Escape") || taken(event.target, event.key)) return;
      event.preventDefault();
      if (event.key === "Enter") actions.current.allow();
      else actions.current.deny();
    };
    // Capture: ahead of the composer, whose Enter handler would otherwise take the key first.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);
}
