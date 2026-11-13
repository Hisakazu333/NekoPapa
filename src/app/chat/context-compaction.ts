import { generateText, type LanguageModel, type ModelMessage, type UIMessage } from "ai";
import { DEFAULT_CONTEXT_WINDOW, estimateTokens, pruneToolTraffic, textTokens } from "./context-budget";

/**
 * Keeping a long chat inside the model's context window. Before each reply:
 * old tool output and bulky tool inputs are trimmed first (context-budget.ts);
 * if the chat is still past COMPACT_AT of the window, the turns before the
 * last two are summarized by the same model, and the reply is answered from
 * that summary plus the recent turns. The summary is saved on the new reply
 * as `metadata.compaction`, so later replies start from it instead of
 * summarizing again; the transcript itself keeps every message.
 */
export interface Compaction {
  /** The id of the last message the summary covers. */
  through: string;
  summary: string;
  /** How many messages it covers (for the note in the transcript). */
  messages: number;
}

/** Trim tool traffic above this share of the window. */
export const PRUNE_AT = 0.6;
/** Summarize earlier turns above this share. */
export const COMPACT_AT = 0.75;
const KEEP_TURNS = 2;
const MAX_SUMMARY = 40_000;

export function readCompaction(metadata: unknown): Compaction | undefined {
  const value = metadata && typeof metadata === "object" ? (metadata as { compaction?: unknown }).compaction : undefined;
  if (!value || typeof value !== "object") return undefined;
  const { through, summary, messages } = value as Record<string, unknown>;
  if (typeof through !== "string" || !through || typeof summary !== "string" || !summary.trim() || summary.length > MAX_SUMMARY) return undefined;
  return { through, summary, messages: typeof messages === "number" && messages > 0 ? Math.floor(messages) : 0 };
}

/** The chat as the model should see it: the latest saved summary, and the messages after what it covers. */
export function applyCompaction(messages: UIMessage[]): { summary?: string; rest: UIMessage[]; offset: number } {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const saved = messages[index].role === "assistant" ? readCompaction(messages[index].metadata) : undefined;
    const through = saved ? messages.findIndex((message) => message.id === saved.through) : -1;
    if (saved && through >= 0 && through < index) return { summary: saved.summary, rest: messages.slice(through + 1), offset: through + 1 };
  }
  return { rest: messages, offset: 0 };
}

/** Where the kept recent turns start: the user message `turns` turns back, or 0 when there is nothing older. */
export function recentStart(messages: UIMessage[], turns = KEEP_TURNS): number {
  let seen = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user" && ++seen === turns) return index;
  }
  return 0;
}

/** Older turns as plain text for the summarizer: any provider takes it, with or without tools. */
export function transcriptText(messages: ModelMessage[], maxTokens: number): string {
  const lines: string[] = [];
  const clip = (text: string, limit: number) => (text.length > limit ? `${text.slice(0, limit)}…` : text);
  for (const message of messages) {
    if (message.role === "system") continue;
    const who = message.role === "user" ? "User" : message.role === "assistant" ? "Assistant" : "Tool";
    if (typeof message.content === "string") { lines.push(`${who}: ${message.content}`); continue; }
    for (const part of message.content as { type: string; text?: string; toolName?: string; input?: unknown; output?: unknown }[]) {
      if (part.type === "text" && part.text) lines.push(`${who}: ${part.text}`);
      else if (part.type === "tool-call") lines.push(`Assistant called ${part.toolName}: ${clip(JSON.stringify(part.input ?? {}), 400)}`);
      else if (part.type === "tool-result") lines.push(`Result of ${part.toolName}: ${clip(JSON.stringify(part.output ?? ""), 1200)}`);
    }
  }
  // Too long even so: keep the latest part, which the summary needs most.
  let text = lines.join("\n");
  while (textTokens(text) > maxTokens && text.length > 1000) text = text.slice(Math.floor(text.length / 4));
  return text;
}

const SUMMARY_SYSTEM = "You compress the earlier part of a conversation between a user and an AI assistant (which may have used tools on the user's project) so the assistant can continue without it. Write in the language the user writes in. Keep: the user's goals, requirements and preferences in their own words; decisions made; files read or changed (paths) and what changed; commands run and their results; errors and how they were resolved; what is done and what remains. Omit pleasantries. Do not invent anything. Plain text or a short list, under 1200 words.";

type Convert = (messages: UIMessage[]) => Promise<ModelMessage[]>;

/**
 * The messages for this reply, within the window: trimmed and, if needed,
 * with earlier turns replaced by a summary. `system` carries the summary;
 * `compaction` is set when this reply made a new one, to be saved with it.
 * A summary that fails is skipped: the reply is attempted with what fits.
 */
export async function prepareContext({ model, contextWindow, messages, convert, system, abortSignal }: {
  model: LanguageModel;
  contextWindow?: number;
  messages: UIMessage[];
  convert: Convert;
  system: string;
  abortSignal?: AbortSignal;
}): Promise<{ messages: ModelMessage[]; summary?: string; compaction?: Compaction; window: number }> {
  const window = contextWindow && contextWindow > 0 ? contextWindow : DEFAULT_CONTEXT_WINDOW;
  const { summary, rest, offset } = applyCompaction(messages);
  const base = textTokens(system) + (summary ? textTokens(summary) : 0);
  const converted = pruneToolTraffic(await convert(rest), window * PRUNE_AT - base);
  if (base + estimateTokens(converted) <= window * COMPACT_AT) return { messages: converted, summary, window };

  const start = recentStart(rest);
  if (start <= 0) return { messages: converted, summary, window };
  const older = await convert(rest.slice(0, start));
  const recent = pruneToolTraffic(await convert(rest.slice(start)), window * PRUNE_AT - base);
  try {
    const prior = summary ? `Summary of what came before:\n${summary}\n\n` : "";
    const result = await generateText({
      model,
      system: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: `${prior}Conversation to summarize:\n${transcriptText(older, window * 0.5)}\n\nWrite the summary now.` }],
      maxOutputTokens: 3000,
      abortSignal,
    });
    const text = result.text.trim().slice(0, MAX_SUMMARY);
    if (!text) return { messages: converted, summary, window };
    const through = rest[start - 1].id;
    return { messages: recent, summary: text, compaction: { through, summary: text, messages: offset + start }, window };
  } catch (error) {
    if (abortSignal?.aborted) throw error;
    return { messages: converted, summary, window };
  }
}

/** The system prompt's part for a summarized chat. */
export const summaryPrompt = (summary: string | undefined) =>
  summary ? `The earlier part of this conversation was summarized to fit the context window:\n${summary}\nContinue from it; if you need details it leaves out (file contents, exact output), read or run them again.` : "";
