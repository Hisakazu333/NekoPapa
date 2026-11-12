import { createContext, useContext } from "react";

/**
 * What the transcript's tool cards can do: answer an approval, and whether
 * this window can undo a change (the desktop app, where the snapshots live).
 * Provided by the chat that owns the conversation, so memoized messages do
 * not re-render when the callbacks change.
 */
export interface AgentToolActions {
  respond: (approvalId: string, approved: boolean) => void;
  /** False while a reply is streaming: approvals wait for it to finish. */
  canRespond: boolean;
  canUndo: boolean;
}

export const AgentToolActionsContext = createContext<AgentToolActions>({ respond: () => undefined, canRespond: false, canUndo: false });

export const useAgentToolActions = () => useContext(AgentToolActionsContext);
