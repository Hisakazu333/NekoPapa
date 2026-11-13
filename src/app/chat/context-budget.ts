import type { ModelMessage } from "ai";

/**
 * Rough token counts for what is sent to the model, and trimming old tool
 * traffic when it grows too large. Counts are estimates (no tokenizer for
 * every provider): CJK and other wide characters about one token each, other
 * text about four characters a token, images and files a flat 1,000.
 */
export const DEFAULT_CONTEXT_WINDOW = 64_000;
const STUB = "[Earlier tool output removed to save context. Call the tool again if you need it.]";
const LARGE = 200;

export function textTokens(text: string): number {
  let wide = 0;
  for (let index = 0; index < text.length; index += 1) if (text.charCodeAt(index) > 0x2e7f) wide += 1;
  return Math.ceil(wide + (text.length - wide) / 4);
}

export function estimateTokens(value: unknown): number {
  if (typeof value === "string") return textTokens(value);
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + estimateTokens(item), 0);
  if (!value || typeof value !== "object") return 0;
  const item = value as Record<string, unknown>;
  if (item.type === "file" || item.type === "image") return 1000;
  let sum = 0;
  for (const [key, each] of Object.entries(item)) if (key !== "providerOptions") sum += estimateTokens(each);
  return sum;
}

/** A tool call's input without its bulk (a whole file written, say), keeping what names the call. */
function slimInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const kept = Object.fromEntries(Object.entries(input as Record<string, unknown>)
    .filter(([key, value]) => ["path", "command", "query", "pattern"].includes(key) && typeof value === "string"));
  return { ...kept, omitted: "Earlier input removed to save context." };
}

/**
 * The messages with the oldest large tool results (and large tool inputs,
 * such as file contents written) replaced by a short note, oldest first,
 * until the estimate fits `budget`. The last `keep` tool exchanges stay
 * whole. Returns the same array when nothing needed trimming.
 */
export function pruneToolTraffic(messages: ModelMessage[], budget: number, keep = 6): ModelMessage[] {
  let total = estimateTokens(messages);
  if (total <= budget) return messages;
  const out = messages.map((message) => Array.isArray(message.content) ? { ...message, content: [...message.content] } as ModelMessage : message);
  const spots: [number, number][] = [];
  out.forEach((message, index) => {
    if (!Array.isArray(message.content)) return;
    message.content.forEach((part, at) => { if (part.type === "tool-result" || part.type === "tool-call") spots.push([index, at]); });
  });
  // Calls and results come in pairs: keeping the last `keep` pairs keeps 2 × keep spots.
  for (const [index, at] of spots.slice(0, Math.max(0, spots.length - keep * 2))) {
    if (total <= budget) break;
    const content = out[index].content as { type: string; output?: unknown; input?: unknown }[];
    const part = content[at];
    const field = part.type === "tool-result" ? "output" : "input";
    const before = estimateTokens(part[field]);
    if (before < LARGE) continue;
    const after = field === "output" ? { type: "text", value: STUB } : slimInput(part.input);
    content[at] = { ...part, [field]: after };
    total -= before - estimateTokens(after);
  }
  return out;
}
