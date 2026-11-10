import { parseStoredChatContact, type ChatContactMetadata } from "../../components/application/agent-chat/chat-contact";

export const GROUP_CHATS_STORAGE_KEY = "nekopapa.group-chats.v1";
export interface GroupMessage {
  id: string; role: "user" | "assistant"; text: string; at: number;
  speakerId?: string; turnId?: string; state?: "streaming" | "complete" | "stopped" | "failed";
}
export interface GroupChat {
  id: string; title: string; members: ChatContactMetadata[]; messages: GroupMessage[]; updatedAt: number;
}
interface GroupSnapshot { groups: GroupChat[]; error: string | null; ready: boolean; writable: boolean }
interface GroupHistory { groups: GroupChat[]; deletedIds: string[] }
type GroupStorage = Pick<Storage, "getItem" | "setItem">;
export function officialGroupRestriction(members: readonly ChatContactMetadata[]): string | undefined {
  return members.some((member) => member.kind === "official")
    ? "官方人物仅支持单人陪伴聊天和学习，不能加入群聊。"
    : undefined;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length < 200;
const time = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function parseGroupHistory(raw: string | null): GroupHistory {
  if (raw === null) return { groups: [], deletedIds: [] };
  if (raw.length > 4_000_000) throw new Error("Group history too large");
  const data: unknown = JSON.parse(raw);
  if (!object(data) || data.version !== 1 || !Array.isArray(data.groups) || data.groups.length > 100) throw new Error("Invalid group history");
  const deletedIds = data.deletedIds === undefined ? [] : data.deletedIds;
  if (!Array.isArray(deletedIds) || deletedIds.some((value) => !id(value) || !value.startsWith("group-")) || new Set(deletedIds).size !== deletedIds.length) throw new Error("Invalid deleted groups");
  const groups = data.groups.map((entry): GroupChat => {
    if (!object(entry) || !id(entry.id) || !entry.id.startsWith("group-") || typeof entry.title !== "string" || entry.title.length > 100 ||
      !time(entry.updatedAt) || !Array.isArray(entry.members) || entry.members.length < 2 || entry.members.length > 5 || !Array.isArray(entry.messages) || entry.messages.length > 2000) throw new Error("Invalid group");
    const members = entry.members.map(parseStoredChatContact);
    if (members.some((member) => !member) || new Set(members.map((member) => member!.id)).size !== members.length) throw new Error("Invalid members");
    const memberIds = new Set(members.map((member) => member!.id));
    const messages = entry.messages.map((message): GroupMessage => {
      if (!object(message) || !id(message.id) || !["user", "assistant"].includes(message.role as string) || typeof message.text !== "string" || message.text.length > 200_000 ||
        !time(message.at) || (message.role === "assistant" && (!memberIds.has(message.speakerId as string) || !id(message.turnId) || !["streaming", "complete", "stopped", "failed"].includes(message.state as string))) ||
        (message.role === "user" && (message.speakerId !== undefined || message.turnId !== undefined))) throw new Error("Invalid group message");
      return message as unknown as GroupMessage;
    });
    if (new Set(messages.map((message) => message.id)).size !== messages.length || messages.some((message) => message.role === "assistant" && !messages.some((user) => user.id === message.turnId && user.role === "user"))) throw new Error("Invalid group turns");
    return { id: entry.id, title: entry.title, updatedAt: entry.updatedAt, members: members as ChatContactMetadata[], messages };
  });
  if (new Set(groups.map((group) => group.id)).size !== groups.length) throw new Error("Duplicate groups");
  const deleted = new Set(deletedIds);
  return { groups: groups.filter((group) => !deleted.has(group.id)), deletedIds };
}

export function parseGroupChats(raw: string | null): GroupChat[] {
  return parseGroupHistory(raw).groups;
}

/** Only this store writes group history; messages merge by ID against the latest storage. */
export class GroupChatStore {
  private snapshot: GroupSnapshot = { groups: [], error: null, ready: false, writable: false };
  private listeners = new Set<() => void>();
  private pending = new Map<string, GroupChat>();
  constructor(private storage: GroupStorage = { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(groups: GroupChat[], error: string | null, writable: boolean) {
    this.snapshot = { groups: groups.sort((a, b) => b.updatedAt - a.updatedAt), error, writable, ready: true };
    this.listeners.forEach((listener) => listener());
  }
  private read(): GroupHistory | undefined {
    let raw: string | null;
    try { raw = this.storage.getItem(GROUP_CHATS_STORAGE_KEY); }
    catch { this.publish(this.snapshot.groups, "无法读取群聊，已阻止覆盖原数据。请重试。", false); return; }
    try { return parseGroupHistory(raw); }
    catch {
      try {
        const key = `${GROUP_CHATS_STORAGE_KEY}.recovery`;
        const backup = this.storage.getItem(key);
        if (backup !== null && backup !== raw) throw new Error("Existing backup");
        if (raw !== null && backup === null) this.storage.setItem(key, raw);
      } catch { /* Keep the original untouched even when backup cannot be written. */ }
      this.publish(this.snapshot.groups, "群聊数据读取失败，原数据已保留。请恢复备份后重试。", false);
    }
  }
  reload = () => {
    const stored = this.read();
    if (!stored) return;
    const merged = this.mergePending(stored);
    this.publish([...merged.values()], this.pending.size ? this.snapshot.error : null, true);
  };
  private mergePending(stored: GroupHistory): Map<string, GroupChat> {
    const deleted = new Set(stored.deletedIds);
    const merged = new Map(stored.groups.map((group) => [group.id, group]));
    for (const [key, group] of this.pending) {
      // An old window or a late streaming reply cannot restore a deleted group.
      if (deleted.has(key)) this.pending.delete(key);
      else merged.set(key, this.merge(merged.get(key), group));
    }
    return merged;
  }
  private write(groups: GroupChat[], deletedIds: string[]) {
    const serializable = groups.map((group) => ({ ...group, members: group.members.map((member) => {
      if (member.kind !== "custom") return member;
      const { avatar: _derivedAvatar, ...identity } = member;
      return identity;
    }) }));
    const raw = JSON.stringify({ version: 1, groups: serializable, deletedIds });
    parseGroupHistory(raw);
    this.storage.setItem(GROUP_CHATS_STORAGE_KEY, raw);
  }
  private merge(previous: GroupChat | undefined, next: GroupChat): GroupChat {
    const messages = new Map(previous?.messages.map((message) => [message.id, message]) ?? []);
    next.messages.forEach((message) => messages.set(message.id, message));
    return { ...next, updatedAt: Math.max(previous?.updatedAt ?? 0, next.updatedAt), messages: [...messages.values()].sort((a, b) => a.at - b.at) };
  }
  private save(group: GroupChat): boolean {
    this.pending.set(group.id, this.merge(this.pending.get(group.id), group));
    const visible = new Map(this.snapshot.groups.map((item) => [item.id, item]));
    visible.set(group.id, this.merge(visible.get(group.id), group));
    this.publish([...visible.values()], this.snapshot.error, this.snapshot.writable);
    return this.retry() && this.snapshot.groups.some((item) => item.id === group.id);
  }
  retry = (): boolean => {
    const stored = this.read();
    if (!stored) return false;
    const values = [...this.mergePending(stored).values()];
    try {
      if (this.pending.size) this.write(values, stored.deletedIds);
      this.pending.clear();
      this.publish(values, null, true);
      return true;
    } catch { this.publish(values, "群聊未能保存，当前消息已保留，请重试保存。", true); return false; }
  };
  removeGroup = (groupId: string): boolean => {
    const stored = this.read();
    if (!stored) return false;
    const groups = this.mergePending(stored);
    if (stored.deletedIds.includes(groupId)) {
      this.publish([...groups.values()], this.pending.size ? this.snapshot.error : null, true);
      return true;
    }
    if (!groups.has(groupId)) return false;
    const remaining = [...groups.values()].filter((group) => group.id !== groupId);
    try {
      this.write(remaining, [...stored.deletedIds, groupId]);
      this.pending.clear();
      this.publish(remaining, null, true);
      return true;
    } catch {
      // Do not queue a failed deletion: a later save must not delete it silently.
      this.publish([...groups.values()], "群聊未能删除，原记录已保留，请重试。", true);
      return false;
    }
  };
  create = (contacts: ChatContactMetadata[]): { group?: GroupChat; error?: string } => {
    const members = contacts.map((contact) => parseStoredChatContact(contact));
    if (members.length < 2 || members.length > 5 || members.some((member) => !member) || new Set(members.map((member) => member!.id)).size !== members.length) return { error: "请选择 2–5 位不同的联系人。" };
    const restriction = officialGroupRestriction(members as ChatContactMetadata[]);
    if (restriction) return { error: restriction };
    this.reload();
    if (!this.snapshot.writable) return { error: this.snapshot.error! };
    if (this.snapshot.groups.length >= 100) return { error: "最多保存 100 个群聊。" };
    const group: GroupChat = { id: `group-${crypto.randomUUID()}`, title: members.map((member) => member!.name).join("、").slice(0, 100), members: members as ChatContactMetadata[], messages: [], updatedAt: Date.now() };
    if (!this.save(group)) {
      this.pending.delete(group.id);
      // A failed reread must not retain an optimistic group that was never created.
      this.publish(this.snapshot.groups.filter((item) => item.id !== group.id), this.snapshot.error, this.snapshot.writable);
      this.reload();
      return { error: "群聊未能创建，请重试。" };
    }
    return { group };
  };
  putMessage = (groupId: string, message: GroupMessage): boolean => {
    const group = this.snapshot.groups.find((item) => item.id === groupId);
    if (!group) return false;
    // Queue the changed message only: unchanged local snapshots must not
    // roll back another window’s completed replies during a later save.
    return this.save({ ...group, messages: [structuredClone(message)], updatedAt: Math.max(group.updatedAt, message.at) });
  };
}
