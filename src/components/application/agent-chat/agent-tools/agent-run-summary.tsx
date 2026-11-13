import { useState } from "react";
import { ArrowUpRightIcon, FileDiffIcon, RotateCcwIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { focusChange } from "@/app/agent/project-change-events";
import type { RunChanges } from "@/app/agent/run-changes";
import { snapshotState, undoChange } from "@/platform/desktop-agent-host";
import { useAgentToolActions } from "./agent-tool-actions";

type Undo = { kind: "idle" } | { kind: "busy" } | { kind: "done"; skipped: number } | { kind: "error"; message: string };

/**
 * Under a finished reply that changed files: each file once with its lines
 * added and removed, a way into 更改, and 全部撤销. Undo goes newest change
 * first, so a file edited several times walks back to how it was before the
 * reply; a change whose file was edited again since is left alone and counted.
 */
export function AgentRunSummary({ changes }: { changes: RunChanges }) {
  const { canUndo } = useAgentToolActions();
  const [undo, setUndo] = useState<Undo>({ kind: "idle" });
  const added = changes.files.reduce((sum, file) => sum + file.added, 0);
  const removed = changes.files.reduce((sum, file) => sum + file.removed, 0);
  const undoAll = async () => {
    setUndo({ kind: "busy" });
    let skipped = 0;
    try {
      for (const snapshot of changes.snapshots) {
        const state = await snapshotState(snapshot);
        if (state === "ready") await undoChange(snapshot);
        else if (state === "changed") skipped += 1;
      }
      setUndo({ kind: "done", skipped });
    } catch (error) {
      setUndo({ kind: "error", message: error instanceof Error ? error.message : "无法撤销。" });
    }
  };
  return <section aria-label="本轮更改" className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <header className="flex min-h-9 items-center gap-2 px-3 py-1.5">
      <FileDiffIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-caption-1-medium text-text-primary">
        更改了 {changes.files.length} 个文件
        <span className="ms-2 font-mono text-caption-1-regular"><span className="text-status-lime-text">+{added}</span> <span className="text-status-rose-text">−{removed}</span></span>
      </span>
      {canUndo && (undo.kind === "done"
        ? <span className="shrink-0 text-caption-1-regular text-text-tertiary">{undo.skipped ? `已撤销，${undo.skipped} 处因文件又被改动而保留` : "已全部撤销"}</span>
        : <Button variant="secondary" size="xs" leadingIcon={RotateCcwIcon} disabled={undo.kind === "busy"} onClick={undoAll}>
          {undo.kind === "busy" ? "正在撤销…" : "全部撤销"}
        </Button>)}
    </header>
    {undo.kind === "error" && <p role="alert" className="border-t border-separator-border px-3 py-1.5 text-caption-1-regular text-text-error-primary">{undo.message}</p>}
    <ul className="flex flex-col border-t border-separator-border py-1">
      {changes.files.map((file) => <li key={file.path}>
        <button type="button" title="在“更改”中查看" onClick={() => focusChange(file.path)}
          className="group/file flex w-full cursor-pointer items-center gap-2 px-3 py-1 text-start outline-none hover:bg-background-secondary-default focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring">
          <span translate="no" className="min-w-0 flex-1 truncate font-mono text-caption-1-regular text-text-secondary">{file.path}</span>
          {file.created && <span className="shrink-0 text-caption-1-regular text-text-tertiary">新建</span>}
          <span className="shrink-0 font-mono text-caption-1-regular"><span className="text-status-lime-text">+{file.added}</span> <span className="text-status-rose-text">−{file.removed}</span></span>
          <ArrowUpRightIcon className="size-3.5 shrink-0 text-text-tertiary opacity-0 group-hover/file:opacity-100 group-focus-visible/file:opacity-100" aria-hidden />
        </button>
      </li>)}
    </ul>
  </section>;
}
