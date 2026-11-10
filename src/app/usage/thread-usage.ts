import { readChatUsage, type ChatReplyMetadata } from "./chat-usage";

/** What one conversation's replies cost, as the providers reported it. */
export interface ThreadUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Replies that reported usage. */
  replies: number;
  /** Model of the latest reply that named one. */
  model?: string;
  /** Last reported usage and the model's configured window at request time. */
  latest?: ChatReplyMetadata;
}

export function contextUsageRatio(latest: ChatReplyMetadata | undefined): number | undefined {
  return latest?.contextWindow ? latest.usage.totalTokens / latest.contextWindow : undefined;
}

/**
 * Sums the usage saved on assistant messages. Replies without usage (older
 * replies, servers that report none) are left out rather than estimated.
 */
export function threadUsage(messages: readonly { role: string; metadata?: unknown }[]): ThreadUsage {
  const total: ThreadUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0, replies: 0 };
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const reply = readChatUsage(message.metadata);
    if (!reply) continue;
    total.totalTokens += reply.usage.totalTokens;
    total.inputTokens += reply.usage.inputTokens ?? 0;
    total.outputTokens += reply.usage.outputTokens ?? 0;
    total.replies += 1;
    total.latest = reply;
    if (reply.model) total.model = reply.model;
  }
  return total;
}

/** 1234 → "1,234"; 12345 → "12.3k"; 1234567 → "1.23M". */
export function formatTokens(value: number): string {
  if (value < 10000) return value.toLocaleString("en-US");
  if (value < 1000000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(value / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
}
