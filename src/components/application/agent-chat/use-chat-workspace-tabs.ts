import { useCallback, useState } from "react";
import {
  activateChatWorkspaceTab,
  closeChatWorkspaceTab,
  emptyChatWorkspaceTabs,
  navigateChatWorkspaceTabs,
  nextChatWorkspaceTabAfterClose,
  openChatWorkspaceTab,
} from "./chat-workspace-tabs";

export function useChatWorkspaceTabs({
  busy,
  currentSessionId,
  beforeSwitch,
  createSession,
  restoreSession,
  enterWorkspace,
}: {
  busy: boolean;
  currentSessionId: string;
  beforeSwitch: () => void;
  createSession: () => string;
  restoreSession: (id: string) => void;
  enterWorkspace: () => void;
}) {
  const [state, setState] = useState(emptyChatWorkspaceTabs);

  const open = useCallback((id: string) => {
    setState((previous) => openChatWorkspaceTab(previous, id));
  }, []);

  const select = useCallback((id: string) => {
    if (busy || !state.ids.includes(id) || (state.activeId === id && currentSessionId === id)) return;
    beforeSwitch();
    restoreSession(id);
    enterWorkspace();
    setState((previous) => activateChatWorkspaceTab(previous, id));
  }, [beforeSwitch, busy, currentSessionId, enterWorkspace, restoreSession, state.activeId, state.ids]);

  const create = useCallback(() => {
    if (busy) return;
    beforeSwitch();
    const id = createSession();
    if (!id) return;
    enterWorkspace();
    setState((previous) => openChatWorkspaceTab(previous, id));
  }, [beforeSwitch, busy, createSession, enterWorkspace]);

  const navigate = useCallback((direction: "back" | "forward") => {
    if (busy) return;
    const next = navigateChatWorkspaceTabs(state, direction);
    if (next.activeId === state.activeId) return;
    beforeSwitch();
    restoreSession(next.activeId);
    enterWorkspace();
    setState((previous) => navigateChatWorkspaceTabs(previous, direction));
  }, [beforeSwitch, busy, enterWorkspace, restoreSession, state]);

  const close = useCallback((id: string) => {
    if (!state.ids.includes(id)) return;
    if (id !== state.activeId) {
      setState((previous) => closeChatWorkspaceTab(previous, id));
      return;
    }
    if (busy) return;
    beforeSwitch();
    const nextId = nextChatWorkspaceTabAfterClose(state, id);
    if (nextId) {
      restoreSession(nextId);
      setState((previous) => closeChatWorkspaceTab(previous, id));
    } else {
      const freshId = createSession();
      if (!freshId) return;
      setState((previous) => openChatWorkspaceTab(closeChatWorkspaceTab(previous, id), freshId));
    }
    enterWorkspace();
  }, [beforeSwitch, busy, createSession, enterWorkspace, restoreSession, state]);

  const remove = useCallback((id: string) => {
    if (!state.ids.includes(id)) return undefined;
    const nextId = nextChatWorkspaceTabAfterClose(state, id);
    setState((previous) => closeChatWorkspaceTab(previous, id));
    return id === state.activeId ? nextId || undefined : undefined;
  }, [state]);

  const back = useCallback(() => navigate("back"), [navigate]);
  const forward = useCallback(() => navigate("forward"), [navigate]);

  return {
    state,
    open,
    select,
    create,
    close,
    remove,
    back,
    forward,
    canGoBack: state.historyIndex > 0,
    canGoForward: state.historyIndex >= 0 && state.historyIndex < state.history.length - 1,
  };
}
