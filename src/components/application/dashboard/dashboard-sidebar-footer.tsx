import { RiSettings3Line } from "@remixicon/react";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { DashboardAccountMenu } from "./dashboard-account-menu";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { cx } from "@/utils/cx";

export function DashboardSidebarFooter({ collapsed }: {
  collapsed: boolean;
}) {
  const localize = useTemplateCopy();
  const openSettings = useWorkspaceSettings();
  return localize((
    <div className="flex w-full shrink-0 flex-col gap-3 pt-3">
      <button type="button" aria-label="设置" title={collapsed ? "设置" : undefined}
        onClick={() => openSettings("general")}
        className={cx("flex cursor-pointer items-center gap-2 rounded-2lg p-2 text-body-medium text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring", collapsed ? "size-9 justify-center" : "w-full")}>
        <RiSettings3Line className="size-5 shrink-0" aria-hidden />
        {!collapsed && <span>设置</span>}
      </button>
      <DashboardAccountMenu collapsed={collapsed} onOpenSettings={openSettings} />
    </div>
  ));
}
