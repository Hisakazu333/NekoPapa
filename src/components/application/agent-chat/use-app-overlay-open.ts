import { useEffect, useState } from "react";

// Matched by role. The toast region (aria-live, always mounted, its toasts
// are alertdialogs) is skipped: a toast must not hide the page.
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** Menus, popovers and dialogs are portalled to <body>, outside the app root. */
function overlayOpen(): boolean {
  return [...document.body.children].some((child) =>
    child.id !== "app" && child instanceof HTMLElement && !child.hasAttribute("aria-live") &&
    (child.matches(OVERLAY) || child.querySelector(OVERLAY) !== null));
}

/**
 * True while an app menu, popover or dialog is open. The built-in browser's
 * native view always draws above the page, so it steps aside while this holds.
 * Only <body>'s own children are watched, so chat streaming costs nothing here.
 */
export function useAppOverlayOpen(): boolean {
  const [open, setOpen] = useState(() => typeof document !== "undefined" && overlayOpen());
  useEffect(() => {
    const update = () => setOpen(overlayOpen());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);
  return open;
}
