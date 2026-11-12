"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { cx } from "@/utils/cx";
import { ChatPluginsButton } from "./tools/chat-plugins-button";
import { ChatPaneButtons, type ChatPaneControls } from "./chat-pane-buttons";
import { ChatMoreMenu } from "./chat-more-menu";

/**
 * The controls in the top right of the chat surface, after Claude's desktop
 * app: one button per pane (目录, 终端, 更改, 浏览器, 文件), the interface
 * plugins, and ⋯ with the other panes and the open chat's actions.
 *
 * Every entry does something the app can actually do. Until the chat has a
 * message there is nothing to copy or act on, so those rows stay out of ⋯
 * instead of showing dimmed.
 */

export interface AgentChatActionsProps {
  /** Plain-text transcript of the open chat, for copying. */
  transcript: string;
  onExport: () => void;
  onToggleUnread: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
  /** No chat open yet, so there is nothing to act on. */
  disabled?: boolean;
  /** Contact-owned history is managed from the contacts workspace. */
  showThreadMenu?: boolean;
  /** The right-hand panes; omitted where the surface has none. */
  panes?: ChatPaneControls;
  className?: string;
}

/** The Web Share sheet where the browser has one, the clipboard everywhere else. */
async function shareText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.share) { await navigator.share({ text }); return false; }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // A dismissed share sheet and a refused clipboard both land here; neither is worth an interruption.
    return false;
  }
}

export function AgentChatActions({
  transcript,
  onExport,
  onToggleUnread,
  onDelete,
  deleteDisabled = false,
  disabled = false,
  showThreadMenu = true,
  panes,
  className,
}: AgentChatActionsProps) {
  const localize = useTemplateCopy();
  return localize((
    <div className={cx("flex shrink-0 items-center gap-0.5", className)}>
      {panes && <ChatPaneButtons panes={panes} />}
      {panes && <ChatPluginsButton />}
      {(panes || !disabled) && <ChatMoreMenu panes={panes} thread={{
        onShare: () => shareText(transcript), onExport, onToggleUnread, onDelete, deleteDisabled, showThreadMenu, empty: disabled,
      }} />}
    </div>
  ));
}
