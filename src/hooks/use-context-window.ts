import { configuredContextWindow } from "@/app/models/chat-model-profile";
import type { ThreadUsage } from "@/app/usage/thread-usage";
import { useConfiguration } from "./use-configuration";

export interface ContextWindowReading {
  /** Tokens the latest reply's last model call sent and wrote, as the service reported. */
  used?: number;
  window?: number;
  ratio?: number;
  /**
   * "reply": the window that reply's request worked against; "default": no
   * window was filled in and the compressor assumed its default, so the share
   * is an estimate; "settings": an older reply, measured against the window
   * 设置 → 模型与 API now has for the same model id.
   */
  source?: "reply" | "default" | "settings";
}

/**
 * How full the context window is (context-usage.ts): the latest reply's last
 * model call against the window its request used. Older replies saved no
 * window of their own and fall back to the configured one.
 */
export function useContextWindow(usage: ThreadUsage): ContextWindowReading {
  const { data } = useConfiguration();
  const context = usage.context;
  if (!context) return {};
  const used = context.tokens;
  const window = context.window ?? (usage.latest ? configuredContextWindow(data.collections.models, usage.latest.model) : undefined);
  if (!window) return { used };
  const source = context.window ? context.estimated ? "default" : "reply" : "settings";
  return { used, window, ratio: used / window, source };
}
