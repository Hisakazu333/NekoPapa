import { MessagesSquareIcon, SettingsIcon } from "@/components/foundations/icons/app-icons";
import type { NavigationLayout } from "@/app/dock-magnification";
import type { useAgentChatSidebar } from "@/components/application/agent-chat/use-agent-chat-sidebar";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardSidebarDrawer } from "./dashboard-sidebar-drawer";
import { SidebarPeek, type SidebarPeekController } from "./sidebar-peek";
import { WorkspaceDock } from "./workspace-dock";

/**
 * The workspace's main navigation in the layout chosen under 设置 → 外观:
 * the left sidebar (with its hover peek when hidden, and the narrow-window
 * drawer), or the bottom dock. The dock keeps the sidebar's destinations;
 * conversations, search and the account menu stay in the sidebar, which the
 * dock opens as the overlay drawer.
 */
export function WorkspaceNavigation({ layout, sidebar, page, preferRail, sidebarHidden, peek, navOpen, setNavOpen, contained, onOpenSettings }: {
  layout: NavigationLayout;
  sidebar: ReturnType<typeof useAgentChatSidebar>;
  page: string;
  preferRail: boolean;
  sidebarHidden: boolean;
  peek: SidebarPeekController;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  contained: boolean;
  onOpenSettings: () => void;
}) {
  const dock = layout === "dock";
  return <>
    {!dock && <>
      {/* The browser and the tool panels (目录 / 终端 / 更改 / 文件) all fold the sidebar to its rail for room. */}
      <DashboardSidebar {...sidebar} selected={page} preferRail={preferRail} className={sidebarHidden ? "hidden" : "hidden lg:flex"} />
      <SidebarPeek peek={peek}>
        {(close) => <DashboardSidebar mobile {...sidebar} selected={page} onClose={close} className="flex" />}
      </SidebarPeek>
    </>}
    {/* The Pro template pushes the workspace across; this is the plain overlay drawer. */}
    <DashboardSidebarDrawer open={navOpen} contained={contained} always={dock} onClose={() => setNavOpen(false)}>
      <DashboardSidebar mobile {...sidebar} selected={page} onClose={() => setNavOpen(false)} className="flex" />
    </DashboardSidebarDrawer>
    {dock && <WorkspaceDock groups={[
      sidebar.items.map((item) => ({ key: item.key, label: item.label, icon: item.icon, selected: page === item.key, onSelect: () => item.onSelect?.() })),
      [
        { key: "sidebar", label: "对话、搜索与账号", icon: MessagesSquareIcon, selected: navOpen, onSelect: () => setNavOpen(!navOpen) },
        { key: "settings", label: "设置", icon: SettingsIcon, onSelect: onOpenSettings },
      ],
    ]} />}
  </>;
}
