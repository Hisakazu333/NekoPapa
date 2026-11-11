import { FolderIcon, GitBranchIcon, LaptopIcon } from "@/components/foundations/icons/app-icons";
import { gitBranchLabel, type GitState } from "@/hooks/use-git-status";
import type { Project } from "@/app/projects/projects";
import { WorkPanelRow, WorkPanelSection } from "./work-panel-section";

/** 环境: this computer, the chat's project folder and its Git branch, as read from the folder. */
export function ChatEnvironment({ project, git }: { project?: Project; git: GitState }) {
  const root = project?.folders[0];
  const status = git.kind === "ready" ? git.status : undefined;
  const sync = status && (status.ahead || status.behind) ? `↑${status.ahead} ↓${status.behind}` : undefined;

  return <WorkPanelSection title="环境">
    <ul className="flex flex-col">
      <WorkPanelRow icon={LaptopIcon} label="本电脑" />
      {project && root
        ? <>
          <WorkPanelRow icon={FolderIcon} title={root}
            label={<><span translate="no">{project.name}</span><span translate="no" className="text-text-tertiary"> · {root.replace(/^\/Users\/[^/]+/, "~")}</span></>} />
          <WorkPanelRow icon={GitBranchIcon} label={<span translate="no">{gitBranchLabel(git)}</span>}
            detail={git.kind === "error" ? git.message : status?.upstream ? <span translate="no">跟踪 {status.upstream}</span> : undefined}
            end={sync && <span translate="no" className="tabular-nums">{sync}</span>} />
        </>
        : <WorkPanelRow icon={FolderIcon} label="未归入项目" detail="在输入框或侧栏选择项目后，显示文件夹与分支" />}
    </ul>
  </WorkPanelSection>;
}
