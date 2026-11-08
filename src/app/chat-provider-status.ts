import { OFFICIAL_COMPANION_UNAVAILABLE_REASON, type OfficialCompanionServiceStatus } from "./official-companion-service";

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

export function chatContactAvailability(probe: ChatProviderProbe, contact?: { kind: "official" | "custom" }) {
  if (contact?.kind !== "official") return { ready: probe.status === "ready", reason: undefined };
  return {
    ready: probe.officialCompanions.configured,
    reason: probe.officialCompanions.configured ? undefined : probe.status === "checking"
      ? "正在检查官方人物服务连接…" : probe.officialCompanions.reason ?? OFFICIAL_COMPANION_UNAVAILABLE_REASON,
  };
}
