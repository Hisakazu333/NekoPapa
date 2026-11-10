import { useRef, type ComponentType, type ReactNode } from "react";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { ChartPieIcon, FileTextIcon, FolderIcon, GitBranchIcon } from "@/components/foundations/icons/app-icons";
import type { Project } from "@/app/projects/projects";
import { contextUsageRatio, formatTokens, type ThreadUsage } from "@/app/usage/thread-usage";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ProgressCircle } from "@/components/base/progress/progress";
import { ChatWorkEnvironment } from "./tools/chat-work-environment";
import { gitBranchLabel, useGitStatus } from "@/hooks/use-git-status";
import { cx } from "@/utils/cx";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

function Item({ icon: ItemIcon, children, title, onPress, className }: { icon: Icon; children: ReactNode; title?: string; onPress?: () => void; className?: string }) {
  const content = <><ItemIcon className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 truncate">{children}</span></>;
  const base = cx("flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5", className);
  return onPress
    ? <button type="button" title={title} onClick={onPress} className={cx(base, "cursor-pointer outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring")}>{content}</button>
    : <span title={title} className={base}>{content}</span>;
}

/**
 * The strip under a workbench chat's composer: the project, its Git branch
 * (ahead / behind its upstream), how many files have uncommitted changes —
 * which opens 更改 — and the tokens this conversation's replies used. All of
 * it is read from the project folder and the saved replies; nothing is
 * estimated. The usage item opens the work environment and its 上下文 card.
 * A recorded context window also gives the button an occupancy ring.
 */
export function ChatStatusBar({ project, usage, onOpenChanges }: {
  project?: Project;
  usage: ThreadUsage;
  onOpenChanges: () => void;
}) {
  const root = project?.folders[0];
  const git = useGitStatus(root);
  const status = git.kind === "ready" ? git.status : undefined;
  const sync = status && (status.ahead || status.behind) ? ` ↑${status.ahead} ↓${status.behind}` : "";
  const trigger = useRef<HTMLButtonElement>(null);
  const openSettings = useWorkspaceSettings();
  const ratio = contextUsageRatio(usage.latest);
  const usageTitle = usage.replies
    ? `本对话 ${usage.replies} 次有用量记录的回复共 ${usage.totalTokens.toLocaleString("en-US")} Token。点按查看环境与上下文。`
    : "本对话的回复还没有记录用量；服务返回用量后显示。";

  return <div aria-label="对话状态" className="flex min-h-7 min-w-0 items-center gap-1 px-3 pt-1.5 text-caption-1-regular text-text-tertiary">
    {project && root ? <>
      <Item icon={FolderIcon} title={root}><span translate="no">{project.name}</span></Item>
      <Item icon={GitBranchIcon} title={git.kind === "error" ? git.message : status?.upstream ? `上游 ${status.upstream}` : undefined}>
        <span translate="no">{gitBranchLabel(git)}{sync}</span>
      </Item>
      {status && <Item icon={FileTextIcon} onPress={onOpenChanges} title="打开更改面板"
        className={status.changes.length ? "text-text-secondary" : undefined}>
        {status.changes.length ? `${status.changes.length} 个文件未提交` : "没有未提交的更改"}
      </Item>}
    </> : <Item icon={FolderIcon}>未归入项目</Item>}
    <span className="min-w-0 flex-1" />
    <PopoverTrigger>
      <button type="button" ref={trigger} title={usageTitle}
        className="flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 outline-none hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        {ratio !== undefined
          ? <ProgressCircle size="sm" value={Math.min(100, Math.round(ratio * 100))} aria-label="上下文占用" className="size-3.5" />
          : <ChartPieIcon className="size-3.5 shrink-0" aria-hidden />}
        <span className="min-w-0 truncate tabular-nums">{usage.replies ? `${ratio !== undefined ? `${Math.round(ratio * 100)}% · ` : ""}${formatTokens(usage.totalTokens)} Token` : "未记录用量"}</span>
      </button>
      <Popover placement="top end" aria-label="环境与上下文" className="w-[360px] max-w-[calc(100vw-24px)]"
        dialogClassName="max-h-[min(70dvh,540px)] p-1">
        {({ close }) => <ChatWorkEnvironment project={project} usage={usage}
          onOpenChanges={() => { close(); onOpenChanges(); }}
          onOpenSettings={(section) => { close(); openSettings(section, trigger.current); }} />}
      </Popover>
    </PopoverTrigger>
  </div>;
}
