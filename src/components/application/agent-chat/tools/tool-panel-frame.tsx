import type { ComponentType, ReactNode } from "react";
import { FolderIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/**
 * One pane of the right-hand area, as in Claude's desktop app: a single
 * header with the pane's icon and name, what it works on (the project,
 * its branch), its own actions and close. There is no second row of tabs;
 * the title-bar buttons and ⋯ switch panes.
 */
export function ToolPanelFrame({ title, icon: TitleIcon, detail, actions, onClose, children }: {
  title: string;
  icon?: Icon;
  /** e.g. the project and its branch. */
  detail?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return <section aria-label={title} className="@container flex min-h-0 w-full flex-1 flex-col overflow-hidden">
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-separator-border ps-3.5 pe-1.5">
      {TitleIcon && <TitleIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />}
      <h2 className="shrink-0 text-body-2-medium text-text-primary">{title}</h2>
      <span className="min-w-0 flex-1 truncate text-caption-1-regular text-text-tertiary">{detail}</span>
      {actions}
      <ToolbarIconButton icon={XIcon} label={`关闭${title}`} onPress={onClose} />
    </header>
    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  </section>;
}

/** Centered message for an empty, unavailable or failed panel. */
export function ToolPanelMessage({ icon: MessageIcon = FolderIcon, title, detail, action, tone = "neutral" }: {
  icon?: Icon;
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) {
  return <div role={tone === "error" ? "alert" : undefined} className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
    <MessageIcon className="mb-2 size-7 text-foreground-icon-tertiary" aria-hidden />
    <p className={tone === "error" ? "text-body-medium text-text-error-primary" : "text-body-medium text-text-primary"}>{title}</p>
    {detail && <p className="max-w-[340px] text-body-2-regular text-text-secondary">{detail}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>;
}

/** Where a project-bound panel says it has no folder to work in. */
export function NoProjectMessage({ what }: { what: string }) {
  return <ToolPanelMessage title="这段对话没有归入项目" detail={`在首页的“项目”或侧栏选择一个项目后，这里显示该项目主要文件夹的${what}。`} />;
}
