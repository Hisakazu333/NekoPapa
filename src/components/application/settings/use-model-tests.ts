import { useState } from "react";
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
  /** `credential`: an environment variable, `keychain:<id>`, or empty for servers that take no key. */
  const list = async (values: { provider: unknown; endpoint: unknown; credential: string }) => {
    const profile = { provider: String(values.provider || ""), endpoint: String(values.endpoint || "").trim(), model: "", credential: values.credential };
    if (!profile.endpoint) { setState({ pending: false, ok: false, message: "请先填写服务地址。", models: [] }); return; }
    if (profile.credential && !isCredentialName(profile.credential) && !keychainId(profile.credential)) {
      setState({ pending: false, ok: false, message: `凭据环境变量名“${profile.credential}”需要以 KEY、TOKEN 或 SECRET 结尾。`, models: [] });
      return;
    }
    setState({ pending: true, message: "正在获取模型列表…", models: [] });
    try {
      const response = await chatFetch("/api/model-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile, list: true }) });
      const data = await response.json().catch(() => null) as { ok?: unknown; message?: unknown; models?: unknown } | null;
      const models = Array.isArray(data?.models) ? data.models.filter((id): id is string => typeof id === "string") : [];
      setState({ pending: false, ok: response.ok && data?.ok === true, message: typeof data?.message === "string" ? data.message : `获取失败（HTTP ${response.status}）。`, models });
    } catch {
      setState({ pending: false, ok: false, message: "无法获取：聊天运行时没有响应。", models: [] });
    }
  };
  const fail = (message: string) => setState({ pending: false, ok: false, message, models: [] });
  return { state, list, fail, clear: () => setState(null) };
}
