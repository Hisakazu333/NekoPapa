import { cx } from "@/utils/cx";
import type { Project } from "@/app/projects/projects";
import type { ThreadUsage } from "@/app/usage/thread-usage";
import { useGitStatus } from "@/hooks/use-git-status";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { ContextUsageMeter } from "../context-usage-card";
import { ChatEnvironment } from "./chat-environment";
import { WorkPanelSection } from "./work-panel-section";
import { WorkPanelConnections, WorkPanelServers } from "./work-panel-services";

/**
 * 环境与上下文: one surface of hairline-divided sections — 环境 (computer,
 * project folder, branch), 上下文 (the context meter), 连接器 ›, 更改 › and
 * 服务器 — shown in the work panel's 代码 tab and from the composer's
 * context ring. Every value is read from the project folder, the saved
 * configuration or the replies' reported usage.
 */
export function ChatWorkEnvironment({ project, usage, onOpenChanges, onOpenSettings, className }: {
  project?: Project;
  usage: ThreadUsage;
  onOpenChanges: () => void;
  onOpenSettings?: (section: "model" | "tools") => void;
  className?: string;
}) {
  const openSettings = useWorkspaceSettings();
  const settings = onOpenSettings ?? ((section: "model" | "tools") => openSettings(section));
  const git = useGitStatus(project?.folders[0]);
  const changes = git.kind === "ready" ? git.status.changes.length : undefined;
  return <div className={cx("flex min-h-0 flex-1 flex-col divide-y divide-separator-border overflow-y-auto overscroll-contain px-3", className)}>
    <ChatEnvironment project={project} git={git} />
    <section aria-label="上下文" className="py-3">
      <ContextUsageMeter usage={usage} defaultExpanded className="bg-background-primary-default" onOpenModelSettings={() => settings("model")} />
    </section>
    <WorkPanelConnections onManage={() => settings("tools")} />
    <WorkPanelSection title="更改" onPress={onOpenChanges}
      trailing={!project ? "未归入项目" : changes === undefined ? undefined : changes ? `${changes} 个文件未提交` : "没有未提交的更改"} />
    <WorkPanelServers />
  </div>;
}
