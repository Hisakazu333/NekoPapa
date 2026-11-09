import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/** Below `lg` the sidebar rides in as an overlay drawer over the workspace. */
export function DashboardSidebarDrawer({ open, contained, onClose, children }: {
  open: boolean;
  /** Docs preview: keep the drawer inside the preview frame. */
  contained: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return <div className={cx(contained ? "absolute" : "fixed", "inset-0 z-50 flex lg:hidden")}>
    <button type="button" aria-label="Close navigation" onClick={onClose} className="absolute inset-0 cursor-pointer bg-black/40" />
    <div className="relative flex h-full p-3">{children}</div>
  </div>;
}
