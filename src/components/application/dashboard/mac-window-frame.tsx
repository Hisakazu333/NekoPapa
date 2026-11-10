import { useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeftIcon, ArrowRightIcon, PanelLeftIcon, PlusIcon, Trash2Icon } from "@/components/foundations/icons/app-icons";
import { ToolbarIconButton } from "./toolbar-icon-button";
import { cx } from "@/utils/cx";

export function isMacTauriWindow() {
  return typeof navigator !== "undefined" && /mac/i.test(navigator.platform) && isTauri();
}

export function useMacWindowFullscreen(enabled: boolean) {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const window = getCurrentWindow();
    let live = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      void window.isFullscreen().then((value) => {
        if (live && current === request) setFullscreen(value);
      }).catch(() => {});
    };
    const subscription = window.onResized(refresh).then((unlisten) => {
      if (!live) unlisten();
      return live ? unlisten : undefined;
    }).catch(() => undefined);
    refresh();
    return () => {
      live = false;
      void subscription.then((unlisten) => unlisten?.());
    };
  }, [enabled]);
  return fullscreen;
}

export function MacWindowFrame({
  children,
  contained = false,
  className,
  titlebarContent,
  toolbarNavigation,
  sidebarToggle,
  dockInset = false,
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
    /** 清理标签: close every tab and start one new chat; omitted where there are no tabs. */
    onClearTabs?: () => void;
    canClearTabs?: boolean;
  };
  /** Hides or shows the desktop sidebar; only shown where that sidebar exists (lg and up). */
  sidebarToggle?: { hidden: boolean; onToggle: () => void; shortcut: string; onHoverChange?: (inside: boolean, pointerType: string) => void };
  /** Keeps a strip free at the bottom for the floating dock (导航布局 → 底部悬浮栏). */
  dockInset?: boolean;
}) {
  const macWindow = !contained && isMacTauriWindow();
  const fullscreen = useMacWindowFullscreen(macWindow);
  const height = contained ? "h-[var(--template-preview-height)]" : "h-dvh";
  const inset = dockInset && "pb-[76px]";
  const frameClass = cx("relative flex w-full gap-4 overflow-hidden bg-background-full p-3", inset, height, className);

  const navigation = toolbarNavigation && (
    <div role="group" className="flex shrink-0 items-center gap-0.5" aria-label="工作区导航">
      {sidebarToggle && <>
        <ToolbarIconButton icon={PanelLeftIcon} label={sidebarToggle.hidden ? "显示侧栏" : "隐藏侧栏"} onPress={sidebarToggle.onToggle}
          shortcut={sidebarToggle.shortcut} className="hidden lg:inline-flex" onHoverChange={sidebarToggle.onHoverChange} />
        <span aria-hidden className="mx-1 hidden h-4 w-px bg-separator-border lg:block" />
      </>}
      {dockInset && <span className="me-2 flex shrink-0 items-center gap-1.5 text-body-2-medium text-text-primary">
        <img alt="" src="/brand/nekopapa-app-icon-v1-128.png" className="size-5 rounded-md" />
        <span translate="no">NekoPapa</span>
      </span>}
      <ToolbarIconButton icon={ArrowLeftIcon} label="返回" onPress={toolbarNavigation.onBack} isDisabled={!toolbarNavigation.canGoBack} />
      <ToolbarIconButton icon={ArrowRightIcon} label="前进" onPress={toolbarNavigation.onForward} isDisabled={!toolbarNavigation.canGoForward} />
      {toolbarNavigation.onClearTabs && <ToolbarIconButton icon={Trash2Icon} label="关闭全部标签，回到新对话（对话仍保留在侧栏）"
        onPress={toolbarNavigation.onClearTabs} isDisabled={!toolbarNavigation.canClearTabs} />}
      {!toolbarNavigation.createInTabs && <>
        <span aria-hidden className="mx-1 h-4 w-px bg-separator-border" />
        <ToolbarIconButton icon={PlusIcon} label="新建对话" onPress={toolbarNavigation.onCreate} />
      </>}
    </div>
  );
  if (contained) return <div className={frameClass}>{children}</div>;

  if (!macWindow) {
    return (
      <div className={cx("flex h-dvh w-full flex-col overflow-hidden bg-background-full", className)}>
        <header aria-label="工作区工具栏" className="flex h-10 shrink-0 items-center gap-3 px-2">
          {navigation}
          {titlebarContent && <div className="flex min-w-0 flex-1 items-center">{titlebarContent}</div>}
        </header>
        <div className={cx("relative flex min-h-0 w-full flex-1 gap-4 overflow-hidden p-3", inset)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cx("flex h-dvh w-full flex-col overflow-hidden bg-background-full", className)}>
      <header
        aria-label="NekoPapa window title bar"
        className={cx("flex h-10 shrink-0 select-none items-center text-text-primary", fullscreen ? "ps-2" : "ps-[88px]")}
      >
        {navigation}
        {titlebarContent ? (
          <div className="flex h-full min-w-0 flex-1 items-center ps-6 pe-3">{titlebarContent}</div>
        ) : (
          <div data-tauri-drag-region className="h-full min-w-0 flex-1" />
        )}
      </header>
      <div className={cx("relative flex min-h-0 w-full flex-1 gap-4 overflow-hidden p-3", inset)}>{children}</div>
    </div>
  );
}
