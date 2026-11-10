import { FileTextIcon, FolderIcon, ListIcon, SquareTerminalIcon } from "@/components/foundations/icons/app-icons";
import type { ChatTool } from "@/app/chat/chat-tools";

/** One icon per tool panel, shared by the panel header, its switch and the command palette. */
export const CHAT_TOOL_ICONS = { outline: ListIcon, terminal: SquareTerminalIcon, changes: FileTextIcon, files: FolderIcon } as const satisfies Record<ChatTool, unknown>;
