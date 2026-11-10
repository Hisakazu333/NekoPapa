import { OFFICIAL_COMPANION_UNAVAILABLE_REASON, type OfficialCompanionServiceStatus } from "../contacts/official-companion-service";

export interface ChatProviderProbe {
  status: "checking" | "ready" | "unconfigured";
  provider: string | null;
  label: string | null;
  model: string | null;
  officialCompanions: OfficialCompanionServiceStatus;
}

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;

/** General model configuration does not authorize an official character service. */
export function parseChatProviderProbe(value: unknown): ChatProviderProbe {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const official = data.officialCompanions && typeof data.officialCompanions === "object"
    ? data.officialCompanions as Record<string, unknown> : {};
  const configured = official.configured === true;
  return {
    status: data.configured === false ? "unconfigured" : "ready",
    provider: text(data.provider),
    label: text(data.providerLabel),
    model: text(data.model),
    officialCompanions: { configured, reason: configured ? null : text(official.reason) ?? OFFICIAL_COMPANION_UNAVAILABLE_REASON },
  };
}

export const CHAT_UNCONFIGURED_REASON = "还没有可用的模型：在 设置 → 模型与 API 添加模型配置，或为聊天服务设置 AI_API_KEY 环境变量。";

/** `usesProfile`: a saved 模型与 API profile answers, whether or not the runtime has its own key. */
export function chatContactAvailability(probe: ChatProviderProbe, contact?: { kind: "official" | "custom" }, usesProfile = false) {
  if (contact?.kind !== "official") {
    const ready = usesProfile || probe.status === "ready";
    return { ready, reason: ready ? undefined : probe.status === "checking" ? "正在检查聊天服务…" : CHAT_UNCONFIGURED_REASON };
  }
  return {
    ready: probe.officialCompanions.configured,
    reason: probe.officialCompanions.configured ? undefined : probe.status === "checking"
      ? "正在检查官方人物服务连接…" : probe.officialCompanions.reason ?? OFFICIAL_COMPANION_UNAVAILABLE_REASON,
  };
}
