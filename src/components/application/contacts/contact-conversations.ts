import type { ChatContact } from "@/app/contacts-store";
import { messageText, orderThreads, type StoredThread } from "../agent-chat/thread-storage";

/** Older contact histories keep their IDs; opening a contact resumes its latest conversation. */
export function findContactThread(threads: StoredThread[], contactId: string) {
  return orderThreads(threads).find((thread) => thread.contact?.id === contactId);
}

/** Keep a new contact's first conversation ID identical in every chat entry. */
export function resolveContactThread(threads: StoredThread[], contact: ChatContact): StoredThread {
  return findContactThread(threads, contact.id) ?? {
    id: `contact-thread:${contact.id}`,
    title: contact.name,
    updatedAt: 0,
    messages: [],
    messageAt: {},
    contact,
  };
}

export function contactPreviews(threads: StoredThread[]) {
  const previews: Record<string, { text: string; updatedAt: number; busy?: boolean }> = {};
  for (const thread of orderThreads(threads)) {
    if (!thread.contact || previews[thread.contact.id]) continue;
    const last = [...thread.messages].reverse().find((message) => message.role !== "system" && messageText(message));
    previews[thread.contact.id] = {
      text: last ? `${last.role === "user" ? "我：" : ""}${messageText(last)}` : "",
      updatedAt: thread.updatedAt,
    };
  }
  return previews;
}
