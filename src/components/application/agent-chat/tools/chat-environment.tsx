import type { ComponentType, ReactNode } from "react";
import { FolderIcon, GitBranchIcon, MonitorIcon } from "@/components/foundations/icons/app-icons";
import { gitBranchLabel, type GitState } from "@/hooks/use-git-status";
import type { Project } from "@/app/projects";
import { WorkPanelSection } from "./work-panel-section";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

function Row({ icon: RowIcon, label, value }: { icon: Icon; label: ReactNode; value?: ReactNode }) {
  return <li className="flex min-h-9 items-center gap-2.5 py-1">
    <RowIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
    <div className="min-w-0 flex-1">
      <p className="truncate text-body-2-regular text-text-primary">{label}</p>
      {value && <p className="truncate text-caption-1-regular text-text-secondary">{value}</p>}
    </div>
  </li>;
}

export function ChatEnvironment({ project, git }: { project?: Project; git: GitState }) {
  const root = project?.folders[0];
  const status = git.kind === "ready" ? git.status : undefined;
  const branch = gitBranchLabel(git);
  const sync = status && (status.ahead || status.behind) ? ` · ↑${status.ahead} ↓${status.behind}` : "";

  return <WorkPanelSection title="环境" defaultExpanded>
    <ul className="flex flex-col">
      <Row icon={MonitorIcon} label="本电脑" />
      {project && root
        ? <>
          <Row icon={FolderIcon} label={<span translate="no">{project.name}</span>} value={<span translate="no" title={root}>{root}</span>} />
          <Row icon={GitBranchIcon} label={<span translate="no">{branch}{sync}</span>} value={git.kind === "error" ? git.message : status?.upstream && <span translate="no">{status.upstream}</span>} />
        </>
        : <Row icon={FolderIcon} label="未归入项目" value="在输入框或侧栏选择项目" />}
    </ul>
  </WorkPanelSection>;
}
