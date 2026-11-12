import { FileDiffIcon, FolderIcon, ListIcon, TerminalIcon } from "@/components/foundations/icons/app-icons";
import type { ChatTool } from "@/app/chat/chat-tools";

/** One icon per tool pane, shared by the title-bar buttons, the pane header and the command palette. */
export const CHAT_TOOL_ICONS = { outline: ListIcon, terminal: TerminalIcon, changes: FileDiffIcon, files: FolderIcon } as const satisfies Record<ChatTool, unknown>;
