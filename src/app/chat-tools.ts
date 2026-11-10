/**
 * The title-bar tools that open in the chat's right-hand area. Each has one
 * id used by the toolbar toggle, its shortcut and the panel it opens.
 */
export type ChatTool = "outline" | "terminal" | "changes" | "files";

export const CHAT_TOOLS: readonly ChatTool[] = ["outline", "terminal", "changes", "files"];

export const CHAT_TOOL_LABELS: Record<ChatTool, string> = {
  outline: "目录",
  terminal: "终端",
  changes: "更改",
  files: "文件",
};

type Chord = { key: string; shift: boolean };
/** ⌘J / Ctrl+J for 终端, ⇧⌘D / Ctrl+Shift+D for 更改, ⇧⌘F / Ctrl+Shift+F for 文件. 目录 has none. */
const CHORDS: Partial<Record<ChatTool, Chord>> = {
  terminal: { key: "j", shift: false },
  changes: { key: "d", shift: true },
  files: { key: "f", shift: true },
};

const apple = (platform: string) => /mac|iphone|ipad/i.test(platform);

export function chatToolShortcut(tool: ChatTool, platform: string): string | undefined {
  const chord = CHORDS[tool];
  if (!chord) return undefined;
  const letter = chord.key.toUpperCase();
  if (apple(platform)) return `${chord.shift ? "⇧" : ""}⌘${letter}`;
  return `Ctrl+${chord.shift ? "Shift+" : ""}${letter}`;
}

/** Which tool a key press toggles, if any. ⌘ on Apple platforms, Ctrl elsewhere; Alt never. */
export function chatToolForShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing" | "repeat">,
  platform: string,
): ChatTool | undefined {
  if (event.altKey || event.isComposing || event.repeat) return undefined;
  const primary = apple(platform) ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!primary) return undefined;
  const key = event.key.toLowerCase();
  return CHAT_TOOLS.find((tool) => {
    const chord = CHORDS[tool];
    return chord !== undefined && chord.key === key && chord.shift === event.shiftKey;
  });
}

export interface OutlineEntry { id: string; index: number; title: string }

/** The 目录 entries: each message the user sent, numbered, by its first non-empty line. */
export function chatOutline(messages: readonly { id: string; role: string; text: string }[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  for (const message of messages) {
    if (message.role !== "user") continue;
    const line = message.text.split("\n").map((part) => part.trim()).find(Boolean);
    entries.push({ id: message.id, index: entries.length + 1, title: line ?? "（没有文字的消息）" });
  }
  return entries;
}
