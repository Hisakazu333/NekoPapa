import { useSyncExternalStore } from "react";
import { ChatHistoryStore } from "@/app/chat-history-store";
import { CONTACTS_STORAGE_KEY } from "@/app/contacts-store";
import { CHAT_STORAGE_KEY, LEGACY_CHAT_STORAGE_KEY } from "@/components/application/agent-chat/thread-storage";

const history = new ChatHistoryStore();
let subscribers = 0;

function synchronize(event: StorageEvent) {
  if (event.key === CHAT_STORAGE_KEY || event.key === LEGACY_CHAT_STORAGE_KEY || event.key === CONTACTS_STORAGE_KEY || event.key === null) history.reload();
}

function subscribe(listener: () => void) {
  if (subscribers === 0) {
    history.reload();
    window.addEventListener("storage", synchronize);
  }
  subscribers += 1;
  const unsubscribe = history.subscribe(listener);
  return () => {
    unsubscribe();
    subscribers -= 1;
    if (subscribers === 0) window.removeEventListener("storage", synchronize);
  };
}

/** Stable commands mutate the singleton; components never replace its array. */
export function useChatHistory() {
  const snapshot = useSyncExternalStore(subscribe, history.getSnapshot, history.getSnapshot);
  return {
    ...snapshot,
    upsertThread: history.upsertThread,
    removeThread: history.removeThread,
    removeContactThreads: history.removeContactThreads,
    renameThread: history.renameThread,
    toggleThreadUnread: history.toggleThreadUnread,
    retryHistory: history.retryHistory,
  };
}
