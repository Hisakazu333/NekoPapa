import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { DashboardAccountMenu } from "./dashboard-account-menu";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";

/** The account button; 设置 lives in its menu (and on ⌘, / Ctrl+,). */
export function DashboardSidebarFooter({ collapsed }: {
  collapsed: boolean;
}) {
  const localize = useTemplateCopy();
  const openSettings = useWorkspaceSettings();
  return localize((
    <div className="flex w-full shrink-0 flex-col gap-3 pt-3">
      <DashboardAccountMenu collapsed={collapsed} onOpenSettings={openSettings} />
    </div>
  ));
}
