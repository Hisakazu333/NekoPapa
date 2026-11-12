/**
 * Timing for the 轨迹 view, recorded while a reply streams and saved with
 * the reply as `metadata.trace`: when each model step started and finished
 * (with its token counts), and when each tool call was made and answered.
 *
 * Message metadata from the stream is deep-merged into the reply (arrays
 * would be replaced), so steps and tools are objects keyed by id. A reply
 * that continues after an approval is a second request into the same
 * message; its step keys carry that request's start time so they never
 * collide with the first request's.
 */

export interface TraceStep {
  startedAt: number;
  finishedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
}
export interface TraceTool {
  /** The step whose model output asked for this call. */
  step: string;
  calledAt: number;
  finishedAt?: number;
  outcome?: "done" | "error" | "denied";
}
export interface ReplyTrace { steps: Record<string, TraceStep>; tools: Record<string, TraceTool> }

/** The stream parts the recorder reads (a subset of streamText's full stream). */
type Part = { type: string; toolCallId?: unknown; usage?: unknown; finishReason?: unknown };

const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

/**
 * Returns a function for `toUIMessageStream`'s `messageMetadata`: given each
 * stream part, the `{ trace }` patch to merge into the reply, or undefined.
 */
export function createTraceRecorder(now: () => number = Date.now) {
  const request = now().toString(36);
  let index = -1;
  let step = "";
  return (part: Part): { trace: Partial<ReplyTrace> } | undefined => {
    const time = now();
    const callId = typeof part.toolCallId === "string" && part.toolCallId.length <= 200 ? part.toolCallId : undefined;
    switch (part.type) {
      case "start-step":
        index += 1;
        step = `${request}-${index}`;
        return { trace: { steps: { [step]: { startedAt: time } } } };
      case "finish-step": {
        if (!step) return undefined;
        const usage = (part.usage ?? {}) as { inputTokens?: unknown; outputTokens?: unknown };
        const input = count(usage.inputTokens);
        const output = count(usage.outputTokens);
        return { trace: { steps: { [step]: {
          finishedAt: time,
          ...(input !== undefined ? { inputTokens: input } : {}),
          ...(output !== undefined ? { outputTokens: output } : {}),
          ...(typeof part.finishReason === "string" ? { finishReason: part.finishReason } : {}),
        } as TraceStep } } };
      }
      case "tool-call":
        return callId && step ? { trace: { tools: { [callId]: { step, calledAt: time } } } } : undefined;
      case "tool-result":
      case "tool-error":
      case "tool-output-denied":
        return callId ? { trace: { tools: { [callId]: {
          finishedAt: time, outcome: part.type === "tool-result" ? "done" : part.type === "tool-error" ? "error" : "denied",
        } as TraceTool } } } : undefined;
      default:
        return undefined;
    }
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const time = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

/** A reply's saved trace, keeping only well-formed entries; undefined for replies recorded before tracing. */
export function readReplyTrace(metadata: unknown): ReplyTrace | undefined {
  const raw = isObject(metadata) && isObject(metadata.trace) ? metadata.trace : undefined;
  if (!raw) return undefined;
  const steps: Record<string, TraceStep> = {};
  const tools: Record<string, TraceTool> = {};
  for (const [key, value] of Object.entries(isObject(raw.steps) ? raw.steps : {})) {
    const startedAt = isObject(value) ? time(value.startedAt) : undefined;
    if (!isObject(value) || startedAt === undefined) continue;
    const finishedAt = time(value.finishedAt);
    steps[key] = {
      startedAt,
      ...(finishedAt !== undefined && finishedAt >= startedAt ? { finishedAt } : {}),
      ...(count(value.inputTokens) !== undefined ? { inputTokens: count(value.inputTokens) } : {}),
      ...(count(value.outputTokens) !== undefined ? { outputTokens: count(value.outputTokens) } : {}),
      ...(typeof value.finishReason === "string" ? { finishReason: value.finishReason } : {}),
    };
  }
  for (const [key, value] of Object.entries(isObject(raw.tools) ? raw.tools : {})) {
    const calledAt = isObject(value) ? time(value.calledAt) : undefined;
    if (!isObject(value) || calledAt === undefined || typeof value.step !== "string") continue;
    const finishedAt = time(value.finishedAt);
    const outcome = value.outcome === "done" || value.outcome === "error" || value.outcome === "denied" ? value.outcome : undefined;
    tools[key] = { step: value.step, calledAt, ...(finishedAt !== undefined && finishedAt >= calledAt ? { finishedAt } : {}), ...(outcome ? { outcome } : {}) };
  }
  return { steps, tools };
}
