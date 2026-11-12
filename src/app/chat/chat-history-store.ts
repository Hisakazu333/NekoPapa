import {
  orderThreads, readThreads, writeThreads,
  type StoredThread, type ThreadReadResult,
} from "../../components/application/agent-chat/thread-storage";
import { sameJsonData } from "../../components/application/agent-chat/json-data-equal";
import { readDeletedContactIds } from "../contacts/contacts-store";

type HistoryStorage = Pick<Storage, "getItem" | "setItem">;
type ThreadPatch = Pick<StoredThread, "title" | "unread">;
type Mutation =
  | { kind: "upsert"; thread: StoredThread }
  | { kind: "remove"; id: string }
  | { kind: "patch"; id: string; patch: Partial<ThreadPatch> };

export interface ChatHistorySnapshot {
  threads: StoredThread[];
  error: string | null;
  ready: boolean;
  writable: boolean;
}

function applyMutations(threads: StoredThread[], mutations: Mutation[]) {
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  for (const mutation of mutations) {
    if (mutation.kind === "upsert") byId.set(mutation.thread.id, mutation.thread);
    else if (mutation.kind === "remove") byId.delete(mutation.id);
    else {
      const previous = byId.get(mutation.id);
      if (previous) byId.set(mutation.id, { ...previous, ...mutation.patch });
    }
  }
  return orderThreads([...byId.values()]);
}

/** One history owner shared by workspace chats and contact conversations. */
export class ChatHistoryStore {
  private snapshot: ChatHistorySnapshot = { threads: [], error: null, ready: false, writable: false };
  private readonly listeners = new Set<() => void>();
  private pending: Mutation[] = [];
  private readonly deletedContacts = new Set<string>();
  private storageError: string | null = null;

  constructor(private readonly storage?: HistoryStorage) {}

  getSnapshot = (): ChatHistorySnapshot => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.initialize();
    return () => { this.listeners.delete(listener); };
  };

  initialize = () => {
    if (this.snapshot.ready) return;
    const loaded = readThreads(this.storage);
    const contactsReadable = this.syncContactDeletions();
    this.publish({ threads: orderThreads(loaded.threads), error: loaded.error ?? (contactsReadable ? null : "无法安全读取联系人删除记录，已阻止写入聊天历史。"), ready: true, writable: loaded.writable && contactsReadable });
  };

  private syncContactDeletions() {
    const deleted = readDeletedContactIds(this.storage);
    if (!deleted) return false;
    for (const id of deleted) this.deletedContacts.add(id);
    this.pending = this.pending.filter((mutation) => mutation.kind !== "upsert" || !mutation.thread.contact || !this.deletedContacts.has(mutation.thread.contact.id));
    return true;
  }

  private visibleThreads(threads: StoredThread[]) {
    return threads.filter((thread) => !thread.contact || !this.deletedContacts.has(thread.contact.id));
  }

  private publish(next: ChatHistorySnapshot) {
    this.snapshot = { ...next, threads: this.visibleThreads(next.threads) };
    for (const listener of this.listeners) listener();
  }

  /** A failed read never replaces already visible or unsaved conversations. */
  private blocked(loaded: ThreadReadResult) {
    const known = new Map(loaded.threads.map((thread) => [thread.id, thread]));
    for (const thread of this.snapshot.threads) known.set(thread.id, thread);
    this.publish({
      threads: applyMutations([...known.values()], this.pending),
      ready: true, writable: false, error: loaded.error,
    });
  }

  private flush(loaded = readThreads(this.storage)) {
    if (!this.syncContactDeletions()) {
      this.blocked({ ...loaded, error: "无法安全读取联系人删除记录，已阻止写入聊天历史。" });
      return;
    }
    if (!loaded.writable) { this.blocked(loaded); return; }
    const threads = this.visibleThreads(applyMutations(loaded.threads, this.pending));
    const result = writeThreads(threads, true, this.storage);
    if (result.saved) this.pending = [];
    this.publish({ threads, ready: true, writable: true, error: result.error });
  }

  private commit(mutation: Mutation) {
    this.initialize();
    this.pending.push(mutation);
    this.flush();
  }

  upsertThread = (thread: StoredThread) => {
    this.initialize();
    this.syncContactDeletions();
    if (thread.contact && this.deletedContacts.has(thread.contact.id)) return;
    const previous = this.snapshot.threads.find((candidate) => candidate.id === thread.id);
    if (previous && sameJsonData(previous, thread)) return;
    this.commit({ kind: "upsert", thread });
  };

  removeThread = (id: string): boolean => {
    this.initialize();
    const loaded = readThreads(this.storage);
    if (!this.syncContactDeletions()) {
      this.blocked({ ...loaded, error: "无法安全读取联系人删除记录，已阻止写入聊天历史。" });
      return false;
    }
    if (!loaded.writable) {
      this.blocked(loaded);
      return false;
    }

    const threads = applyMutations(loaded.threads, this.pending).filter((thread) => thread.id !== id);
    const result = writeThreads(threads, true, this.storage);
    if (!result.saved) {
      // A failed destructive action must not stay queued and apply after the
      // user cancels the confirmation. Earlier unsaved edits remain retryable.
      this.publish({
        threads: applyMutations(loaded.threads, this.pending),
        ready: true, writable: true, error: result.error,
      });
      return false;
    }

    this.pending = [];
    this.publish({ threads, ready: true, writable: true, error: null });
    return true;
  };

  /** The contact tombstone blocks old streams and pending writes from restoring its chats. */
  removeContactThreads = (contactId: string): boolean => {
    this.initialize();
    if (!this.syncContactDeletions() || !this.deletedContacts.has(contactId)) return false;
    this.flush();
    return this.snapshot.error === null;
  };

  renameThread = (id: string, title: string) => {
    this.initialize();
    const previous = this.snapshot.threads.find((thread) => thread.id === id);
    if (!previous || previous.title === title) return;
    this.commit({ kind: "patch", id, patch: { title } });
  };

  toggleThreadUnread = (id: string) => {
    this.initialize();
    const previous = this.snapshot.threads.find((thread) => thread.id === id);
    if (!previous) return;
    this.commit({ kind: "patch", id, patch: { unread: !previous.unread } });
  };

  /** Refresh after another window changes storage; unsaved local edits win. */
  reload = () => {
    const loaded = readThreads(this.storage);
    if (!this.syncContactDeletions()) {
      this.blocked({ ...loaded, error: "无法安全读取联系人删除记录，已阻止写入聊天历史。" });
      return;
    }
    if (!loaded.writable) { this.blocked(loaded); return; }
    this.publish({
      threads: applyMutations(loaded.threads, this.pending),
      ready: true, writable: true,
      error: this.pending.length ? this.snapshot.error : null,
    });
  };

  /**
   * A write to the data folder finishes after the save returned (desktop).
   * Its failure is shown like a failed save; 重试 writes the history again.
   */
  reportStorageError = (error: string | null) => {
    if (!this.snapshot.ready || this.snapshot.error === error) return;
    if (error === null && this.snapshot.error !== this.storageError) return;
    this.storageError = error;
    this.publish({ ...this.snapshot, error });
  };

  retryHistory = () => {
    this.initialize();
    this.flush();
  };
}
