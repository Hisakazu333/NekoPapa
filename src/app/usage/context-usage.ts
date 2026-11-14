import { readChatUsage, readContextWindow } from "./chat-usage";

/**
 * How full the model's context window is, as the provider reported it. A
 * reply with tools makes several model calls and its `usage` is their sum,
 * so the window's fill is the last call alone: what it sent plus what it
 * wrote, which is roughly what the next call starts from. The chat route
 * writes it after every step as `metadata.context` (deep-merged), so the
 * meter moves while a run goes and drops after the context is compressed.
 *
 * `window` is the one the request worked against: the model's configured
 * window, or, when none is filled in, the default the compressor assumes
 * (`estimated`), so the meter and the compressor never disagree.
 */
export interface ReplyContext {
  tokens: number;
  /** That call's split, when reported: what it sent, wrote, and of that thought. */
  input?: number;
  output?: number;
  reasoning?: number;
  window?: number;
  /** The window is the compressor's default, not one the user filled in. */
  estimated?: boolean;
}

const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;

type StepUsage = { inputTokens?: unknown; outputTokens?: unknown; outputTokenDetails?: { reasoningTokens?: unknown }; reasoningTokens?: unknown };

/** One model call's reported usage as the window's fill, or undefined when the provider reported none. */
export function stepContext(usage: StepUsage | undefined): Omit<ReplyContext, "window" | "estimated"> | undefined {
  const input = count(usage?.inputTokens);
  const output = count(usage?.outputTokens);
  if (input === undefined && output === undefined) return undefined;
  const reasoning = count(usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens);
  return {
    tokens: (input ?? 0) + (output ?? 0),
    ...(input !== undefined ? { input } : {}),
    ...(output !== undefined ? { output } : {}),
    ...(reasoning && output !== undefined && reasoning <= output ? { reasoning } : {}),
  };
}

/** The metadata patch written after each step. */
export function contextPatch(usage: StepUsage | undefined, window: number, estimated: boolean) {
  const step = stepContext(usage);
  return step ? { context: { ...step, window, ...(estimated ? { estimated: true } : {}) } } : undefined;
}

export function readReplyContext(metadata: unknown): ReplyContext | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as { context?: unknown }).context;
  if (!value || typeof value !== "object") return undefined;
  const { tokens, window, estimated } = value as Record<string, unknown>;
  const used = count(tokens);
  if (used === undefined) return undefined;
  const limit = readContextWindow(window);
  const split = stepContext({ inputTokens: (value as Record<string, unknown>).input, outputTokens: (value as Record<string, unknown>).output, reasoningTokens: (value as Record<string, unknown>).reasoning });
  const parts = split && split.tokens === used ? { ...split, tokens: used } : { tokens: used };
  return { ...parts, ...(limit ? { window: limit } : {}), ...(limit && estimated === true ? { estimated: true } : {}) };
}

/** Replies saved before `context` existed: the last step the 轨迹 recorder kept, by start time. */
function lastTraceStep(metadata: unknown): ReplyContext | undefined {
  const steps = metadata && typeof metadata === "object" ? (metadata as { trace?: { steps?: unknown } }).trace?.steps : undefined;
  if (!steps || typeof steps !== "object") return undefined;
  let latest: { startedAt: number; context: ReplyContext } | undefined;
  for (const step of Object.values(steps as Record<string, Record<string, unknown>>)) {
    const startedAt = count(step?.startedAt);
    const context = stepContext(step);
    if (startedAt !== undefined && context && (!latest || startedAt >= latest.startedAt)) latest = { startedAt, context };
  }
  return latest?.context;
}

/**
 * The context reading of the latest reply that has one: its `context`; for
 * older replies the last recorded step; for replies without steps (a plain
 * chat is one call) the reply's own usage.
 */
export function latestReplyContext(messages: readonly { role: string; metadata?: unknown }[]): ReplyContext | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const saved = readReplyContext(message.metadata);
    if (saved) return saved;
    const usage = readChatUsage(message.metadata);
    const step = lastTraceStep(message.metadata) ?? (usage ? { ...stepContext(usage.usage), tokens: usage.usage.totalTokens } : undefined);
    if (step) return { ...step, ...(usage?.contextWindow ? { window: usage.contextWindow } : {}) };
  }
  return undefined;
}
