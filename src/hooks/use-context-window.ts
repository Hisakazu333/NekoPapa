import { configuredContextWindow } from "@/app/models/chat-model-profile";
import type { ThreadUsage } from "@/app/usage/thread-usage";
import { useConfiguration } from "./use-configuration";

export interface ContextWindowReading {
  /** Tokens the latest reply's request used, as the service reported. */
  used?: number;
  window?: number;
  ratio?: number;
  /** "reply": saved with the reply when it was sent; "settings": the model's window as configured now. */
  source?: "reply" | "settings";
}

/**
 * How full the context window is: the latest reported request against the
 * window saved with that reply, else the window 设置 → 模型与 API now has for
 * the same model id. Nothing is estimated; without either there is no ratio.
 */
export function useContextWindow(usage: ThreadUsage): ContextWindowReading {
  const { data } = useConfiguration();
  const latest = usage.latest;
  if (!latest) return {};
  const used = latest.usage.totalTokens;
  const saved = latest.contextWindow;
  const window = saved ?? configuredContextWindow(data.collections.models, latest.model);
  if (!window) return { used };
  return { used, window, ratio: used / window, source: saved ? "reply" : "settings" };
}
