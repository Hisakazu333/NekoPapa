import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import { agentWorkspaceBody, type AgentAllowances } from "@/app/agent/agent-request";
import { isToolUIPart, pendingApprovals, toolName } from "@/app/agent/message-segments";
import type { SendInput } from "@/app/agent/message-queue";
import type { PermissionMode } from "@/app/settings/permission-modes";
import type { AgentToolActions, AllowRule } from "./agent-tools/agent-tool-actions";
import { useMessageQueue } from "./use-message-queue";

const NO_ALLOWANCES: AgentAllowances = { commands: [], edits: false };
let runCount = 0;
const newRunId = () => `run-${Date.now().toString(36)}-${(runCount += 1).toString(36)}`;

/** Whether an approval waiting in a reply is covered by a rule the user just allowed. */
function covered(part: UIMessage["parts"][number], rule: AllowRule): boolean {
  if (!isToolUIPart(part)) return false;
  const name = toolName(part);
  if ("edits" in rule) return name === "write_file" || name === "edit_file";
  return name === "run_command" && (part.input as { command?: unknown } | undefined)?.command === rule.command;
}

/**
 * The workbench chat's Agent run: what each request carries (the composer's
 * profile and instructions, the contact, the project folder with this chat's
 * permission mode, what the user allowed for this chat, and a run id the
 * composer steers it by), the approvals in the transcript, and messages typed
 * while it runs (use-message-queue.ts). Once every approval in the last reply
 * is answered, the reply continues with the same request fields, so an
 * approved call runs and a denied one is reported with its reason.
 */
export function useAgentRun({ chat, conversationId, base, project, permission }: {
  chat: Pick<UseChatHelpers<UIMessage>, "messages" | "status" | "sendMessage" | "stop" | "addToolApprovalResponse">;
  conversationId: string;
  /** The composer's and contact's request fields. */
  base: Record<string, unknown>;
  /** The chat's project, or undefined for contact chats and chats outside a project. */
  project?: { name: string; folders: readonly string[] };
  permission: PermissionMode;
}) {
  const { messages, status, sendMessage, stop, addToolApprovalResponse } = chat;
  const busy = status === "submitted" || status === "streaming";
  const workspace = useMemo(() => agentWorkspaceBody(project, permission), [project, permission]);
  const body = useMemo(() => ({ ...base, ...workspace }), [base, workspace]);
  const bodyRef = useRef(body);
  useEffect(() => { bodyRef.current = body; }, [body]);

  // 本对话总是允许: kept for the open chat only, read when each request goes out.
  const [allowState, setAllowState] = useState({ id: conversationId, rules: NO_ALLOWANCES });
  const allowances = allowState.id === conversationId ? allowState.rules : NO_ALLOWANCES;
  const allowRef = useRef(allowances);
  useEffect(() => { allowRef.current = allowances; }, [allowances]);

  const runId = useRef("");
  const send = useCallback((message?: SendInput) => {
    runId.current = newRunId();
    const allow = allowRef.current;
    const extra = bodyRef.current.workspace && (allow.commands.length > 0 || allow.edits) ? { allow } : {};
    void sendMessage(message, { body: { ...bodyRef.current, ...extra, runId: runId.current } });
  }, [sendMessage]);

  const queue = useMessageQueue({
    conversationId, messages, status, send, runId: () => runId.current,
    canSteer: isTauri() && Boolean(workspace.workspace),
  });

  /** The composer's send: now when idle, otherwise into the queue. */
  const submit = useCallback((text: string, message: SendInput) => {
    if (busy) queue.add(text, message);
    else send(message);
  }, [busy, queue, send]);

  const stopRun = useCallback(() => {
    queue.markStopped();
    void stop();
  }, [queue, stop]);

  const answered = useRef(false);
  const respond = useCallback((id: string, approved: boolean, reason?: string) => {
    answered.current = true;
    const why = reason?.trim() ? `用户拒绝了这次操作，原因：${reason.trim()}` : "用户拒绝了这次操作。";
    void addToolApprovalResponse({ id, approved, ...(approved ? {} : { reason: why }) });
  }, [addToolApprovalResponse]);

  const allowAlways = useCallback((id: string, rule: AllowRule) => {
    const current = allowRef.current;
    const next = "edits" in rule ? { ...current, edits: true }
      : current.commands.includes(rule.command) ? current : { ...current, commands: [...current.commands, rule.command] };
    allowRef.current = next;
    setAllowState({ id: conversationId, rules: next });
    // The call itself, and any other call waiting in this reply that the rule covers.
    const last = messages[messages.length - 1];
    const others = last ? pendingApprovals(last.parts).filter((part) => part.state === "approval-requested" && part.approval.id !== id && covered(part, rule)) : [];
    respond(id, true);
    for (const part of others) if (part.state === "approval-requested") respond(part.approval.id, true);
  }, [conversationId, messages, respond]);

  useEffect(() => {
    if (!answered.current || busy || !lastAssistantMessageIsCompleteWithApprovalResponses({ messages })) return;
    answered.current = false;
    send();
  }, [messages, busy, send]);

  // The Agent reads its own earlier steps from the transcript and carries on.
  const continueRun = useCallback(() => send({ text: "继续" }), [send]);

  const last = messages[messages.length - 1];
  const firstWaiting = !busy && last?.role === "assistant" ? pendingApprovals(last.parts)[0] : undefined;
  const shortcutApprovalId = firstWaiting?.state === "approval-requested" ? firstWaiting.approval.id : undefined;

  const actions: AgentToolActions = useMemo(() => ({
    respond, allowAlways, canRespond: !busy, canUndo: isTauri(), continueRun, shortcutApprovalId,
  }), [respond, allowAlways, busy, continueRun, shortcutApprovalId]);
  return { body, actions, submit, stop: stopRun, queue };
}
