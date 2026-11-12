import { useEffect, useMemo, useState } from "react";
import { ArrowUpRightIcon, ChevronRightIcon, FileCodeIcon, RotateCcwIcon } from "@/components/foundations/icons/app-icons";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { focusChange } from "@/app/agent/project-change-events";
import { Button } from "@/components/base/buttons/button";
import { parseUnifiedDiff } from "@/app/projects/project-workspace";
import type { FileChange } from "@/app/agent/agent-host";
import { snapshotState, undoChange, type SnapshotState } from "@/platform/desktop-agent-host";
import { useEditorPreferences } from "@/hooks/use-editor-preferences";
import { DiffText } from "../tools/file-text";
import { useAgentToolActions } from "./agent-tool-actions";
import { cx } from "@/utils/cx";

const OPEN_LIMIT = 40;

type Undo = { kind: "checking" } | { kind: SnapshotState } | { kind: "busy" } | { kind: "error"; message: string };

/** Whether the change can still be undone, asked of the host once the card shows. */
function useUndo(snapshot: string, enabled: boolean) {
  const [state, setState] = useState<Undo>({ kind: "checking" });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    snapshotState(snapshot).then((kind) => { if (live) setState({ kind }); },
      (error: Error) => { if (live) setState({ kind: "error", message: error.message }); });
    return () => { live = false; };
  }, [snapshot, enabled]);
  const undo = async () => {
    setState({ kind: "busy" });
    try { await undoChange(snapshot); setState({ kind: "undone" }); }
    catch (error) { setState({ kind: "error", message: error instanceof Error ? error.message : "无法撤销。" }); }
  };
  return { state, undo };
}

/** A file the Agent created or changed: path, line counts, the diff, 在“更改”中查看 and 撤销. */
export function AgentChangeCard({ change }: { change: FileChange }) {
  const { canUndo } = useAgentToolActions();
  const diff = useMemo(() => parseUnifiedDiff(change.diff), [change.diff]);
  const [open, setOpen] = useState(change.added + change.removed <= OPEN_LIMIT);
  const editor = useEditorPreferences();
  const { state, undo } = useUndo(change.snapshot, canUndo);
  return <section aria-label={`文件改动 ${change.path}`} className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <header className="flex min-h-9 items-center gap-2 ps-1.5 pe-1.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <FileCodeIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
        <span translate="no" title={change.path} className="min-w-0 truncate font-mono text-caption-1-medium text-text-primary">{change.path}</span>
        {change.created && <span className="shrink-0 text-caption-1-regular text-text-tertiary">新建</span>}
        <span className="shrink-0 font-mono text-caption-1-regular">
          <span className="text-status-lime-text">+{change.added}</span> <span className="text-status-rose-text">−{change.removed}</span>
        </span>
        <ChevronRightIcon className={cx("size-3.5 shrink-0 text-text-tertiary transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      <ToolbarIconButton icon={ArrowUpRightIcon} label="在“更改”中查看" onPress={() => focusChange(change.path)} />
      {canUndo && <UndoControl state={state} onUndo={undo} />}
    </header>
    {state.kind === "error" && <p role="alert" className="border-t border-separator-border px-3 py-1.5 text-caption-1-regular text-text-error-primary">{state.message}</p>}
    {open && (diff.lines.length > 0
      ? <div className="flex max-h-96 flex-col"><DiffText lines={diff.lines} split={false} wrap={editor.wrap} whitespace={editor.whitespace} path={change.path} /></div>
      : <p className="border-t border-separator-border px-3 py-2 text-caption-1-regular text-text-tertiary">内容没有变化。</p>)}
  </section>;
}

function UndoControl({ state, onUndo }: { state: Undo; onUndo: () => void }) {
  if (state.kind === "undone") return <span className="shrink-0 px-2 text-caption-1-regular text-text-tertiary">已撤销</span>;
  if (state.kind === "changed") return <span title="文件在这次修改后又被改动过，为避免覆盖不能撤销。" className="shrink-0 px-2 text-caption-1-regular text-text-tertiary">已再次修改</span>;
  return <Button variant="secondary" size="xs" leadingIcon={RotateCcwIcon} disabled={state.kind !== "ready" && state.kind !== "error"}
    aria-disabled={state.kind !== "ready" && state.kind !== "error"} onClick={onUndo}>
    {state.kind === "busy" ? "正在撤销…" : "撤销"}
  </Button>;
}
