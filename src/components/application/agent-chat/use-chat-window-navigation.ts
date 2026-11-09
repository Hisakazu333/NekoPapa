import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { ChatContact } from "@/app/contacts-store";
import { ChatSessionMemory, emptyChatSession, type ChatSessionSnapshot } from "./chat-session-memory";
import type { StoredThread } from "./thread-storage";
import { newThreadId } from "./thread-storage";
import { useChatWorkspaceTabs } from "./use-chat-workspace-tabs";

export function useChatWindowNavigation({
  activeId,
  busy,
  threads,
  sessionMemory,
  keepLiveThread,
  rememberSession,
  restoreSession,
  setSelectedContact,
  enterWorkspace,
}: {
  activeId: string;
  busy: boolean;
  threads: StoredThread[];
  sessionMemory: { current: ChatSessionMemory };
  keepLiveThread: () => void;
  rememberSession: () => void;
  restoreSession: (session: ChatSessionSnapshot) => void;
  setSelectedContact: Dispatch<SetStateAction<ChatContact | undefined>>;
  enterWorkspace: () => void;
}) {
  const beforeSwitch = useCallback(() => {
    keepLiveThread();
    rememberSession();
  }, [keepLiveThread, rememberSession]);
  const createSession = useCallback(() => {
    const session = emptyChatSession(newThreadId());
    setSelectedContact(undefined);
    restoreSession(session);
    return session.id;
  }, [restoreSession, setSelectedContact]);
  const restoreById = useCallback((id: string) => {
    const snapshot = sessionMemory.current.getSession(id);
    if (snapshot) {
      restoreSession(snapshot);
      return;
    }
    const thread = threads.find((candidate) => candidate.id === id);
    if (thread) restoreSession(sessionMemory.current.openThread(thread, thread.contact));
  }, [restoreSession, sessionMemory, threads]);
  const navigation = useChatWorkspaceTabs({
    busy,
    currentSessionId: activeId,
    beforeSwitch,
    createSession,
    restoreSession: restoreById,
    enterWorkspace,
  });

  useEffect(() => {
    if (activeId) navigation.open(activeId);
  }, [activeId, navigation.open]);

  return navigation;
}
