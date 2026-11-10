import { useEffect, useRef } from "react";
import { FileTextIcon, FolderIcon, GlobeIcon, ListIcon, SquareTerminalIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOL_LABELS, chatToolForShortcut, chatToolShortcut, type ChatTool } from "@/app/chat-tools";
import { ToolbarToggleButton } from "@/components/application/dashboard/toolbar-icon-button";

const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);
const icons = { outline: ListIcon, terminal: SquareTerminalIcon, changes: FileTextIcon, files: FolderIcon } as const;

/**
 * The title-bar tool toggles, in order 目录 · 终端 · 更改 · 浏览器 · 文件.
 * Each opens its panel in the right-hand area or closes it again.
 */
export function ChatToolButtons({ active, onToggle, browserOpen, onToggleBrowser }: {
  active: ChatTool | null;
  onToggle: (tool: ChatTool) => void;
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
}) {
  const toggle = (tool: ChatTool) => <ToolbarToggleButton key={tool} icon={icons[tool]} isSelected={active === tool} onChange={() => onToggle(tool)}
    label={`${active === tool ? "关闭" : "打开"}${CHAT_TOOL_LABELS[tool]}`} shortcut={chatToolShortcut(tool, platform())} />;
  return <>
    {toggle("outline")}
    {toggle("terminal")}
    {toggle("changes")}
    {onToggleBrowser && <ToolbarToggleButton icon={GlobeIcon} isSelected={browserOpen === true} onChange={onToggleBrowser}
      label={browserOpen ? "关闭浏览器" : "打开浏览器"} />}
    {toggle("files")}
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
