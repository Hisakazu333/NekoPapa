import { useRef, type ComponentType, type ReactNode } from "react";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { FileTextIcon, FolderIcon, GitBranchIcon } from "@/components/foundations/icons/app-icons";
import type { Project } from "@/app/projects/projects";
import { formatShare, formatTokens, type ThreadUsage } from "@/app/usage/thread-usage";
import { useContextWindow } from "@/hooks/use-context-window";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ProgressCircle } from "@/components/base/progress/progress";
import { ContextUsageMeter } from "./context-usage-card";
import { gitBranchLabel, useGitStatus } from "@/hooks/use-git-status";
import { cx } from "@/utils/cx";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

const ITEM = "flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5";
const PRESSABLE = "cursor-pointer outline-none hover:bg-background-tertiary-default hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring";

function Item({ icon: ItemIcon, children, title, onPress, className }: { icon: Icon; children: ReactNode; title?: string; onPress?: () => void; className?: string }) {
  const content = <><ItemIcon className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 truncate">{children}</span></>;
  return onPress
    ? <button type="button" title={title} onClick={onPress} className={cx(ITEM, PRESSABLE, className)}>{content}</button>
    : <span title={title} className={cx(ITEM, className)}>{content}</span>;
}

/**
 * The composer's status tab (after BoardUI's composer panel): the strip
 * tucked behind the top of the input card names where the chat works — the
 * project folder, its Git branch (ahead / behind), uncommitted files (which
 * open 更改) — and ends in the context meter: a 16px ring filled to the
 * share of the model's context window when one is known; without a window
 * the ring is a dashed outline beside the tokens used, since there is no
 * limit to fill. The meter opens the 上下文窗口 card. All of it is read from
 * the project folder and the saved replies.
 */
export function ComposerStatusTab({ project, usage, onOpenChanges }: {
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
  const { used, ratio, window, source } = useContextWindow(usage);
  const estimated = source === "default";
  const meterTitle = ratio !== undefined && estimated ? `约 ${formatShare(ratio)}：未填写上下文窗口，按 ${formatTokens(window!)} 估算并在接近时压缩`
    : ratio !== undefined ? `上下文窗口已使用 ${formatShare(ratio)}`
    : used !== undefined ? `最近一次请求 ${used.toLocaleString("en-US")} Token，未填写上下文窗口`
      : "服务返回用量后显示上下文占用";

  return <div aria-label="对话状态" className="flex min-w-0 flex-1 items-center gap-0.5 text-caption-1-regular text-text-secondary">
    {project && root ? <>
      <Item icon={FolderIcon} title={root}><span translate="no">{project.name}</span></Item>
      <Item icon={GitBranchIcon} title={git.kind === "error" ? git.message : status?.upstream ? `跟踪 ${status.upstream}` : undefined}>
        <span translate="no">{gitBranchLabel(git)}{sync}</span>
      </Item>
      {status && status.changes.length > 0 && <Item icon={FileTextIcon} onPress={onOpenChanges} title="打开更改面板">
        {status.changes.length} 个未提交
      </Item>}
    </> : <Item icon={FolderIcon} className="text-text-tertiary">未归入项目</Item>}
    <span className="min-w-2 flex-1" />
    <PopoverTrigger>
      <button type="button" ref={trigger} title={meterTitle} aria-label={`上下文窗口：${meterTitle}`} className={cx(ITEM, PRESSABLE, "shrink-0 tabular-nums")}>
        {ratio !== undefined
          ? <ProgressCircle size="sm" value={Math.min(100, Math.max(1, Math.round(ratio * 100)))} aria-label="上下文占用" className="size-4" trackClassName="stroke-foreground-icon-tertiary/40" />
          : <span aria-hidden className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-foreground-icon-tertiary" />}
        <span>{ratio !== undefined ? `${estimated ? "约 " : ""}${formatShare(ratio)}` : used !== undefined ? `${formatTokens(used)} Token` : "上下文"}</span>
      </button>
      <Popover placement="top end" aria-label="上下文窗口" className="w-[340px] max-w-[calc(100vw-24px)]" dialogClassName="p-1.5">
        {({ close }) => <ContextUsageMeter usage={usage} defaultExpanded
          onOpenModelSettings={() => { close(); openSettings("model", trigger.current); }} />}
      </Popover>
    </PopoverTrigger>
  </div>;
}
