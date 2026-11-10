import { useSyncExternalStore } from "react";
import { GROUP_CHATS_STORAGE_KEY, GroupChatStore } from "@/app/contacts/group-chat-store";

const store = new GroupChatStore();
let subscribers = 0;
function synchronize(event: StorageEvent) { if (event.key === GROUP_CHATS_STORAGE_KEY || event.key === null) store.reload(); }
function subscribe(listener: () => void) {
  if (!subscribers++) { store.reload(); window.addEventListener("storage", synchronize); }
  const unsubscribe = store.subscribe(listener);
  return () => { unsubscribe(); if (!--subscribers) window.removeEventListener("storage", synchronize); };
}
export function useGroupChats() {
  const snapshot = useSyncExternalStore(subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, createGroup: store.create, removeGroup: store.removeGroup, putMessage: store.putMessage, retry: store.retry };
}
