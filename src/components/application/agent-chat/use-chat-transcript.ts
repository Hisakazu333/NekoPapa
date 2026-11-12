import { useMemo } from "react";
import type { UIMessage } from "ai";
import { messageText } from "./thread-storage";

/** Derived views of the open chat: whether to show the thinking indicator, and its plain-text transcript. */
export function useChatTranscript(messages: UIMessage[], busy: boolean) {
  // Reasoning models stream their thinking before any text, and the SDK flips
  // status to "streaming" on that first non-text chunk. Gating the indicator on
  // "submitted" alone therefore hides it seconds before a word appears, leaving
  // an empty transcript. It stays up until real text exists.
  // A tool call counts as the reply having started: its own card shows progress.
  const streamedText = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return "";
    if (last.parts.some((part) => part.type.startsWith("tool-"))) return "tool";
    return last.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }, [messages]);

  /** The open chat as plain text, for the share control. */
  const transcript = useMemo(
    () =>
      messages
        .map((message) => `${message.role === "user" ? "You" : "Assistant"}: ${messageText(message)}`)
        .filter((line) => !line.endsWith(": "))
        .join("\n\n"),
    [messages],
  );

  return { showThinking: busy && streamedText.length === 0, transcript };
}
