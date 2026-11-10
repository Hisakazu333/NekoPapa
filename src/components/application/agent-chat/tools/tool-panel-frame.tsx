import type { ComponentType, ReactNode } from "react";
import { FolderIcon } from "@/components/foundations/icons/app-icons";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Tool selector and actions within the work panel. */
export function ToolPanelFrame({ title, tabs, detail, actions, children }: {
  title: string;
  tabs: ReactNode;
  /** e.g. the project and its folder. */
  detail?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <section aria-label={title} className="@container flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-separator-border">
    <header className="flex shrink-0 items-center gap-2 py-2">
      {tabs}
      <span className="min-w-0 flex-1 truncate text-caption-1-regular text-text-secondary">{detail}</span>
      {actions}
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
