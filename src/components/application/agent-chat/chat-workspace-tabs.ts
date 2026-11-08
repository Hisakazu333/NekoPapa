export interface ChatWorkspaceTabsState {
  ids: string[];
  activeId: string;
  history: string[];
  historyIndex: number;
}

export function emptyChatWorkspaceTabs(): ChatWorkspaceTabsState {
  return { ids: [], activeId: "", history: [], historyIndex: -1 };
}

function visit(state: ChatWorkspaceTabsState, id: string): ChatWorkspaceTabsState {
  if (state.activeId === id) return state;
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(id);
  return { ...state, activeId: id, history, historyIndex: history.length - 1 };
}

export function openChatWorkspaceTab(state: ChatWorkspaceTabsState, id: string): ChatWorkspaceTabsState {
  if (!id) return state;
  const ids = state.ids.includes(id) ? state.ids : [...state.ids, id];
  return visit({ ...state, ids }, id);
}

export function activateChatWorkspaceTab(state: ChatWorkspaceTabsState, id: string): ChatWorkspaceTabsState {
  return state.ids.includes(id) ? visit(state, id) : state;
}

export function navigateChatWorkspaceTabs(
  state: ChatWorkspaceTabsState,
  direction: "back" | "forward",
): ChatWorkspaceTabsState {
  const index = state.historyIndex + (direction === "back" ? -1 : 1);
  if (index < 0 || index >= state.history.length) return state;
  return { ...state, activeId: state.history[index], historyIndex: index };
}

export function nextChatWorkspaceTabAfterClose(state: ChatWorkspaceTabsState, id: string): string {
  const index = state.ids.indexOf(id);
  if (index < 0) return state.activeId;
  if (id !== state.activeId) return state.activeId;
  return state.ids[index - 1] ?? state.ids[index + 1] ?? "";
}

export function closeChatWorkspaceTab(state: ChatWorkspaceTabsState, id: string): ChatWorkspaceTabsState {
  const index = state.ids.indexOf(id);
  if (index < 0) return state;
  const ids = state.ids.filter((entry) => entry !== id);
  const history = state.history.filter((entry) => entry !== id);
  const activeId = id === state.activeId
    ? ids[index - 1] ?? ids[index] ?? ""
    : state.activeId;

  if (!activeId) return { ids, activeId: "", history: [], historyIndex: -1 };

  if (!history.includes(activeId)) history.push(activeId);
  const historyIndex = history.lastIndexOf(activeId);
  return { ids, activeId, history, historyIndex };
}
