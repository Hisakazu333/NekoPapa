import { useEffect, useRef } from "react";
import { GlobeIcon, ListIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOLS, chatToolForShortcut, type ChatTool } from "@/app/chat-tools";
import { ToolbarToggleButton } from "@/components/application/dashboard/toolbar-icon-button";

const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);

/**
 * The title bar keeps 目录 and 浏览器. 目录 opens the tool panel, whose header
 * switches to 终端 / 更改 / 文件, so it shows as on while any of them is open
 * and closes whichever is shown. They also open from 工作面板 → 代码 and their
 * shortcuts.
 */
export function ChatToolButtons({ active, onToggle, browserOpen, onToggleBrowser }: {
  active: ChatTool | null;
  onToggle: (tool: ChatTool) => void;
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
}) {
  const open = active !== null && CHAT_TOOLS.includes(active);
  return <>
    <ToolbarToggleButton icon={ListIcon} isSelected={open} onChange={() => onToggle(active ?? "outline")}
      label={open ? "关闭目录与工具面板" : "打开目录"} />
    {onToggleBrowser && <ToolbarToggleButton icon={GlobeIcon} isSelected={browserOpen === true} onChange={onToggleBrowser}
      label={browserOpen ? "关闭浏览器" : "打开浏览器"} />}
  </>;
}

/**
 * ⌘J 终端, ⇧⌘D 更改, ⇧⌘F 文件 (Ctrl on other platforms) while the chat
 * workspace is shown. They also work while typing in the composer, as the
 * terminal shortcut does in editors.
 */
export function useChatToolShortcuts(enabled: boolean, onToggle: (tool: ChatTool) => void) {
  const latest = useRef(onToggle);
  useEffect(() => { latest.current = onToggle; }, [onToggle]);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const tool = chatToolForShortcut(event, platform());
      if (!tool) return;
      event.preventDefault();
      latest.current(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
