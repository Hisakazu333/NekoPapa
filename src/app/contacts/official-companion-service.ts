/** Shared readiness contract; official persona prompts are owned by the Java service. */
export interface OfficialCompanionServiceStatus {
  configured: boolean;
  reason: string | null;
}

export const OFFICIAL_COMPANION_UNAVAILABLE_REASON = "官方人物服务尚未连接，暂时无法发送消息。";
