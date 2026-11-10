import type { ConfigurationRecord } from "./configuration-types";
import { readContextWindow } from "./chat-usage";

/**
 * A saved 设置 → 模型与 API record as the chat runtime uses it. The record
 * never holds the key: it names an environment variable, or the key was typed
 * in settings and stored in the system keychain by the desktop app
 * (`keychain:<record id>`). The runtime (the dev server, or the desktop host)
 * reads the value, so the key never passes through the request body or storage.
 */
export interface ChatModelProfile {
  provider: "compatible" | "anthropic" | "custom";
  endpoint: string;
  model: string;
  /** Environment variable holding the key, `keychain:<id>` for a key stored by the desktop app, or empty for servers that take none (Ollama, LM Studio). */
  credential: string;
  contextWindow?: number;
}

/** Where a record's key comes from (设置 → 模型与 API → 密钥来源). */
export type KeySource = "keychain" | "environment" | "none";
const KEYCHAIN = "keychain:";
const KEYCHAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const keychainRef = (id: string) => `${KEYCHAIN}${id}`;
/** The record id a `keychain:<id>` reference names, if it is one. */
export function keychainId(credential: string): string | undefined {
  if (!credential.startsWith(KEYCHAIN)) return undefined;
  const id = credential.slice(KEYCHAIN.length);
  return KEYCHAIN_ID.test(id) ? id : undefined;
}
export function keySourceOf(record: Pick<ConfigurationRecord, "values">): KeySource {
  const source = record.values.keySource;
  return source === "keychain" || source === "none" ? source : "environment";
}

const PROVIDERS = new Set(["compatible", "anthropic", "custom"]);
/** A credential variable must look like one, so a profile cannot ask for PATH or HOME. */
const CREDENTIAL = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
const CREDENTIAL_SUFFIX = /(KEY|TOKEN|SECRET)$/i;

export function isCredentialName(name: string): boolean {
  return CREDENTIAL.test(name) && CREDENTIAL_SUFFIX.test(name);
}

const text = (value: unknown, limit: number) => typeof value === "string" && value.trim().length <= limit ? value.trim() : "";

function webEndpoint(value: string): string | undefined {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) return undefined;
    return url.href.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Validates a profile from a request body; anything malformed is refused,
 * never patched. Listing a server's models (`requireModel: false`) happens
 * before a model is chosen.
 */
export function readChatModelProfile(value: unknown, { requireModel = true } = {}): ChatModelProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  const provider = text(data.provider, 20);
  const endpoint = webEndpoint(text(data.endpoint, 500));
  const model = text(data.model, 160);
  const credential = text(data.credential, 80);
  const contextWindow = readContextWindow(data.contextWindow);
  if (!PROVIDERS.has(provider) || !endpoint || (requireModel && !model) || (credential && !isCredentialName(credential) && !keychainId(credential))) return undefined;
  return { provider: provider as ChatModelProfile["provider"], endpoint, model, credential, ...(contextWindow ? { contextWindow } : {}) };
}

/** The request form of a saved record, or the reason it cannot be used yet. */
export function chatModelProfile(record: ConfigurationRecord): { profile: ChatModelProfile; reason?: undefined } | { profile?: undefined; reason: string } {
  const source = keySourceOf(record);
  const variable = String(record.values.environment || "").trim();
  if (source === "environment" && variable && !isCredentialName(variable)) {
    return { reason: "请在设置里填写以 KEY、TOKEN 或 SECRET 结尾的环境变量名，例如 MODEL_API_KEY。" };
  }
  const credential = source === "keychain" ? keychainRef(record.id) : source === "none" ? "" : variable;
  const profile = readChatModelProfile({ provider: record.values.provider, endpoint: record.values.endpoint, model: record.values.model, credential, contextWindow: record.values.contextWindow });
  return profile ? { profile } : { reason: "这份模型配置的服务地址或模型标识无效，请在 设置 → 模型与 API 中修改。" };
}

/** Why a profile's key could not be read, in words the settings page can act on. */
export function missingKeyReason(credential: string, desktop: boolean): string {
  if (keychainId(credential)) {
    return desktop
      ? "钥匙串中没有这份配置的 API Key，请在 设置 → 模型与 API 中编辑它并重新填写。"
      : "这份配置的 API Key 保存在桌面应用的钥匙串中，浏览器预览读不到；请在桌面应用中使用，或把密钥来源改为环境变量。";
  }
  return desktop
    ? `没有找到环境变量 ${credential}。把密钥来源改为“API Key”直接填写，或从已设置该变量的终端重新启动 NekoPapa。`
    : `浏览器预览的开发服务器没有读到 ${credential}。在启动开发服务器的终端运行 export ${credential}=你的密钥，再重启开发服务器。直接粘贴 API Key 请使用桌面应用。`;
}
