import { companionById, companionCatalog, type CompanionId } from "./companion-model";
import { isContactAvatarDataUrl } from "./contact-avatar";

export const CONTACTS_STORAGE_KEY = "nekopapa.contacts.v1";
export const MAX_CONTACTS_STORAGE_LENGTH = 4_000_000;
export const contactLanguages = ["auto", "zh-CN", "en", "ja"] as const;
export const contactAvatarColors = ["neutral", "blue", "lime", "pink"] as const;
export type ContactLanguage = typeof contactLanguages[number];
export type ContactAvatarColor = typeof contactAvatarColors[number];

export interface ChatContact {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  avatar?: string;
  avatarDataUrl?: string;
  tags?: string;
  language?: ContactLanguage;
  avatarColor?: ContactAvatarColor;
  appearanceId?: CompanionId;
  kind: "official" | "custom";
}

export interface ContactDraft {
  name: string;
  description: string;
  prompt?: string;
  tags?: string;
  language?: ContactLanguage;
  avatarColor?: ContactAvatarColor;
  appearanceId?: CompanionId;
  avatarDataUrl?: string;
}
export type ContactErrors = Partial<Record<keyof ContactDraft | "form", string>>;
interface ContactsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
type CustomContact = Omit<ChatContact, "avatar"> & { kind: "custom" };
interface ContactSnapshot { contacts: CustomContact[]; deletedIds: string[] }

export const officialContacts: readonly ChatContact[] = companionCatalog.map((companion) => ({
  ...companion,
  kind: "official",
}));

const normalizeName = (name: string) => name.trim().normalize("NFKC").toLocaleLowerCase();
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isLanguage = (value: unknown): value is ContactLanguage => contactLanguages.some((item) => item === value);
const isAvatarColor = (value: unknown): value is ContactAvatarColor => contactAvatarColors.some((item) => item === value);
const isAppearanceId = (value: unknown): value is CompanionId => typeof value === "string" && companionById(value) !== undefined;
const isCustomContactId = (value: unknown): value is string => typeof value === "string" && /^contact-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function presentCustomContact(contact: CustomContact): ChatContact {
  const avatar = contact.avatarDataUrl ?? companionById(contact.appearanceId)?.avatar;
  return { ...contact, ...(avatar ? { avatar } : {}) };
}

function parseContacts(raw: string | null): ContactSnapshot {
  if (raw === null) return { contacts: [], deletedIds: [] };
  if (raw.length > MAX_CONTACTS_STORAGE_LENGTH) throw new Error("Contacts exceed storage limit");
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.contacts) || parsed.contacts.length > 100) throw new Error("Invalid contacts");
  const deletedIds = parsed.deletedIds === undefined ? [] : parsed.deletedIds;
  if (!Array.isArray(deletedIds) || deletedIds.some((value) => !isCustomContactId(value)) || new Set(deletedIds).size !== deletedIds.length) throw new Error("Invalid deleted contacts");
  const ids = new Set<string>();
  const names = new Set(officialContacts.map((contact) => normalizeName(contact.name)));
  const contacts = parsed.contacts.map((entry: unknown): CustomContact => {
    if (!isObject(entry) || entry.kind !== "custom" || !isCustomContactId(entry.id) || typeof entry.name !== "string" ||
      entry.name !== entry.name.trim() || !entry.name || entry.name.length > 60 ||
      typeof entry.description !== "string" || entry.description.length > 1000 ||
      (entry.prompt !== undefined && (typeof entry.prompt !== "string" || entry.prompt.length > 4000)) ||
      (entry.tags !== undefined && (typeof entry.tags !== "string" || entry.tags.length > 100)) ||
      (entry.language !== undefined && !isLanguage(entry.language)) ||
      (entry.avatarColor !== undefined && !isAvatarColor(entry.avatarColor)) ||
      (entry.appearanceId !== undefined && !isAppearanceId(entry.appearanceId)) ||
      (entry.avatarDataUrl !== undefined && !isContactAvatarDataUrl(entry.avatarDataUrl)) ||
      Object.keys(entry).some((key) => !["id", "name", "description", "prompt", "kind", "tags", "language", "avatarColor", "appearanceId", "avatarDataUrl"].includes(key))) throw new Error("Invalid contact");
    const normalizedName = normalizeName(entry.name);
    if (ids.has(entry.id) || names.has(normalizedName)) throw new Error("Duplicate contact");
    ids.add(entry.id);
    names.add(normalizedName);
    return {
      id: entry.id, name: entry.name, description: entry.description, kind: "custom",
      ...(entry.prompt !== undefined ? { prompt: entry.prompt as string } : {}),
      ...(entry.tags !== undefined ? { tags: entry.tags as string } : {}),
      ...(entry.language !== undefined ? { language: entry.language as ContactLanguage } : {}),
      ...(entry.avatarColor !== undefined ? { avatarColor: entry.avatarColor as ContactAvatarColor } : {}),
      ...(entry.appearanceId !== undefined ? { appearanceId: entry.appearanceId as CompanionId } : {}),
      ...(entry.avatarDataUrl !== undefined ? { avatarDataUrl: entry.avatarDataUrl as string } : {}),
    };
  });
  const deleted = new Set(deletedIds);
  return { contacts: contacts.filter((contact) => !deleted.has(contact.id)), deletedIds };
}

/** Undefined means the source could not be validated; callers must not treat it as empty. */
export function readDeletedContactIds(storage: Pick<ContactsStorage, "getItem"> = { getItem: (key) => localStorage.getItem(key) }): string[] | undefined {
  try { return parseContacts(storage.getItem(CONTACTS_STORAGE_KEY)).deletedIds; }
  catch { return undefined; }
}

export class ContactsStore {
  private current: CustomContact[] = [];
  private removed: string[] = [];
  private writable = false;
  private available = true;
  notice = "";

  constructor(private storage: ContactsStorage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  }) { this.reload(); }

  get contacts(): ChatContact[] { return structuredClone([...officialContacts, ...this.current.map(presentCustomContact)]); }
  get deletedIds(): string[] { return [...this.removed]; }
  get storageAvailable() { return this.available; }

  reload(source?: string | null): boolean {
    let raw: string | null;
    try { raw = source === undefined ? this.storage.getItem(CONTACTS_STORAGE_KEY) : source; }
    catch {
      this.writable = false;
      this.available = false;
      this.notice = "无法读取联系人，已阻止覆盖原数据。请重试。";
      return false;
    }
    try {
      const snapshot = parseContacts(raw);
      this.current = snapshot.contacts;
      this.removed = snapshot.deletedIds;
      this.writable = true;
      this.available = true;
      this.notice = "";
      return true;
    } catch {
      this.available = false;
      this.writable = false;
      try {
        const recoveryKey = `${CONTACTS_STORAGE_KEY}.recovery`;
        const previous = this.storage.getItem(recoveryKey);
        if (previous !== null && previous !== raw) throw new Error("A different recovery already exists");
        if (raw !== null && previous === null) this.storage.setItem(recoveryKey, raw);
        this.writable = true;
        this.notice = "联系人数据读取失败，已保留原文备份。官方预设仍可使用。";
      } catch { this.notice = "联系人原数据尚未安全备份，已阻止覆盖。请重试。"; }
      return false;
    }
  }

  create(draft: ContactDraft): { contact?: ChatContact; errors?: ContactErrors } {
    return this.save(draft);
  }

  update(id: string, draft: ContactDraft): { contact?: ChatContact; errors?: ContactErrors } {
    if (officialContacts.some((contact) => contact.id === id)) return { errors: { form: "官方人物使用固定设定，不能修改提示词或资料，仅用于单人陪伴聊天和学习。" } };
    return this.save(draft, id);
  }

  remove(id: string): boolean {
    if (officialContacts.some((contact) => contact.id === id)) {
      this.notice = "官方人物不能删除。";
      return false;
    }
    // Deletion requires a valid current source, even if corrupt data was backed up.
    if (!this.reload()) return false;
    if (this.removed.includes(id)) return true;
    if (!this.current.some((contact) => contact.id === id)) {
      this.notice = "这位联系人已不存在，请重新选择。";
      return false;
    }
    const contacts = this.current.filter((contact) => contact.id !== id);
    const deletedIds = [...this.removed, id];
    try {
      const serialized = JSON.stringify({ version: 1, contacts, deletedIds });
      if (serialized.length > MAX_CONTACTS_STORAGE_LENGTH) throw new Error("Contacts exceed storage limit");
      this.storage.setItem(CONTACTS_STORAGE_KEY, serialized);
      this.current = contacts;
      this.removed = deletedIds;
      this.available = true;
      this.notice = "";
      return true;
    } catch {
      // Failed deletion is never queued for an unrelated later save or retry.
      this.available = false;
      this.notice = "联系人未能删除，原记录已保留，请重试。";
      return false;
    }
  }

  private save(draft: ContactDraft, id?: string): { contact?: ChatContact; errors?: ContactErrors } {
    const name = draft.name.trim();
    const description = draft.description.trim();
    const errors: ContactErrors = {};
    if (!name) errors.name = "请输入联系人名称。";
    else if (name.length > 60) errors.name = "名称最多 60 个字符。";
    if (description.length > 1000) errors.description = "简介最多 1000 个字符。";
    if (draft.prompt !== undefined && (typeof draft.prompt !== "string" || draft.prompt.length > 4000)) errors.prompt = "提示词最多 4000 个字符。";
    if (draft.tags !== undefined && draft.tags.length > 100) errors.tags = "标签最多 100 个字符。";
    if (draft.language !== undefined && !isLanguage(draft.language)) errors.language = "请选择支持的回复语言。";
    if (draft.avatarColor !== undefined && !isAvatarColor(draft.avatarColor)) errors.avatarColor = "请选择支持的头像颜色。";
    if (draft.appearanceId !== undefined && !isAppearanceId(draft.appearanceId)) errors.appearanceId = "请选择已有的人物外观。";
    if (draft.avatarDataUrl !== undefined && !isContactAvatarDataUrl(draft.avatarDataUrl)) errors.avatarDataUrl = "头像无效或过大，请重新导入 PNG、JPEG 或 WebP 图片。";
    if (Object.keys(errors).length) return { errors };
    // Merge against the latest saved list, including other-window additions.
    this.reload();
    if (!this.writable) return { errors: { form: this.notice } };
    if (id && !this.current.some((contact) => contact.id === id)) return { errors: { form: "这位联系人已不存在，请重新选择。" } };
    if (this.contacts.some((contact) => contact.id !== id && normalizeName(contact.name) === normalizeName(name))) return { errors: { name: "已存在同名联系人，请换一个名称。" } };
    if (!id && this.current.length >= 100) return { errors: { form: "最多保存 100 位自建联系人。" } };
    const previous = id ? this.current.find((contact) => contact.id === id) : undefined;
    const prompt = draft.prompt === undefined ? previous?.prompt ?? "" : draft.prompt.trim();
    const contact: CustomContact = {
      ...previous,
      id: id ?? `contact-${crypto.randomUUID()}`, name, description, kind: "custom",
      ...(prompt ? { prompt } : {}),
      ...(draft.tags !== undefined ? { tags: draft.tags.trim() } : {}),
      ...(draft.language !== undefined ? { language: draft.language } : {}),
      ...(draft.avatarColor !== undefined ? { avatarColor: draft.avatarColor } : {}),
      ...(draft.appearanceId !== undefined ? { appearanceId: draft.appearanceId } : {}),
      ...(draft.avatarDataUrl !== undefined ? { avatarDataUrl: draft.avatarDataUrl } : {}),
    };
    if (!prompt) delete contact.prompt;
    // Omitted appearance keeps older callers compatible; an explicit clear
    // removes the stored character so saving a letter avatar cannot revert it.
    if (Object.hasOwn(draft, "appearanceId") && draft.appearanceId === undefined) delete contact.appearanceId;
    if (Object.hasOwn(draft, "avatarDataUrl") && draft.avatarDataUrl === undefined) delete contact.avatarDataUrl;
    const contacts = id ? this.current.map((current) => current.id === id ? contact : current) : [...this.current, contact];
    const serialized = JSON.stringify({ version: 1, contacts, deletedIds: this.removed });
    if (serialized.length > MAX_CONTACTS_STORAGE_LENGTH) {
      this.notice = "联系人头像占用空间过多，请移除部分头像后重试。";
      return { errors: { form: this.notice } };
    }
    try {
      this.storage.setItem(CONTACTS_STORAGE_KEY, serialized);
      this.current = contacts;
      this.available = true;
      this.notice = "";
      return { contact: structuredClone(presentCustomContact(contact)) };
    } catch {
      this.available = false;
      this.notice = "联系人未能保存，请保留草稿并重试。";
      return { errors: { form: this.notice } };
    }
  }
}
