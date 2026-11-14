import type { LanguageModel, ModelMessage } from "ai";
import { estimateTokens, pruneToolTraffic, textTokens } from "./context-budget";
import { COMPACT_AT, PRUNE_AT, summarize } from "./context-compaction";
import { stepContext } from "../usage/context-usage";

/**
 * Keeping one long tool run inside the window. Before each model call
 * (`prepareStep`): old tool traffic is trimmed past PRUNE_AT; if the run is
 * still past COMPACT_AT — by the estimate, or by what the previous call
 * reported — everything before the last few steps is summarized by the same
 * model and replaced with one user message holding the summary and the
 * user's latest words verbatim. The SDK carries the returned messages into
 * the following steps. A summary that fails leaves the trimmed messages.
 */
export interface RunCompaction {
  /** The step the summary was made before (1-based, as the transcript counts). */
  step: number;
  summary: string;
  /** How many model messages it replaced. */
  messages: number;
}

/** Steps kept whole after a summary; fewer when they alone are too large. */
const KEEP_STEPS = 3;
const MAX_REQUEST = 8000;

const NOTE = "The earlier part of this task was summarized to fit the context window. Continue from the summary and the steps that follow; read files or rerun commands again if you need details it leaves out.";

/** Where the last `steps` model turns start: the index of their first assistant message, or -1. */
export function keptStart(messages: ModelMessage[], steps: number): number {
  let seen = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant" && ++seen === steps) return index;
  }
  return -1;
}

function text(message: ModelMessage): string {
  if (typeof message.content === "string") return message.content;
  return (message.content as { type: string; text?: string }[]).filter((part) => part.type === "text" && part.text).map((part) => part.text).join("\n");
}

export function createRunCompactor({ model, window, system, abortSignal, onCompact }: {
  model: LanguageModel;
  window: number;
  /** The system prompt, counted against the window. */
  system: string;
  abortSignal?: AbortSignal;
  onCompact?: (compaction: RunCompaction) => void;
}) {
  const base = textTokens(system);
  // The user's words before a summary replaced them, for the next summary.
  let request = "";

  return async function prepare({ messages, steps }: {
    messages: ModelMessage[];
    steps: readonly { usage?: { inputTokens?: unknown; outputTokens?: unknown } }[];
  }): Promise<ModelMessage[]> {
    const trimmed = pruneToolTraffic(messages, window * PRUNE_AT - base);
    const estimate = base + estimateTokens(trimmed);
    // The previous call sent these messages (before this trim) and wrote its reply.
    const reported = stepContext(steps.at(-1)?.usage)?.tokens;
    const floor = reported === undefined ? 0 : reported - (estimateTokens(messages) - estimateTokens(trimmed));
    if (Math.max(estimate, floor) <= window * COMPACT_AT) return trimmed;

    let start = keptStart(trimmed, KEEP_STEPS);
    if (start > 0 && estimateTokens(trimmed.slice(start)) > window * 0.4) start = keptStart(trimmed, 1);
    if (start <= 0) return trimmed;
    const older = trimmed.slice(0, start);
    // An earlier summary is a user message too; the words it kept are in `request`.
    const latestUser = [...older].reverse().find((message) => message.role === "user" && !text(message).startsWith(NOTE));
    try {
      const summary = await summarize({ model, older, maxTokens: window * 0.5, abortSignal });
      if (!summary) return trimmed;
      if (latestUser) request = text(latestUser).slice(0, MAX_REQUEST);
      onCompact?.({ step: steps.length + 1, summary, messages: older.length });
      const words = request ? `\n\nThe user's latest message, verbatim:\n${request}` : "";
      return [{ role: "user", content: `${NOTE}\n\nSummary:\n${summary}${words}` }, ...trimmed.slice(start)];
    } catch (error) {
      if (abortSignal?.aborted) throw error;
      return trimmed;
    }
  };
}

/** The summaries a reply's run made, in step order; malformed entries are dropped. */
export function readRunCompactions(metadata: unknown): RunCompaction[] {
  const value = metadata && typeof metadata === "object" ? (metadata as { runCompactions?: unknown }).runCompactions : undefined;
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).filter((each): each is RunCompaction => {
    const item = each as Partial<RunCompaction> | null;
    return Boolean(item) && typeof item!.step === "number" && item!.step > 0 && typeof item!.summary === "string" && item!.summary.trim() !== "" && typeof item!.messages === "number";
  }).sort((a, b) => a.step - b.step);
}
