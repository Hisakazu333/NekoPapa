import { readChatModelProfile, type ChatModelProfile } from "../../chat-model-profile";
import type { ChatRuntime } from "./runtime";

/** What 测试连接 reports: reached or not, why, and whether the model is listed. */
export interface ModelTestResult {
  ok: boolean;
  message: string;
  /** Present when the server listed its models. */
  listed?: boolean;
}

const TIMEOUT_MS = 10000;

function modelIds(data: unknown): string[] {
  const list = data && typeof data === "object" ? (data as { data?: unknown; models?: unknown }).data ?? (data as { models?: unknown }).models : undefined;
  if (!Array.isArray(list)) return [];
  return list.map((entry) => entry && typeof entry === "object" ? String((entry as { id?: unknown; name?: unknown }).id ?? (entry as { name?: unknown }).name ?? "") : "").filter(Boolean);
}

/**
 * Asks the server for its model list (GET {endpoint}/models), which every
 * OpenAI-compatible server and Anthropic answer without spending tokens. A
 * 401 / 403 means the key is wrong; a list without the model means the model
 * id is. Nothing is generated.
 */
export async function checkModelProfile(profile: ChatModelProfile, runtime: ChatRuntime): Promise<ModelTestResult> {
  const key = profile.credential ? runtime.credential(profile.credential) : undefined;
  if (profile.credential && !key) return { ok: false, message: `没有找到环境变量 ${profile.credential}，请在启动 NekoPapa 的环境中设置它。` };
  const headers: Record<string, string> = profile.provider === "anthropic"
    ? { "anthropic-version": "2023-06-01", ...(key ? { "x-api-key": key } : {}) }
    : key ? { Authorization: `Bearer ${key}` } : {};
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  try {
    const response = await (runtime.fetch ?? fetch)(`${profile.endpoint}/models`, { method: "GET", headers, signal: timeout.signal });
    if (response.status === 401 || response.status === 403) return { ok: false, message: `服务拒绝了凭据（HTTP ${response.status}），请检查 ${profile.credential || "凭据环境变量"}。` };
    if (!response.ok) return { ok: false, message: `服务返回 HTTP ${response.status}，请检查服务地址。` };
    const ids = modelIds(await response.json().catch(() => null));
    if (!ids.length) return { ok: true, message: "已连接服务；它没有返回模型列表，模型标识需在发送时确认。" };
    const listed = ids.includes(profile.model);
    return { ok: true, listed, message: listed ? `已连接，服务提供 ${profile.model}。` : `已连接，但服务的 ${ids.length} 个模型中没有 ${profile.model}，请检查模型标识。` };
  } catch {
    return { ok: false, message: timeout.signal.aborted ? "连接超时（10 秒），请检查服务地址和网络。" : "无法连接服务，请检查服务地址、网络或本地服务是否已启动。" };
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/model-test with `{ profile }`. */
export async function testModelProfile(request: Request, runtime: ChatRuntime): Promise<Response> {
  const body = await request.json().catch(() => null) as { profile?: unknown } | null;
  const profile = readChatModelProfile(body?.profile);
  if (!profile) return Response.json({ error: "invalid_profile", message: "Expected a valid model profile." }, { status: 400 });
  return Response.json(await checkModelProfile(profile, runtime));
}
