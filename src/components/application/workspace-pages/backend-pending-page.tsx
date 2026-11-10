import { CameraIcon, FolderOpenIcon, MenuIcon } from "@/components/foundations/icons/app-icons";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { StatusDot } from "@/components/base/badges/status-dot";
import { toast } from "@/components/base/toast/toast";
import { desktopToolError, desktopTools, desktopToolsAvailable } from "@/app/desktop/desktop-tools";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import type { PendingWorkspacePage } from "@/components/application/dashboard/workspace-page";
import { SettingsCard, SettingsSectionLabel } from "@/components/application/settings/settings-rows";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { workspacePageContent } from "./workspace-page-content";

/**
 * Sidebar page that cannot work yet (its NekoBuddy backend is not connected,
 * or its assets are not provided). The page states why plainly and lists the
 * planned capabilities as plans; it creates no data.
 */
export function BackendPendingPage({ page, onNavigate }: { page: PendingWorkspacePage; onNavigate?: () => void }) {
  const { title, icon: Icon, intro, statusTitle, status, planned } = workspacePageContent[page];
  const openSettings = useWorkspaceSettings();
  const desktop = desktopToolsAvailable();
  const headingId = `${page}-planned-heading`;
  return <section aria-label={title} className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
    <header className="flex h-12 shrink-0 items-center gap-2 px-3 lg:hidden">
      {onNavigate && <ToolbarIconButton icon={MenuIcon} label="打开导航" onPress={onNavigate} />}
      <span className="text-body-medium text-text-primary">{title}</span>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-5 py-10 sm:px-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-background-primary-default shadow-xs">
            <Icon className="size-6 text-foreground-icon-secondary" aria-hidden />
          </span>
          <h1 className="text-title-3-medium text-text-primary">{title}</h1>
          <p className="max-w-[420px] text-body-regular text-text-secondary">{intro}</p>
        </div>

        <div role="status" className="flex items-start gap-3 rounded-2xl border border-separator-border bg-background-primary-default p-3">
          <StatusDot color="yellow" className="mt-1" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-body-medium text-text-primary">{statusTitle}</p>
            <p className="text-body-2-regular text-text-secondary">{status}</p>
          </div>
        </div>

        {page === "learning" && desktop && <section aria-label="本机学习笔记" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-separator-border bg-background-primary-default p-3">
          <div className="min-w-0">
            <h2 className="text-body-medium text-text-primary">本机学习笔记</h2>
            <p className="text-body-2-regular text-text-secondary">从屏幕取材，编辑后保存为 Markdown。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" leadingIcon={FolderOpenIcon}
              onClick={() => void desktopTools.openNotes("study").catch((error) => toast.error(desktopToolError(error)))}>打开笔记</Button>
            <Button size="small" leadingIcon={CameraIcon}
              onClick={() => void desktopTools.island().catch((error) => toast.error(desktopToolError(error)))}>屏幕取材</Button>
          </div>
        </section>}
        {page === "cabin" && <Button size="small" variant="secondary" className="self-center"
          onClick={(event) => openSettings("desktop", event.currentTarget)}>打开桌宠设置</Button>}

        <section className="flex flex-col gap-2" aria-labelledby={headingId}>
          <SettingsSectionLabel><span id={headingId}>计划中的能力</span></SettingsSectionLabel>
          <SettingsCard className="bg-background-primary-default">
            <ul>
              {planned.map(({ icon: ItemIcon, title: name, description }) => <li key={name} className="flex items-center gap-2.5 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary-default">
                  <ItemIcon className="size-[18px] text-foreground-icon-secondary" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-body-medium text-text-primary">{name}</p>
                  <p className="text-body-2-regular text-text-secondary">{description}</p>
                </div>
                <Chip variant="caption" color="soft" className="shrink-0">计划中</Chip>
              </li>)}
            </ul>
          </SettingsCard>
        </section>
      </div>
    </div>
  </section>;
}
