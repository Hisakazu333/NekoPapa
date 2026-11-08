import { companionById, type CompanionId } from "../../../app/companion-model";
import { isContactAvatarDataUrl } from "../../../app/contact-avatar";

/** Serializable local contact identity. Requests strip imported picture data. */
export interface ChatContactMetadata {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  kind: "official" | "custom";
  avatar?: string;
  avatarDataUrl?: string;
  tags?: string;
  language?: "auto" | "zh-CN" | "en" | "ja";
  avatarColor?: "neutral" | "blue" | "lime" | "pink";
  appearanceId?: CompanionId;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function parseContact(value: unknown, local: boolean): ChatContactMetadata | undefined {
  if (!isObject(value) || (value.kind !== "official" && value.kind !== "custom") ||
    typeof value.id !== "string" || typeof value.name !== "string" ||
    value.name !== value.name.trim() || value.name.length < 1 || value.name.length > 60 ||
    typeof value.description !== "string" || value.description.length > 1000 ||
    (value.prompt !== undefined && (value.kind !== "custom" || typeof value.prompt !== "string" || value.prompt.length > 4000)) ||
    (value.tags !== undefined && (typeof value.tags !== "string" || value.tags.length > 100)) ||
    (value.language !== undefined && !["auto", "zh-CN", "en", "ja"].includes(value.language as string)) ||
    (value.avatarColor !== undefined && !["neutral", "blue", "lime", "pink"].includes(value.avatarColor as string)) ||
    (value.appearanceId !== undefined && (typeof value.appearanceId !== "string" || !companionById(value.appearanceId))) ||
    (value.avatarDataUrl !== undefined && (!local || value.kind !== "custom" || !isContactAvatarDataUrl(value.avatarDataUrl))) ||
    Object.keys(value).some((key) => !["id", "name", "description", "prompt", "kind", "avatar", "tags", "language", "avatarColor", "appearanceId", ...(local ? ["avatarDataUrl"] : [])].includes(key))) return undefined;
  if (value.kind === "custom"
    ? !/^contact-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
    : !/^[a-z][a-z0-9-]{0,59}$/.test(value.id)) return undefined;
  // Imported pictures belong to local storage; requests only accept catalog paths.
  if (value.avatar !== undefined && (typeof value.avatar !== "string" ||
    (!/^\/characters\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(value.avatar) &&
      !(local && value.avatarDataUrl !== undefined && value.avatar === value.avatarDataUrl)))) return undefined;
  const appearanceId = value.appearanceId as CompanionId | undefined;
  const avatarDataUrl = value.avatarDataUrl as string | undefined;
  const avatar = value.kind === "custom" ? avatarDataUrl ?? companionById(appearanceId)?.avatar : value.avatar;
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    kind: value.kind,
    ...(value.prompt === undefined ? {} : { prompt: value.prompt as string }),
    ...(avatar === undefined ? {} : { avatar: avatar as string }),
    ...(avatarDataUrl === undefined ? {} : { avatarDataUrl }),
    ...(value.tags === undefined ? {} : { tags: value.tags as string }),
    ...(value.language === undefined ? {} : { language: value.language as ChatContactMetadata["language"] }),
    ...(value.avatarColor === undefined ? {} : { avatarColor: value.avatarColor as ChatContactMetadata["avatarColor"] }),
    ...(appearanceId === undefined ? {} : { appearanceId }),
  };
}

/** Requests retain the strict metadata contract and reject imported picture bytes. */
export function parseChatContact(value: unknown): ChatContactMetadata | undefined {
  return parseContact(value, false);
}

/** Histories and groups may retain validated local pictures for the same contact ID. */
export function parseStoredChatContact(value: unknown): ChatContactMetadata | undefined {
  return parseContact(value, true);
}

/** Send identity and behavior only; a locally imported picture never leaves in a chat request. */
export function toChatContactRequest(contact: ChatContactMetadata): Omit<ChatContactMetadata, "avatarDataUrl"> {
  const { avatarDataUrl: _localPicture, avatar: suppliedAvatar, ...identity } = contact;
  const avatar = contact.kind === "custom" ? companionById(contact.appearanceId)?.avatar : suppliedAvatar;
  const localAsset = avatar && /^\/characters\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(avatar);
  return { ...identity, ...(localAsset ? { avatar } : {}) };
}
