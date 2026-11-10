"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { CheckIcon, EllipsisIcon, PanelRightIcon, UploadIcon } from "@/components/foundations/icons/app-icons";
import { useEffect, useState } from "react";

import {
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { cx } from "@/utils/cx";
import { toolbarIconButtonClass as ACTION_BUTTON, toolbarIconClass } from "@/components/application/dashboard/toolbar-icon-button";
import type { ChatTool } from "@/app/chat-tools";
import { ChatToolButtons } from "./tools/chat-tool-buttons";
import { ChatPluginsButton } from "./tools/chat-plugins-button";

/**
 * The controls in the top right of the chat surface: share the open chat, and
 * a menu of the actions that apply to it.
 *
 * Every entry does something the starter can actually do — copy, download,
 * mark, delete. Until the chat has a message there is nothing to share or
 * act on, so both stay hidden instead of showing as dimmed buttons. Nothing here is a placeholder waiting on a backend, because a
 * control that looks live and does nothing is worse than no control.
 */

export interface AgentChatActionsProps {
  /** Plain-text transcript of the open chat, for share and copy. */
  transcript: string;
  onExport: () => void;
  onToggleUnread: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
  /** No chat open yet, so there is nothing to act on. */
  disabled?: boolean;
  /** Contact-owned history is managed from the contacts workspace. */
  showThreadMenu?: boolean;
  /** Side panel (历史 / 代码 / 资料) toggle; omitted where the surface has no panel. */
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  /** Built-in browser toggle; it shares the right-hand area with the side panel. */
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
  /** The open tool panel and its toggle; present where the surface has a right-hand area. */
  activeTool?: ChatTool | null;
  onToggleTool?: (tool: ChatTool) => void;
  className?: string;
}

export function AgentChatActions({
  transcript,
  onExport,
  onToggleUnread,
  onDelete,
  deleteDisabled = false,
  disabled = false,
  showThreadMenu = true,
  panelOpen = false,
  onTogglePanel,
  browserOpen = false,
  onToggleBrowser,
  activeTool = null,
  onToggleTool,
  className,
}: AgentChatActionsProps) {
  const localize = useTemplateCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!shared) return;
    const timer = setTimeout(() => setShared(false), 1600);
    return () => clearTimeout(timer);
  }, [shared]);

  const share = async () => {
    if (!transcript) return;
    // The Web Share sheet where the browser has one, the clipboard everywhere
    // else. Both leave the transcript on the device.
    try {
      if (navigator.share) {
        await navigator.share({ text: transcript });
        return;
      }
      await navigator.clipboard.writeText(transcript);
      setShared(true);
    } catch {
      // A dismissed share sheet and a refused clipboard both land here, and
      // neither is worth interrupting the reader over.
    }
  };

  const choose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return localize((
    <div className={cx("flex shrink-0 items-center gap-0.5", className)}>
      {onToggleTool && <ChatToolButtons active={activeTool} onToggle={onToggleTool} browserOpen={browserOpen} onToggleBrowser={onToggleBrowser} />}
      {onToggleTool && <ChatPluginsButton />}
      {/* Share and the chat menu act on the open chat, so an empty chat has neither. */}
      {!disabled && <button
        type="button"
        onClick={share}
        disabled={disabled}
        aria-label={shared ? "已复制对话文本" : "分享对话"}
        title={shared ? "已复制对话文本" : "分享对话（复制为文本）"}
        className={ACTION_BUTTON}
      >
        {shared ? (
          <CheckIcon className={toolbarIconClass} aria-hidden />
        ) : (
          <UploadIcon className={toolbarIconClass} aria-hidden />
        )}
      </button>}

      {showThreadMenu && !disabled && <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownTrigger
          aria-label="对话的更多操作"
          isDisabled={disabled}
          className={cx(ACTION_BUTTON, menuOpen && "bg-background-primary-hover text-text-primary")}
        >
          <EllipsisIcon className={toolbarIconClass} aria-hidden />
        </DropdownTrigger>

        <DropdownPopover
          aria-label="对话的更多操作"
          placement="bottom end"
          className="w-[190px] p-2"
        >
          <DropdownGroup>
            <DropdownItem onSelect={choose(onExport)} className="px-2 py-1.5">
              <span className="truncate text-body-medium whitespace-nowrap text-text-primary">
                导出对话
              </span>
            </DropdownItem>
            <DropdownItem onSelect={choose(onToggleUnread)} className="px-2 py-1.5">
              <span className="truncate text-body-medium whitespace-nowrap text-text-primary">
                标为未读
              </span>
            </DropdownItem>
            <DropdownItem disabled={deleteDisabled} onSelect={choose(onDelete)} className="px-2 py-1.5">
              <span className="truncate text-body-medium whitespace-nowrap text-text-error-primary">
                删除对话
              </span>
            </DropdownItem>
          </DropdownGroup>
        </DropdownPopover>
      </Dropdown>}
      {onTogglePanel && <button type="button" onClick={onTogglePanel} aria-pressed={panelOpen}
        aria-controls="chat-auxiliary-workspace" aria-label={panelOpen ? "关闭工作面板" : "打开工作面板"} title={panelOpen ? "关闭工作面板" : "打开工作面板（历史、代码、资料）"}
        className={cx(ACTION_BUTTON, panelOpen && "bg-background-primary-hover text-text-primary")}>
        <PanelRightIcon className={toolbarIconClass} aria-hidden />
      </button>}
    </div>
  ));
}
