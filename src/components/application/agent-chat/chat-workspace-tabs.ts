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

/**
 * 清理标签: every open tab closes and one fresh chat remains, with history
 * starting again from it. Closing a tab only closes the view — saved chats
 * stay in the sidebar under their project.
 */
export function resetChatWorkspaceTabs(freshId: string): ChatWorkspaceTabsState {
  return { ids: [freshId], activeId: freshId, history: [freshId], historyIndex: 0 };
}

export interface ChatTabSource { id: string; title?: string | null; contact?: { name: string } }
export interface ChatTabEntry { id: string; title: string; unread: boolean }

/**
 * Title-bar tabs for the open chats, in opening order. A tab stays only while
 * its chat still exists: the active chat, a saved chat, or one kept in this
 * window's session memory. A deleted chat drops out instead of becoming a
 * tab that leads nowhere. Contact chats are titled with the contact's name.
 */
export function chatTabEntries(state: ChatWorkspaceTabsState, {
  activeId, activeTitle, threads, sessionOf,
}: {
  activeId: string;
  activeTitle: string;
  threads: readonly (ChatTabSource & { unread?: boolean })[];
  sessionOf: (id: string) => ChatTabSource | undefined;
}): ChatTabEntry[] {
  const ids = state.ids.includes(activeId) || !activeId ? state.ids : [...state.ids, activeId];
  return ids.flatMap((id) => {
    if (id === activeId) return [{ id, title: activeTitle, unread: false }];
    const source = threads.find((thread) => thread.id === id) ?? sessionOf(id);
    if (!source) return [];
    const unread = "unread" in source && source.unread === true;
    return [{ id, title: source.contact?.name ?? (source.title?.trim() || "新对话"), unread }];
  });
}
