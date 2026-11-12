import { useCallback, useEffect, useMemo, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { lastAssistantMessageIsCompleteWithApprovalResponses, type ChatAddToolApproveResponseFunction, type UIMessage } from "ai";
import type { UseChatHelpers } from "@ai-sdk/react";
import { agentWorkspaceBody } from "@/app/agent/agent-request";
import type { PermissionMode } from "@/app/settings/permission-modes";
import type { AgentToolActions } from "./agent-tools/agent-tool-actions";

/**
 * The workbench chat's Agent run: what each request carries (the composer's
 * profile and instructions, the contact, and the project folder with this
 * chat's permission mode), and the approvals in the transcript. Once every
 * approval in the last reply is answered, the reply continues with the same
 * request fields, so an approved call runs and a denied one is reported.
 */
export function useAgentRun({ messages, busy, base, project, permission, addToolApprovalResponse, sendMessage }: {
  messages: UIMessage[];
  busy: boolean;
  /** The composer's and contact's request fields. */
  base: Record<string, unknown>;
  /** The chat's project, or undefined for contact chats and chats outside a project. */
  project?: { name: string; folders: readonly string[] };
  permission: PermissionMode;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
}) {
  const body = useMemo(() => ({ ...base, ...agentWorkspaceBody(project, permission) }), [base, project, permission]);
  const bodyRef = useRef(body);
  useEffect(() => { bodyRef.current = body; }, [body]);
  const answered = useRef(false);

  const respond = useCallback((id: string, approved: boolean) => {
    answered.current = true;
    void addToolApprovalResponse({ id, approved, ...(approved ? {} : { reason: "用户拒绝了这次操作。" }) });
  }, [addToolApprovalResponse]);

  useEffect(() => {
    if (!answered.current || busy || !lastAssistantMessageIsCompleteWithApprovalResponses({ messages })) return;
    answered.current = false;
    void sendMessage(undefined, { body: bodyRef.current });
  }, [messages, busy, sendMessage]);

  const actions: AgentToolActions = useMemo(() => ({ respond, canRespond: !busy, canUndo: isTauri() }), [respond, busy]);
  return { body, actions };
}
