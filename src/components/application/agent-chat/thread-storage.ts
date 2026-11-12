import type { UIMessage } from "ai";
import { parseStoredChatContact, type ChatContactMetadata } from "./chat-contact";
import { chatStorage, DataFolderError } from "../../../platform/app-data-storage";

export type { ChatContactMetadata } from "./chat-contact";

export const CHAT_STORAGE_KEY = "nekopapa:chat-threads:v1";
export const LEGACY_CHAT_STORAGE_KEY = "boardui:agent-chat-threads";

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;
export interface ThreadReadResult {
  threads: StoredThread[];
  writable: boolean;
  error: string | null;
  source: "current" | "legacy" | "empty" | "unavailable";
}
export interface ThreadWriteResult { saved: boolean; error: string | null }

export interface StoredThread {
  id: string;
  title: string;
  updatedAt: number;
  unread?: boolean;
  messages: UIMessage[];
  messageAt: Record<string, number>;
  contact?: ChatContactMetadata;
  /** Project folder a workbench chat is grouped under; contact chats have none. */
  project?: string;
}

export function orderThreads(threads: StoredThread[]) {
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function messageText(message: UIMessage) {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
}

/** Reasoning parts the provider streamed, joined; empty for models that send none. */
export function messageReasoning(message: UIMessage) {
  return message.parts.filter((part) => part.type === "reasoning").map((part) => part.text).join("\n");
}

export function newThreadId() {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function deriveTitle(messages: UIMessage[]) {
  const first = messages.find((message) => message.role === "user");
  const text = first ? messageText(first).trim() : "";
  return text.length > 48 ? `${text.slice(0, 48)}...` : text || "New chat";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessage(value: unknown): boolean {
  return isObject(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.role === "string" && ["user", "assistant", "system"].includes(value.role) && Array.isArray(value.parts) &&
    value.parts.every((part) => isObject(part) && typeof part.type === "string" &&
      (part.type !== "text" || typeof part.text === "string"));
}

function parseThread(value: unknown): StoredThread {
  if (!isObject(value) || typeof value.id !== "string" || !value.id || typeof value.title !== "string" ||
    typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || !Array.isArray(value.messages) ||
    !value.messages.every(isMessage) || (value.unread !== undefined && typeof value.unread !== "boolean")) {
    throw new Error("Invalid thread");
  }
  if (new Set(value.messages.map((message) => (message as UIMessage).id)).size !== value.messages.length) throw new Error("Duplicate message ID");
  if (value.messageAt !== undefined && (!isObject(value.messageAt) ||
    !Object.values(value.messageAt).every((time) => typeof time === "number" && Number.isFinite(time)))) throw new Error("Invalid message times");
  const contact = value.contact === undefined ? undefined : parseStoredChatContact(value.contact);
  if (value.contact !== undefined && !contact) throw new Error("Invalid contact metadata");
  if (value.project !== undefined && (typeof value.project !== "string" || !value.project.trim() || value.project.length > 1024)) {
    throw new Error("Invalid project folder");
  }
  return { ...value, messageAt: value.messageAt ?? {}, ...(contact ? { contact } : {}) } as unknown as StoredThread;
}

function parseThreads(raw: string): { threads: StoredThread[]; migrated: boolean } {
  const parsed: unknown = JSON.parse(raw);
  const envelope = isObject(parsed) && parsed.version === 1 && Array.isArray(parsed.threads);
  const list = envelope ? parsed.threads : parsed;
  if (!Array.isArray(list)) throw new Error("Invalid chat history");
  const threads = list.map(parseThread);
  if (new Set(threads.map((thread) => thread.id)).size !== threads.length) throw new Error("Duplicate thread ID");
  return { threads, migrated: envelope && parsed.legacyMigrated === true };
}

/** Read old histories without modifying them; a successful save completes the one-time migration. */
export function readThreads(storage?: ReadStorage): ThreadReadResult {
  let threads: StoredThread[] = [];
  let source: ThreadReadResult["source"] = "unavailable";
  try {
    const target = storage ?? chatStorage();
    const currentRaw = target.getItem(CHAT_STORAGE_KEY);
    if (currentRaw !== null) {
      const current = parseThreads(currentRaw);
      threads = current.threads;
      source = "current";
      if (current.migrated) return { threads, source, writable: true, error: null };
    }
    const legacyRaw = target.getItem(LEGACY_CHAT_STORAGE_KEY);
    if (legacyRaw !== null) {
      const legacy = parseThreads(legacyRaw).threads;
      const currentIds = new Set(threads.map((thread) => thread.id));
      threads = [...threads, ...legacy.filter((thread) => !currentIds.has(thread.id))];
      if (source !== "current") source = "legacy";
    } else if (source !== "current") source = "empty";
    return { threads, source, writable: true, error: null };
  } catch (error) {
    return { threads, source, writable: false, error: error instanceof DataFolderError ? error.message : "无法安全读取聊天历史，已阻止覆盖原数据。请保留当前页面并检查浏览器存储。" };
  }
}

/** The read gate prevents a failed restore from being persisted as an empty history. */
export function writeThreads(threads: StoredThread[], writable: boolean, storage?: WriteStorage): ThreadWriteResult {
  if (!writable) return { saved: false, error: "聊天历史尚未安全恢复，已阻止覆盖原数据。" };
  try {
    const serializable = threads.map(parseThread).map((thread) => {
      if (thread.contact?.kind !== "custom") return thread;
      // The local picture is stored once as avatarDataUrl; catalog portraits derive from the ID.
      const { avatar: _avatar, ...contact } = thread.contact;
      return { ...thread, contact };
    });
    const raw = JSON.stringify({ version: 1, legacyMigrated: true, threads: serializable });
    parseThreads(raw);
    const target = storage ?? chatStorage();
    target.setItem(CHAT_STORAGE_KEY, raw);
    return { saved: true, error: null };
  } catch {
    return { saved: false, error: "聊天历史未能保存，本轮对话仍保留在当前页面中。请保留当前页面并重试。" };
  }
}
