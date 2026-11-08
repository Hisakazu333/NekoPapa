import type { StoredThread } from "./thread-storage";
import type { ChatContact } from "@/app/contacts-store";

export interface ChatSessionSnapshot {
  id: string;
  title: string | null;
  updatedAt: number;
  messages: StoredThread["messages"];
  messageAt: StoredThread["messageAt"];
  input: string;
  contact?: ChatContact;
}

export function emptyChatSession(id: string, contact?: ChatContact): ChatSessionSnapshot {
  return { id, title: null, updatedAt: 0, messages: [], messageAt: {}, input: "", ...(contact ? { contact } : {}) };
}

/** Page-local drafts only. Persisted transcripts remain owned by ChatHistoryStore. */
export class ChatSessionMemory {
  private workspace?: ChatSessionSnapshot;
  private readonly inputs = new Map<string, string>();
  private readonly sessions = new Map<string, ChatSessionSnapshot>();

  remember(session: ChatSessionSnapshot, contactOwned: boolean) {
    if (!session.id) return;
    this.inputs.set(session.id, session.input);
    this.sessions.set(session.id, session);
    if (!contactOwned) this.workspace = session;
  }

  openThread(thread: StoredThread, contact?: ChatContact): ChatSessionSnapshot {
    const session = {
      id: thread.id, title: thread.title, updatedAt: thread.updatedAt,
      messages: thread.messages, messageAt: thread.messageAt,
      input: this.inputs.get(thread.id) ?? "",
      ...(contact ? { contact } : {}),
    };
    this.sessions.set(thread.id, session);
    return session;
  }

  getSession(id: string): ChatSessionSnapshot | undefined {
    return this.sessions.get(id);
  }

  restoreWorkspace(createId: () => string): ChatSessionSnapshot {
    return this.workspace ?? emptyChatSession(createId());
  }

  forget(id: string) {
    this.inputs.delete(id);
    this.sessions.delete(id);
    if (this.workspace?.id === id) this.workspace = undefined;
  }
}
