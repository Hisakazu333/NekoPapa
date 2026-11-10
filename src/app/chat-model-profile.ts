import type { ConfigurationRecord } from "./configuration-types";

/**
 * A saved 设置 → 模型与 API record as the chat runtime uses it. The record
 * keeps only the name of the environment variable that holds the key; the
 * runtime (the dev server, or the desktop host) reads its value, so the key
 * itself never passes through the page, the request body or storage.
 */
export interface ChatModelProfile {
  provider: "compatible" | "anthropic" | "custom";
  endpoint: string;
  model: string;
  /** Environment variable holding the key; empty for servers that take none (Ollama, LM Studio). */
  credential: string;
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

/** Validates a profile from a request body; anything malformed is refused, never patched. */
export function readChatModelProfile(value: unknown): ChatModelProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  const provider = text(data.provider, 20);
  const endpoint = webEndpoint(text(data.endpoint, 500));
  const model = text(data.model, 160);
  const credential = text(data.credential, 80);
  if (!PROVIDERS.has(provider) || !endpoint || !model || (credential && !isCredentialName(credential))) return undefined;
  return { provider: provider as ChatModelProfile["provider"], endpoint, model, credential };
}

/** The request form of a saved record, or the reason it cannot be used yet. */
export function chatModelProfile(record: ConfigurationRecord): { profile: ChatModelProfile; reason?: undefined } | { profile?: undefined; reason: string } {
  const credential = String(record.values.environment || "").trim();
  if (credential && !isCredentialName(credential)) {
    return { reason: `凭据环境变量名“${credential}”需要以 KEY、TOKEN 或 SECRET 结尾，请在 设置 → 模型与 API 中修改。` };
  }
  const profile = readChatModelProfile({ provider: record.values.provider, endpoint: record.values.endpoint, model: record.values.model, credential });
  return profile ? { profile } : { reason: "这份模型配置的服务地址或模型标识无效，请在 设置 → 模型与 API 中修改。" };
}
