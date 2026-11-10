import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { RiArrowRightSLine, RiComputerLine, RiDonutChartLine, RiFileList3Line, RiFolder3Line, RiGitBranchLine } from "@remixicon/react";
import { parseGitStatus, type GitStatus } from "@/app/project-workspace";
import { projectWorkspace } from "@/app/project-workspace-client";
import type { Project } from "@/app/projects";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
type Git = { kind: "loading" } | { kind: "none" } | { kind: "error"; message: string } | { kind: "ready"; status: GitStatus };

function Row({ icon: RowIcon, label, value, onPress }: { icon: Icon; label: ReactNode; value?: ReactNode; onPress?: () => void }) {
  const content = <>
    <RowIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
    <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-primary">{label}</span>
    {value !== undefined && <span className="min-w-0 max-w-[55%] shrink truncate text-end text-caption-1-regular text-text-tertiary">{value}</span>}
    {onPress && <RiArrowRightSLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />}
  </>;
  const row = "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-start";
  return <li>{onPress
    ? <button type="button" onClick={onPress} className={`${row} cursor-pointer outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring`}>{content}</button>
    : <div className={row}>{content}</div>}</li>;
}

/**
 * 环境: where the open chat works — this computer, the project's primary
 * folder, its Git branch and how many files have uncommitted changes (which
 * opens 更改). Context usage needs the chat service, so it says so.
 */
export function ChatEnvironment({ project, onOpenChanges }: { project?: Project; onOpenChanges?: () => void }) {
  const root = project?.folders[0];
  const [git, setGit] = useState<Git>({ kind: "loading" });

  useEffect(() => {
    if (!root) return;
    let live = true;
    const load = () => projectWorkspace.status(root).then(
      (result) => { if (live) setGit(result.repo ? { kind: "ready", status: parseGitStatus(result.output) } : { kind: "none" }); },
      (error: unknown) => { if (live) setGit({ kind: "error", message: error instanceof Error ? error.message : "读取失败。" }); },
    );
    setGit({ kind: "loading" });
    void load();
    window.addEventListener("focus", load);
    return () => { live = false; window.removeEventListener("focus", load); };
  }, [root]);

  const status = git.kind === "ready" ? git.status : undefined;
  const branch = status ? (status.detached ? "分离的 HEAD" : status.branch ?? "—") : git.kind === "none" ? "不是 Git 仓库" : git.kind === "error" ? "无法读取" : "读取中…";
  const sync = status && (status.ahead || status.behind) ? ` · ↑${status.ahead} ↓${status.behind}` : "";

  return <section aria-label="环境" className="flex flex-col gap-1 rounded-2xl bg-background-primary-default p-2">
    <h3 className="px-2 pt-1 text-caption-1-medium text-text-tertiary">环境</h3>
    <ul className="flex flex-col">
      <Row icon={RiComputerLine} label="本电脑" />
      {project && root
        ? <>
          <Row icon={RiFolder3Line} label={<span translate="no">{project.name}</span>} value={<span translate="no" title={root}>{root}</span>} />
          <Row icon={RiGitBranchLine} label={<span translate="no">{branch}{sync}</span>} value={git.kind === "error" ? git.message : status?.upstream && <span translate="no">{status.upstream}</span>} />
          {status && <Row icon={RiFileList3Line} label="更改" value={status.changes.length === 0 ? "没有未提交的更改" : `${status.changes.length} 个文件`} onPress={onOpenChanges} />}
        </>
        : <Row icon={RiFolder3Line} label="未归入项目" value="在输入框或侧栏选择项目" />}
      <Row icon={RiDonutChartLine} label="上下文" value="聊天服务接入后显示用量" />
    </ul>
  </section>;
}
