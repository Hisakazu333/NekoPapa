import type { ShellState, WorkspaceItem } from "./workspace-model";
import type { CompanionId } from "../contacts/companion-catalog";

export function conversationForCompanion(state: ShellState, id: CompanionId = state.selectedCompanionId): WorkspaceItem | undefined {
  const conversations = state.items.filter((item) => item.kind === "conversation" && item.companionId === id);
  return conversations.find((item) => item.id === state.activeId) ??
    state.recent.map((recent) => conversations.find((item) => item.id === recent)).find(Boolean) ??
    [...conversations].reverse().sort((a, b) => (Date.parse(b.activity?.updatedAt ?? "") || 0) - (Date.parse(a.activity?.updatedAt ?? "") || 0))[0];
}
