import type { ComponentType, ReactNode } from "react";
import { ChartPieIcon, ChevronRightIcon, FileTextIcon, FolderIcon, GitBranchIcon, MonitorIcon } from "@/components/foundations/icons/app-icons";
import { gitBranchLabel, useGitStatus } from "@/hooks/use-git-status";
import type { Project } from "@/app/projects";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

function Row({ icon: RowIcon, label, value, onPress }: { icon: Icon; label: ReactNode; value?: ReactNode; onPress?: () => void }) {
  const content = <>
    <RowIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
    <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-primary">{label}</span>
    {value !== undefined && <span className="min-w-0 max-w-[55%] shrink truncate text-end text-caption-1-regular text-text-tertiary">{value}</span>}
    {onPress && <ChevronRightIcon className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />}
  </>;
  const row = "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-start";
  return <li>{onPress
    ? <button type="button" onClick={onPress} className={`${row} cursor-pointer outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring`}>{content}</button>
    : <div className={row}>{content}</div>}</li>;
}

/**
 * 环境: where the open chat works — this computer, the project's primary
 * folder, its Git branch and how many files have uncommitted changes (which
 * opens 更改). Usage of the open chat is in the composer status bar.
 */
export function ChatEnvironment({ project, onOpenChanges }: { project?: Project; onOpenChanges?: () => void }) {
  const root = project?.folders[0];
  const git = useGitStatus(root);
  const status = git.kind === "ready" ? git.status : undefined;
  const branch = gitBranchLabel(git);
  const sync = status && (status.ahead || status.behind) ? ` · ↑${status.ahead} ↓${status.behind}` : "";

  return <section aria-label="环境" className="flex flex-col gap-1 rounded-2xl bg-background-primary-default p-2">
    <h3 className="px-2 pt-1 text-caption-1-medium text-text-tertiary">环境</h3>
    <ul className="flex flex-col">
      <Row icon={MonitorIcon} label="本电脑" />
      {project && root
        ? <>
          <Row icon={FolderIcon} label={<span translate="no">{project.name}</span>} value={<span translate="no" title={root}>{root}</span>} />
          <Row icon={GitBranchIcon} label={<span translate="no">{branch}{sync}</span>} value={git.kind === "error" ? git.message : status?.upstream && <span translate="no">{status.upstream}</span>} />
          {status && <Row icon={FileTextIcon} label="更改" value={status.changes.length === 0 ? "没有未提交的更改" : `${status.changes.length} 个文件`} onPress={onOpenChanges} />}
        </>
        : <Row icon={FolderIcon} label="未归入项目" value="在输入框或侧栏选择项目" />}
      <Row icon={ChartPieIcon} label="上下文" value="本对话用量见输入框下方" />
    </ul>
  </section>;
}
