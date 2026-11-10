import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Below `lg` the sidebar rides in as an overlay drawer over the workspace.
 * With the bottom dock (`always`) there is no docked sidebar at any width,
 * so the drawer opens on wide windows too.
 */
export function DashboardSidebarDrawer({ open, contained, always = false, onClose, children }: {
  open: boolean;
  /** Docs preview: keep the drawer inside the preview frame. */
  contained: boolean;
  always?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return <div className={cx(contained ? "absolute" : "fixed", "inset-0 z-50 flex", !always && "lg:hidden")}>
    <button type="button" aria-label="Close navigation" onClick={onClose} className="absolute inset-0 cursor-pointer bg-black/40" />
    <div className="relative flex h-full p-3">{children}</div>
  </div>;
}
