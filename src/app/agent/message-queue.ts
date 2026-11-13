import type { UIMessage } from "ai";

/** What the composer sends: plain text, or text with browser annotations as a data part. */
export type SendInput = { text: string } | { parts: UIMessage["parts"] };

export interface QueuedMessage {
  id: string;
  /** The typed text, shown in the queue and used for 插话. */
  text: string;
  message: SendInput;
  /** "steering" while the running Agent has not yet received it. */
  state: "queued" | "steering";
  note?: string;
}

const partsOf = (message: SendInput): UIMessage["parts"] => "text" in message ? [{ type: "text", text: message.text }] : message.parts;

/**
 * Queued messages as the one message sent after the run: their text in
 * order, a blank line apart, then everything else they carried (annotations).
 */
export function mergeQueuedMessages(items: readonly QueuedMessage[]): SendInput {
  if (items.length === 1) return items[0].message;
  const parts = items.flatMap((item) => partsOf(item.message));
  const text = parts.flatMap((part) => part.type === "text" && part.text.trim() ? [part.text.trim()] : []).join("\n\n");
  return { parts: [{ type: "text", text }, ...parts.filter((part) => part.type !== "text")] };
}

/** Only plain text can join a running Agent: steering carries no annotations. */
export const canSteerMessage = (item: QueuedMessage) => partsOf(item.message).every((part) => part.type === "text");
