import { keychainId, missingKeyReason, readChatModelProfile, type ChatModelProfile } from "../../models/chat-model-profile";
import type { ChatRuntime } from "./runtime";

/** What 测试连接 reports: reached or not, why, and whether the model is listed. */
export interface ModelTestResult {
  ok: boolean;
  message: string;
  /** Present when the server listed its models. */
  listed?: boolean;
}

/** What 获取模型列表 reports: the server's own model ids, sorted. */
export interface ModelListResult {
  ok: boolean;
  message: string;
  models: string[];
}

const TIMEOUT_MS = 10000;
const MAX_MODELS = 1000;

function modelIds(data: unknown): string[] {
  const list = data && typeof data === "object" ? (data as { data?: unknown; models?: unknown }).data ?? (data as { models?: unknown }).models : undefined;
  if (!Array.isArray(list)) return [];
  return list.map((entry) => entry && typeof entry === "object" ? String((entry as { id?: unknown; name?: unknown }).id ?? (entry as { name?: unknown }).name ?? "") : "").filter(Boolean);
}

type Fetched = { ok: true; ids: string[] } | { ok: false; message: string; listMissing?: boolean };

/**
 * GET {endpoint}/models, which OpenAI-compatible servers and Anthropic answer
 * without spending tokens. A 401 / 403 means the key is wrong; a 404 usually
 * means the server has no model list (or the address is off).
 */
async function fetchModels(profile: ChatModelProfile, runtime: ChatRuntime): Promise<Fetched> {
  const key = profile.credential ? runtime.credential(profile.credential) : undefined;
  if (profile.credential && !key) return { ok: false, message: missingKeyReason(profile.credential, Boolean(runtime.desktop)) };
  const headers: Record<string, string> = profile.provider === "anthropic"
    ? { "anthropic-version": "2023-06-01", ...(key ? { "x-api-key": key } : {}) }
    : key ? { Authorization: `Bearer ${key}` } : {};
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  try {
    const response = await (runtime.fetch ?? fetch)(`${profile.endpoint}/models`, { method: "GET", headers, signal: timeout.signal });
    if (response.status === 401 || response.status === 403) return { ok: false, message: `服务拒绝了凭据（HTTP ${response.status}），请检查${keychainId(profile.credential) ? "填写的 API Key" : ` ${profile.credential || "凭据环境变量"}`}。` };
    if (response.status === 404) return { ok: false, listMissing: true, message: "服务没有提供模型列表（HTTP 404）：可能是地址有误，或该服务不支持列出模型，请手动填写模型标识。" };
    if (!response.ok) return { ok: false, message: `服务返回 HTTP ${response.status}，请检查服务地址。` };
    return { ok: true, ids: modelIds(await response.json().catch(() => null)) };
  } catch {
    return { ok: false, message: timeout.signal.aborted ? "连接超时（10 秒），请检查服务地址和网络。" : "无法连接服务，请检查服务地址、网络或本地服务是否已启动。" };
  } finally {
    clearTimeout(timer);
  }
}

/** 测试连接: is the server reachable, is the key accepted, is the model listed. Nothing is generated. */
export async function checkModelProfile(profile: ChatModelProfile, runtime: ChatRuntime): Promise<ModelTestResult> {
  const fetched = await fetchModels(profile, runtime);
  if (!fetched.ok) return { ok: false, message: fetched.message };
  const ids = fetched.ids;
  if (!ids.length) return { ok: true, message: "已连接服务；它没有返回模型列表，模型标识需在发送时确认。" };
  const listed = ids.includes(profile.model);
  return { ok: true, listed, message: listed ? `已连接，服务提供 ${profile.model}。` : `已连接，但服务的 ${ids.length} 个模型中没有 ${profile.model}，请检查模型标识。` };
}

/** 获取模型列表: the ids the server reports, for the form to pick from. */
export async function listModelProfile(profile: ChatModelProfile, runtime: ChatRuntime): Promise<ModelListResult> {
  const fetched = await fetchModels(profile, runtime);
  if (!fetched.ok) return { ok: false, message: fetched.message, models: [] };
  const models = [...new Set(fetched.ids)].sort((a, b) => a.localeCompare(b)).slice(0, MAX_MODELS);
  if (!models.length) return { ok: true, message: "已连接服务，但它没有返回模型列表，请手动填写模型标识。", models };
  const more = fetched.ids.length > MAX_MODELS ? `（只显示前 ${MAX_MODELS} 个）` : "";
  return { ok: true, message: `服务提供 ${models.length} 个模型${more}，可勾选要添加的模型。`, models };
}

/** POST /api/model-test with `{ profile }`, or `{ profile, list: true }` to list models before one is chosen. */
export async function testModelProfile(request: Request, runtime: ChatRuntime): Promise<Response> {
  const body = await request.json().catch(() => null) as { profile?: unknown; list?: unknown } | null;
  const list = body?.list === true;
  const profile = readChatModelProfile(body?.profile, { requireModel: !list });
  if (!profile) return Response.json({ error: "invalid_profile", message: "服务地址、接口类型或凭据环境变量名无效。" }, { status: 400 });
  return Response.json(list ? await listModelProfile(profile, runtime) : await checkModelProfile(profile, runtime));
}
