import type { ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { RiArrowLeftLine, RiArrowRightLine, RiAddLine, RiSideBarLine } from "@remixicon/react";
import { ToolbarIconButton } from "./toolbar-icon-button";
import { cx } from "@/utils/cx";

export function isMacTauriWindow() {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform) && isTauri();
}

export function MacWindowFrame({
  children,
  contained = false,
  className,
  titlebarContent,
  toolbarNavigation,
  sidebarToggle,
}: {
  children: ReactNode;
  contained?: boolean;
  className?: string;
  titlebarContent?: ReactNode;
  toolbarNavigation?: {
    onBack: () => void;
    onForward: () => void;
    onCreate: () => void;
    canGoBack?: boolean;
    canGoForward?: boolean;
    /** The open-chat tabs carry 新建对话 at their end (browser-style), so it is not repeated here. */
    createInTabs?: boolean;
  };
  /** Hides or shows the desktop sidebar; only shown where that sidebar exists (lg and up). */
  sidebarToggle?: { hidden: boolean; onToggle: () => void; shortcut: string };
}) {
  const height = contained ? "h-[var(--template-preview-height)]" : "h-dvh";
  const frameClass = cx("relative flex w-full gap-4 overflow-hidden bg-background-full p-3", height, className);

  const navigation = toolbarNavigation && (
    <div role="group" className="flex shrink-0 items-center gap-0.5" aria-label="工作区导航">
      {sidebarToggle && <>
        <ToolbarIconButton icon={RiSideBarLine} label={sidebarToggle.hidden ? "显示侧栏" : "隐藏侧栏"} onPress={sidebarToggle.onToggle}
          shortcut={sidebarToggle.shortcut} className="hidden lg:inline-flex" />
        <span aria-hidden className="mx-1 hidden h-4 w-px bg-separator-border lg:block" />
      </>}
      <ToolbarIconButton icon={RiArrowLeftLine} label="返回" onPress={toolbarNavigation.onBack} isDisabled={!toolbarNavigation.canGoBack} />
      <ToolbarIconButton icon={RiArrowRightLine} label="前进" onPress={toolbarNavigation.onForward} isDisabled={!toolbarNavigation.canGoForward} />
      {!toolbarNavigation.createInTabs && <>
        <span aria-hidden className="mx-1 h-4 w-px bg-separator-border" />
        <ToolbarIconButton icon={RiAddLine} label="新建对话" onPress={toolbarNavigation.onCreate} />
      </>}
    </div>
  );
  if (contained) return <div className={frameClass}>{children}</div>;

  if (!isMacTauriWindow()) {
    return (
      <div className={cx("flex h-dvh w-full flex-col overflow-hidden bg-background-full", className)}>
        <header aria-label="工作区工具栏" className="flex h-10 shrink-0 items-center gap-3 px-2">
          {navigation}
          {titlebarContent && <div className="flex min-w-0 flex-1 items-center">{titlebarContent}</div>}
        </header>
        <div className="relative flex min-h-0 w-full flex-1 gap-4 overflow-hidden p-3">{children}</div>
      </div>
    );
  }

  return (
    <div className={cx("flex h-dvh w-full flex-col overflow-hidden bg-background-full", className)}>
      <header
        aria-label="NekoPapa window title bar"
        className="flex h-10 shrink-0 select-none items-center ps-[88px] text-text-primary"
      >
        {navigation}
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
