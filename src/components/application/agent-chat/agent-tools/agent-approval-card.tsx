import { useEffect, useRef, useState } from "react";
import { FileCodeIcon, ShieldAlertIcon, SquareTerminalIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { editsPreview, lineCount, readEdits, writePreview } from "@/app/agent/change-preview";
import { DiffText } from "../tools/file-text";
import { useAgentToolActions, type AllowRule } from "./agent-tool-actions";
import { useApprovalKeys } from "./use-approval-keys";

const field = (input: unknown, name: string) => {
  const value = input !== null && typeof input === "object" ? (input as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : "";
};

/**
 * A file change or command waiting for the user (权限模式 每次询问, or
 * 自动接受编辑 for commands). Nothing runs until 允许. 本对话总是允许 also
 * lets the same command (or any file change) through for the rest of this
 * chat. 拒绝 can carry a reason, which the Agent reads. On the first waiting
 * card Enter allows and Esc denies (use-approval-keys.ts).
 */
export function AgentApprovalCard({ name, input, approvalId, reason }: { name: string; input: unknown; approvalId: string; reason?: string }) {
  const { respond, allowAlways, canRespond, shortcutApprovalId } = useAgentToolActions();
  const [denying, setDenying] = useState(false);
  const [why, setWhy] = useState("");
  const reasonRef = useRef<HTMLInputElement>(null);
  const command = name === "run_command";
  const path = field(input, "path");
  const lines = name === "edit_file" ? editsPreview(readEdits(input))
    : name === "write_file" ? writePreview(field(input, "content")) : [];
  const title = command ? "允许运行这条命令？" : name === "write_file" ? `允许写入 ${lineCount(field(input, "content"))} 行到这个文件？` : "允许修改这个文件？";
  const rule: AllowRule = command ? { command: field(input, "command") } : { edits: true };
  const keys = canRespond && shortcutApprovalId === approvalId && !denying;
  useApprovalKeys(keys, () => respond(approvalId, true), () => respond(approvalId, false));
  useEffect(() => { if (denying) reasonRef.current?.focus(); }, [denying]);

  return <section aria-label="需要你的确认" className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default shadow-card">
    <header className="flex items-center gap-2 px-3 pt-2.5 pb-2">
      <ShieldAlertIcon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span className="text-body-2-medium text-text-primary">{title}</span>
    </header>
    <div className="flex items-center gap-2 px-3 pb-2">
      {command ? <SquareTerminalIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden /> : <FileCodeIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />}
      <code translate="no" className="min-w-0 break-all font-mono text-caption-1-regular text-text-primary">{command ? field(input, "command") : path}</code>
    </div>
    {reason && <p className="px-3 pb-2 text-caption-1-regular text-text-tertiary">{reason}</p>}
    {lines.length > 0 && <div className="flex max-h-64 flex-col"><DiffText lines={lines} wrap path={path} /></div>}
    {denying ? <form className="flex flex-wrap items-center gap-2 border-t border-separator-border px-3 py-2"
      onSubmit={(event) => { event.preventDefault(); respond(approvalId, false, why); }}>
      <input ref={reasonRef} value={why} onChange={(event) => setWhy(event.target.value)} maxLength={500}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setDenying(false); } }}
        aria-label="拒绝原因（可选）" placeholder="告诉 Agent 为什么拒绝、应该怎么做（可选）"
        className="h-8 min-w-0 flex-1 rounded-lg border border-border-button-default bg-transparent px-2.5 text-body-2-regular text-text-primary outline-none placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-border-focus-ring" />
      <Button type="button" variant="ghost" size="small" onClick={() => setDenying(false)}>取消</Button>
      <Button type="submit" variant="danger" size="small" disabled={!canRespond}>拒绝</Button>
    </form> : <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-separator-border px-3 py-2">
      {!canRespond ? <span className="me-auto text-caption-1-regular text-text-tertiary">回复结束后可以确认</span>
        : keys && <span className="me-auto text-caption-1-regular text-text-tertiary">Enter 允许 · Esc 拒绝</span>}
      <Button variant="secondary" size="small" disabled={!canRespond} onClick={() => setDenying(true)}>拒绝…</Button>
      <Button variant="secondary" size="small" disabled={!canRespond} onClick={() => allowAlways(approvalId, rule)}
        title={command ? "这条命令在本对话中不再询问" : "本对话中的文件修改不再询问"}>{command ? "本对话总是允许" : "本对话自动接受编辑"}</Button>
      <Button variant="primary" size="small" disabled={!canRespond} onClick={() => respond(approvalId, true)}>允许</Button>
    </footer>}
  </section>;
}
