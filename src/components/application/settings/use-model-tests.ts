import { useState } from "react";
import { chatModelProfile } from "@/app/chat-model-profile";
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
