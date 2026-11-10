import { useRef, useState } from "react";
import { chatModelProfile, isCredentialName, keychainId } from "@/app/chat-model-profile";
import type { ConfigurationRecord } from "@/app/configuration-types";
import { chatFetch } from "@/app/desktop-chat-runtime";

export interface ModelTestState { pending: boolean; ok?: boolean; message: string }

/**
 * 设置 → 模型与 API → 测试连接: asks the saved profile's server for its model
 * list through the chat runtime (POST /api/model-test), so the key is read
 * where chat reads it. Results stay for this settings visit only.
 */
export function useModelTests() {
  const [results, setResults] = useState<Record<string, ModelTestState>>({});
  const set = (id: string, state: ModelTestState) => setResults((all) => ({ ...all, [id]: state }));
  const test = async (record: ConfigurationRecord) => {
    const { profile, reason } = chatModelProfile(record);
    if (!profile) { set(record.id, { pending: false, ok: false, message: reason }); return; }
    set(record.id, { pending: true, message: "正在测试连接…" });
    try {
      const response = await chatFetch("/api/model-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile }) });
      const data = await response.json().catch(() => null) as { ok?: unknown; message?: unknown } | null;
      const message = typeof data?.message === "string" ? data.message : `测试失败（HTTP ${response.status}）。`;
      set(record.id, { pending: false, ok: response.ok && data?.ok === true, message });
    } catch {
      set(record.id, { pending: false, ok: false, message: "无法完成测试：聊天运行时没有响应。" });
    }
  };
  return { results, test };
}

export interface ModelListState { pending: boolean; ok?: boolean; message: string; models: string[] }

/**
 * 获取模型列表 in the model form: asks the server for its model ids (POST
 * /api/model-test with `list: true`) before a model is chosen, so the form
 * offers real ids instead of a hand-made catalog.
 */
export function useModelList() {
  const [state, setState] = useState<ModelListState | null>(null);
  const request = useRef(0);
  const list = async (values: { provider: unknown; endpoint: unknown }, getCredential: () => Promise<string>) => {
    const current = ++request.current;
    const set = (next: ModelListState) => { if (current === request.current) setState(next); };
    const fail = (message: string) => set({ pending: false, ok: false, message, models: [] });
    const endpoint = String(values.endpoint || "").trim();
    if (!endpoint) { fail("请先填写服务地址。"); return; }
    set({ pending: true, message: "正在连接服务并获取模型…", models: [] });
    let credential: string;
    try { credential = await getCredential(); }
    catch (error) { fail(error instanceof Error ? error.message : "无法读取密钥配置。"); return; }
    if (current !== request.current) return;
    if (credential && !isCredentialName(credential) && !keychainId(credential)) {
      fail("请填写以 KEY、TOKEN 或 SECRET 结尾的环境变量名，例如 MODEL_API_KEY。");
      return;
    }
    const profile = { provider: String(values.provider || ""), endpoint, model: "", credential };
    try {
      const response = await chatFetch("/api/model-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile, list: true }) });
      const data = await response.json().catch(() => null) as { ok?: unknown; message?: unknown; models?: unknown } | null;
      const models = Array.isArray(data?.models) ? data.models.filter((id): id is string => typeof id === "string") : [];
      set({ pending: false, ok: response.ok && data?.ok === true, message: typeof data?.message === "string" ? data.message : `获取失败（HTTP ${response.status}）。`, models });
    } catch {
      fail("无法获取：聊天运行时没有响应。");
    }
  };
  return { state, list, clear: () => { request.current += 1; setState(null); } };
}
