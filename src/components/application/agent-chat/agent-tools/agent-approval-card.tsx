import { FileCodeIcon, ShieldAlertIcon, SquareTerminalIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { editPreview, lineCount, writePreview } from "@/app/agent/change-preview";
import { DiffText } from "../tools/file-text";
import { useAgentToolActions } from "./agent-tool-actions";

const field = (input: unknown, name: string) => {
  const value = input !== null && typeof input === "object" ? (input as Record<string, unknown>)[name] : undefined;
  return typeof value === "string" ? value : "";
};

/**
 * A file change or command waiting for the user (权限模式 每次询问, or
 * 自动接受编辑 for commands). Nothing runs until 允许; 拒绝 tells the Agent
 * not to, and it carries on without it.
 */
export function AgentApprovalCard({ name, input, approvalId, reason }: { name: string; input: unknown; approvalId: string; reason?: string }) {
  const { respond, canRespond } = useAgentToolActions();
  const command = name === "run_command";
  const path = field(input, "path");
  const lines = name === "edit_file" ? editPreview(field(input, "oldText"), field(input, "newText"))
    : name === "write_file" ? writePreview(field(input, "content")) : [];
  const title = command ? "允许运行这条命令？" : name === "write_file" ? `允许写入 ${lineCount(field(input, "content"))} 行到这个文件？` : "允许修改这个文件？";
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
    <footer className="flex items-center justify-end gap-2 border-t border-separator-border px-3 py-2">
      {!canRespond && <span className="me-auto text-caption-1-regular text-text-tertiary">回复结束后可以确认</span>}
      <Button variant="secondary" size="small" disabled={!canRespond} onClick={() => respond(approvalId, false)}>拒绝</Button>
      <Button variant="primary" size="small" disabled={!canRespond} onClick={() => respond(approvalId, true)}>允许</Button>
    </footer>
  </section>;
}
