import { useEffect, useRef } from "react";
import { chatToolForShortcut, type ChatTool } from "@/app/chat/chat-tools";

const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);

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
