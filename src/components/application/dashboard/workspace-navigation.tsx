import { useEffect } from "react";
import { EllipsisIcon, MessagesSquareIcon, SearchIcon, SettingsIcon } from "@/components/foundations/icons/app-icons";
import type { NavigationLayout } from "@/app/navigation/dock-magnification";
import type { useAgentChatSidebar } from "@/components/application/agent-chat/use-agent-chat-sidebar";
import { DashboardAccountMenu } from "./dashboard-account-menu";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardSidebarDrawer } from "./dashboard-sidebar-drawer";
import { DockSearchPanel } from "./dock-search-panel";
import { SidebarMoreList } from "./sidebar-more-menu";
import { isSidebarQuickSearchShortcut } from "./sidebar-search";
import { SidebarPeek, type SidebarPeekController } from "./sidebar-peek";
import { WorkspaceDock } from "./workspace-dock";

/** ⌘L / Ctrl+K opens 搜索 while the dock replaces the sidebar (which owns the shortcut otherwise). */
function useDockSearchShortcut(enabled: boolean, open: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isSidebarQuickSearchShortcut(event, navigator.platform)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']"))) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, open]);
}

/**
 * The workspace's main navigation in the layout chosen under 设置 → 外观:
 * the left sidebar (with its hover peek when hidden, and the narrow-window
 * drawer), or the bottom dock. The dock carries the sidebar's pages and
 * opens 对话, 搜索 and 更多 as panels above itself; the account avatar opens
 * the account menu, and 设置 opens settings. The drawer belongs to sidebar layout.
 */
export function WorkspaceNavigation({ layout, sidebar, page, preferRail, sidebarHidden, peek, navOpen, setNavOpen, contained, dockPanel, onDockPanelChange, onOpenSettings }: {
  layout: NavigationLayout;
  sidebar: ReturnType<typeof useAgentChatSidebar>;
  page: string;
  preferRail: boolean;
  sidebarHidden: boolean;
  peek: SidebarPeekController;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  contained: boolean;
  /** The dock's open panel; finished navigation closes it. */
  dockPanel: string | null;
  onDockPanelChange: (key: string | null) => void;
  onOpenSettings: () => void;
}) {
  const dock = layout === "dock";
  useDockSearchShortcut(dock, () => onDockPanelChange("search"));
  const moreSelected = sidebar.more.entries.some((entry) => entry.id === page && !entry.pinned);
  return <>
    {!dock && <>
      {/* The browser and the tool panels (目录 / 终端 / 更改 / 文件) all fold the sidebar to its rail for room. */}
      <DashboardSidebar {...sidebar} selected={page} preferRail={preferRail} className={sidebarHidden ? "hidden" : "hidden lg:flex"} />
      <SidebarPeek peek={peek}>
        {(close) => <DashboardSidebar mobile {...sidebar} selected={page} onClose={close} className="flex" />}
      </SidebarPeek>
      <DashboardSidebarDrawer open={navOpen} contained={contained} onClose={() => setNavOpen(false)}>
        <DashboardSidebar mobile {...sidebar} selected={page} onClose={() => setNavOpen(false)} className="flex" />
      </DashboardSidebarDrawer>
    </>}
    {dock && <WorkspaceDock openPanel={dockPanel} onPanelChange={onDockPanelChange} groups={[
      [
        ...sidebar.items.map((item) => ({ key: item.key, label: item.label, icon: item.icon, selected: page === item.key, onSelect: () => item.onSelect?.() })),
        { key: "more", label: "更多", icon: EllipsisIcon, selected: moreSelected, panel: {
          className: "w-[248px]",
          content: (close: () => void) => <SidebarMoreList entries={sidebar.more.entries} notice={sidebar.more.notice}
            onTogglePin={sidebar.more.onTogglePin} onOpened={close} place="悬浮栏" />,
        } },
      ],
      [
        { key: "conversations", label: "对话", icon: MessagesSquareIcon, panel: {
          className: "w-[360px]",
          content: () => <div className="p-1.5">{sidebar.conversations()}</div>,
        } },
        { key: "search", label: "快速搜索", icon: SearchIcon, panel: {
          className: "w-[360px]",
          content: (close: () => void) => <DockSearchPanel entries={sidebar.searchEntries} onSelect={sidebar.onSearchSelect} onClose={close} />,
        } },
      ],
      [
        { key: "account", label: "账号", renderControl: (open, onOpenChange) => <DashboardAccountMenu collapsed placement="top" offset={14} dockState={{ open, onOpenChange }} /> },
        { key: "settings", label: "设置", icon: SettingsIcon, onSelect: onOpenSettings },
      ],
    ]} />}
  </>;
}
