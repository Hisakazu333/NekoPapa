import { createContext, useContext } from "react";

/** What 本对话总是允许 covers: one exact command, or every file change. */
export type AllowRule = { command: string } | { edits: true };

/**
 * What the transcript's tool cards can do: answer an approval (with a reason
 * when denying, or allowing the same again for the rest of the chat),
 * continue a run the step cap stopped, and whether this window can undo a
 * change (the desktop app, where the snapshots live). Provided by the chat
 * that owns the conversation, so memoized messages do not re-render when the
 * callbacks change.
 */
export interface AgentToolActions {
  respond: (approvalId: string, approved: boolean, reason?: string) => void;
  allowAlways: (approvalId: string, rule: AllowRule) => void;
  /** False while a reply is streaming: approvals wait for it to finish. */
  canRespond: boolean;
  canUndo: boolean;
  /** Picks a run back up where the step cap stopped it. */
  continueRun: () => void;
  /** The approval Enter and Esc answer: the first one waiting in the last reply. */
  shortcutApprovalId?: string;
}

export const AgentToolActionsContext = createContext<AgentToolActions>({
  respond: () => undefined, allowAlways: () => undefined, canRespond: false, canUndo: false, continueRun: () => undefined,
});

export const useAgentToolActions = () => useContext(AgentToolActionsContext);
