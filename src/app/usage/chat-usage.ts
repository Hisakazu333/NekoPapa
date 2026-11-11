/**
 * Token usage a model reported for one reply. The chat route attaches it to
 * the assistant message's metadata when the reply finishes, and it is saved
 * with the chat history on this device. Only counts the provider returned are
 * kept; nothing is estimated.
 */
/** `reasoningTokens` is the part of `outputTokens` the model spent thinking, when reported. */
export interface ChatUsage { inputTokens?: number; outputTokens?: number; reasoningTokens?: number; totalTokens: number }
export interface ChatReplyMetadata { usage: ChatUsage; model?: string; provider?: string; contextWindow?: number }

/** The SDK's usage (thinking under `outputTokenDetails`) or one read back from storage (flat). */
interface ReportedUsage {
  inputTokens?: unknown; outputTokens?: unknown; totalTokens?: unknown; reasoningTokens?: unknown;
  outputTokenDetails?: { reasoningTokens?: unknown };
}

function tokens(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function label(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
}

export function readContextWindow(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 10_000_000 ? value : undefined;
}

/** Builds reply metadata, or nothing when the provider reported no token counts. */
export function chatReplyMetadata(usage: ReportedUsage | undefined, source: { model?: unknown; provider?: unknown; contextWindow?: unknown } = {}): ChatReplyMetadata | undefined {
  const inputTokens = tokens(usage?.inputTokens);
  const outputTokens = tokens(usage?.outputTokens);
  const reportedTotal = tokens(usage?.totalTokens);
  const reasoning = tokens(usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens);
  // Thinking is a share of the output; a count that does not fit is dropped.
  const reasoningTokens = reasoning && outputTokens !== undefined && reasoning <= outputTokens ? reasoning : undefined;
  const totalTokens = reportedTotal ?? (inputTokens !== undefined || outputTokens !== undefined ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined);
  if (totalTokens === undefined) return undefined;
  const model = label(source.model);
  const provider = label(source.provider);
  const contextWindow = readContextWindow(source.contextWindow);
  return {
    usage: {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
      totalTokens,
    },
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
    ...(contextWindow ? { contextWindow } : {}),
  };
}

/** Reads usage back from stored message metadata; anything malformed is ignored. */
export function readChatUsage(metadata: unknown): ChatReplyMetadata | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const { usage, model, provider, contextWindow } = metadata as Record<string, unknown>;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  return chatReplyMetadata(usage as ReportedUsage, { model, provider, contextWindow });
}
