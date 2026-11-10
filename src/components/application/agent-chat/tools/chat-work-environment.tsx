import { FileTextIcon } from "@/components/foundations/icons/app-icons";
import type { Project } from "@/app/projects/projects";
import type { ThreadUsage } from "@/app/usage/thread-usage";
import { useGitStatus } from "@/hooks/use-git-status";
import { Button } from "@/components/base/buttons/button";
import { ContextUsageCard } from "../context-usage-card";
import { ChatEnvironment } from "./chat-environment";
import { WorkPanelConnections, WorkPanelServers } from "./work-panel-services";

export function ChatWorkEnvironment({ project, usage, onOpenChanges, onOpenSettings }: {
  project?: Project;
  usage: ThreadUsage;
  onOpenChanges: () => void;
  onOpenSettings?: (section: "model" | "tools") => void;
}) {
  const git = useGitStatus(project?.folders[0]);
  const changes = git.kind === "ready" ? git.status.changes.length : undefined;
  return <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain">
    <ChatEnvironment project={project} git={git} />
    <ContextUsageCard usage={usage} onOpenModelSettings={onOpenSettings && (() => onOpenSettings("model"))} />
    <WorkPanelConnections onManage={onOpenSettings && (() => onOpenSettings("tools"))} />
    <Button size="small" variant="secondary" leadingIcon={FileTextIcon} className="self-start" onClick={onOpenChanges}>
      更改{changes === undefined ? "" : ` · ${changes}`}
    </Button>
    <WorkPanelServers />
  </div>;
}
