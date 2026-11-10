import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon, CircleCheckIcon, GitBranchIcon, RefreshCwIcon } from "@/components/foundations/icons/app-icons";
import { parseGitStatus, parseUnifiedDiff, untrackedDiff, type ChangeKind, type FileDiff, type GitChange, type GitStatus } from "@/app/projects/project-workspace";
import { projectWorkspace } from "@/app/projects/project-workspace-client";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { DiffText } from "./file-text";
import { OpenInEditorButton } from "./open-in-editor-button";
import { useEditorPreferences } from "@/hooks/use-editor-preferences";
import { ToolPanelMessage } from "./tool-panel-frame";

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "norepo" } | { kind: "ready"; status: GitStatus };
type Diff = { change: GitChange; state: { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; diff: FileDiff } };

const label: Record<ChangeKind, [string, string, ChipColor]> = {
  modified: ["M", "已修改", "blue"], added: ["A", "新增", "lime"], deleted: ["D", "已删除", "rose"], renamed: ["R", "重命名", "purple"],
  untracked: ["U", "未跟踪", "lime"], conflicted: ["!", "冲突", "orange"], typechange: ["T", "类型变化", "yellow"],
};
const message = (error: unknown) => error instanceof Error ? error.message : "读取失败。";

/**
 * 更改: the project's uncommitted changes as Git reports them (staged and
 * unstaged together, against HEAD), refreshed on open, on 刷新 and when the
 * window regains focus. Choosing a file shows its diff. Read-only: nothing is
 * staged, committed or reverted from here.
 */
export function ProjectChangesView({ root, onActions, onBranch }: { root: string; onActions: (actions: React.ReactNode) => void; onBranch: (branch?: string) => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [diff, setDiff] = useState<Diff>();

  const refresh = useCallback(async () => {
    try {
      const result = await projectWorkspace.status(root);
      if (!result.repo) { setLoad({ kind: "norepo" }); onBranch(undefined); return; }
      const status = parseGitStatus(result.output);
      setLoad({ kind: "ready", status });
      onBranch(status.detached ? "分离的 HEAD" : status.branch);
    } catch (error) {
      setLoad({ kind: "error", message: message(error) });
    }
  }, [root, onBranch]);

  useEffect(() => { setLoad({ kind: "loading" }); setDiff(undefined); void refresh(); }, [refresh]);
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useEffect(() => { onActions(<ToolbarIconButton icon={RefreshCwIcon} label="刷新更改" onPress={() => void refresh()} />); }, [onActions, refresh]);

  const open = async (change: GitChange) => {
    setDiff({ change, state: { kind: "loading" } });
    try {
      let next: FileDiff;
      if (change.kind === "untracked") {
        const file = await projectWorkspace.read(root, change.path);
        next = file.text !== undefined ? untrackedDiff(file.text) : { lines: [], added: 0, removed: 0, binary: file.binary || file.tooLarge };
      } else next = parseUnifiedDiff((await projectWorkspace.diff(root, change.path)).output);
      setDiff((current) => current?.change === change ? { change, state: { kind: "ready", diff: next } } : current);
    } catch (error) {
      setDiff((current) => current?.change === change ? { change, state: { kind: "error", message: message(error) } } : current);
    }
  };

  if (diff) return <DiffPane root={root} diff={diff} onBack={() => { setDiff(undefined); void refresh(); }} />;
  if (load.kind === "loading") return <ToolPanelMessage icon={GitBranchIcon} title="正在读取 Git 状态…" />;
  if (load.kind === "error") return <ToolPanelMessage tone="error" icon={GitBranchIcon} title="无法读取更改" detail={load.message} />;
  if (load.kind === "norepo") return <ToolPanelMessage icon={GitBranchIcon} title="这个文件夹不是 Git 仓库" detail="在项目文件夹中运行 git init 后，这里显示未提交的更改。" />;
  const { status } = load;
  return <div className="flex min-h-0 flex-1 flex-col">
    {(status.ahead > 0 || status.behind > 0 || status.upstream) && <p className="shrink-0 px-4 pb-2 text-caption-1-regular text-text-tertiary">
      {status.upstream ? `跟踪 ${status.upstream}` : ""}{status.ahead > 0 ? ` · 领先 ${status.ahead}` : ""}{status.behind > 0 ? ` · 落后 ${status.behind}` : ""}
    </p>}
    {status.changes.length === 0
      ? <ToolPanelMessage icon={CircleCheckIcon} title="没有未提交的更改" detail="工作区与最新提交一致。" />
      : <>
        <p className="shrink-0 px-4 pb-1 text-caption-1-medium text-text-secondary">{status.changes.length} 个文件有更改</p>
        <ul aria-label="有更改的文件" className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {status.changes.map((change) => {
            const [letter, name, color] = label[change.kind];
            const slash = change.path.lastIndexOf("/");
            return <li key={`${change.from ?? ""}>${change.path}`}>
              <button type="button" onClick={() => void open(change)} title={change.from ? `${change.from} → ${change.path}` : change.path}
                className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-start outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                <Chip variant="caption" color={color} aria-label={name} className="w-5 shrink-0 px-0 font-mono">{letter}</Chip>
                <span translate="no" className="min-w-0 flex-1 truncate text-body-2-regular">
                  <span className="text-text-primary">{change.path.slice(slash + 1)}</span>
                  {slash > 0 && <span className="ms-1.5 text-caption-1-regular text-text-tertiary">{change.path.slice(0, slash)}</span>}
                </span>
                {change.staged && <span className="shrink-0 text-caption-1-regular text-text-tertiary">已暂存</span>}
              </button>
            </li>;
          })}
        </ul>
      </>}
  </div>;
}

function DiffPane({ root, diff, onBack }: { root: string; diff: Diff; onBack: () => void }) {
  const { change, state } = diff;
  const editor = useEditorPreferences();
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center gap-2 px-2 pb-2">
      <ToolbarIconButton icon={ArrowLeftIcon} label="返回更改列表" onPress={onBack} />
      <span translate="no" title={change.path} className="min-w-0 flex-1 truncate font-mono text-caption-1-regular text-text-secondary">{change.path}</span>
      {state.kind === "ready" && <span className="shrink-0 font-mono text-caption-1-regular">
        <span className="text-status-lime-text">+{state.diff.added}</span> <span className="text-status-rose-text">−{state.diff.removed}</span>
      </span>}
      {change.kind !== "deleted" && <OpenInEditorButton root={root} path={change.path} />}
    </div>
    {state.kind === "loading" && <ToolPanelMessage icon={GitBranchIcon} title="正在读取差异…" />}
    {state.kind === "error" && <ToolPanelMessage tone="error" icon={GitBranchIcon} title="无法读取差异" detail={state.message} />}
    {state.kind === "ready" && (state.diff.binary
      ? <ToolPanelMessage icon={GitBranchIcon} title="二进制文件或文件太大" detail="这里只显示文本差异。" />
      : state.diff.lines.length === 0
        ? <ToolPanelMessage icon={GitBranchIcon} title="没有可显示的文本差异" detail={change.kind === "renamed" ? "文件只是改了名字。" : "可能只改了文件权限。"} />
        : <DiffText lines={state.diff.lines} split={editor.split} wrap={editor.wrap} whitespace={editor.whitespace} />)}
  </div>;
}
