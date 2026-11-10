import type { ComponentType, ReactNode } from "react";
import { RiCloseLine, RiFolder3Line } from "@remixicon/react";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** The chrome shared by the 目录 / 终端 / 更改 / 文件 panels: title, detail, actions, close. */
export function ToolPanelFrame({ icon: TitleIcon, title, detail, actions, onClose, children }: {
  icon: Icon;
  title: string;
  /** e.g. the project and its folder. */
  detail?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return <section aria-label={title} className="flex h-full w-full flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
    <header className="flex shrink-0 items-center gap-2 py-2 ps-4 pe-2">
      <TitleIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h2 className="shrink-0 text-body-medium text-text-primary">{title}</h2>
        {detail && <span className="min-w-0 truncate text-caption-1-regular text-text-tertiary">{detail}</span>}
      </div>
      {actions}
      <ToolbarIconButton icon={RiCloseLine} label={`关闭${title}`} onPress={onClose} />
    </header>
    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  </section>;
}

/** Centered message for an empty, unavailable or failed panel. */
export function ToolPanelMessage({ icon: MessageIcon = RiFolder3Line, title, detail, action, tone = "neutral" }: {
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
