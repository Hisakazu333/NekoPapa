import { GlobeIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOL_LABELS, chatToolShortcut, type ChatTool } from "@/app/chat/chat-tools";
import { ToolbarToggleButton } from "@/components/application/dashboard/toolbar-icon-button";
import { CHAT_TOOL_ICONS } from "./tools/chat-tool-icons";
import type { WorkPanelView } from "./use-browser-placement";

/** What the title bar needs to open and close the right-hand panes. */
export interface ChatPaneControls {
  /** The pane on screen: a work panel view, the browser, or nothing. */
  shown: WorkPanelView | "browser" | null;
  /** A pane button: opens that pane, or closes it when it is the one shown. */
  toggle: (pane: ChatTool | "browser") => void;
  /** Opens a view from the ⋯ menu (环境与上下文, 历史, 资料, plugin views). */
  open: (view: WorkPanelView) => void;
}

const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);
const ORDER: readonly (ChatTool | "browser")[] = ["outline", "terminal", "changes", "browser", "files"];

/**
 * One button per pane in the title bar, as in Claude's desktop app: 目录,
 * 终端, 更改, 浏览器 and 文件. Each opens its pane in the right-hand area in
 * one step and shows as pressed while that pane is on screen; pressing it
 * again closes the pane. Only one pane shows at a time.
 */
export function ChatPaneButtons({ panes }: { panes: ChatPaneControls }) {
  return <>
    {ORDER.map((pane) => {
      const shown = panes.shown === pane;
      const label = pane === "browser" ? "浏览器" : CHAT_TOOL_LABELS[pane];
      return <ToolbarToggleButton key={pane} icon={pane === "browser" ? GlobeIcon : CHAT_TOOL_ICONS[pane]} isSelected={shown}
        onChange={() => panes.toggle(pane)} label={shown ? `关闭${label}` : label}
        shortcut={pane === "browser" ? undefined : chatToolShortcut(pane, platform())} />;
    })}
  </>;
}
