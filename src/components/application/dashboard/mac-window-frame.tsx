import type { ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { cx } from "@/utils/cx";

export function isMacTauriWindow() {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform) && isTauri();
}

export function MacWindowFrame({
  children,
  contained = false,
  className,
  titlebarContent,
}: {
  children: ReactNode;
  contained?: boolean;
  className?: string;
  titlebarContent?: ReactNode;
}) {
  const height = contained ? "h-[var(--template-preview-height)]" : "h-dvh";
  const frameClass = cx("relative flex w-full gap-4 overflow-hidden bg-background-full p-3", height, className);

  if (contained || !isMacTauriWindow()) return <div className={frameClass}>{children}</div>;

  return (
    <div className={cx("flex h-dvh w-full flex-col overflow-hidden bg-background-full", className)}>
      <header
        aria-label="NekoPapa window title bar"
        className="flex h-10 shrink-0 select-none items-center ps-[88px] text-text-primary"
      >
        <span data-tauri-drag-region className="flex shrink-0 items-center gap-2">
          <img
            src="/brand/nekopapa-app-icon-v1-128.png"
            alt=""
            draggable={false}
            data-tauri-drag-region
            className="size-5 shrink-0 object-contain"
          />
          <span data-tauri-drag-region className="text-body-medium">NekoPapa</span>
        </span>
        {titlebarContent ? (
          <div className="flex h-full min-w-0 flex-1 items-center ps-6 pe-3">{titlebarContent}</div>
        ) : (
          <div data-tauri-drag-region className="h-full min-w-0 flex-1" />
        )}
      </header>
      <div className="relative flex min-h-0 w-full flex-1 gap-4 overflow-hidden p-3">{children}</div>
    </div>
  );
}
