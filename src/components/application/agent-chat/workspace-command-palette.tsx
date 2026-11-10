import { useEffect, useState } from "react";
import { GlobeIcon, MessageSquareTextIcon, PanelRightIcon, SquarePenIcon } from "@/components/foundations/icons/app-icons";
import { CommandPalette, CommandPaletteItem, CommandPaletteSection } from "@/components/base/command-palette/command-palette";
import { CHAT_TOOL_LABELS, CHAT_TOOLS, chatToolShortcut, type ChatTool } from "@/app/chat/chat-tools";
import { settingsSections, type SettingsSection } from "@/components/application/settings/workspace-settings-catalog";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { CHAT_TOOL_ICONS } from "./tools/chat-tool-icons";

const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);
const apple = () => /mac|iphone|ipad/i.test(platform());
/** ⇧⌘P / Ctrl+Shift+P, as in code editors; ⌘K and Ctrl+K already open search. */
export const COMMAND_PALETTE_SHORTCUT = () => apple() ? "⇧⌘P" : "Ctrl+Shift+P";
const SETTINGS: SettingsSection[] = ["model", "personalization", "appearance", "editor", "browser", "general", "shortcuts"];
const RECENT = 8;

/**
 * 命令面板: every workbench action in one searchable list — new chat, the
 * tool panels, the browser, the work panel, recent conversations and the
 * settings pages people open most. Each entry runs the same handler as its
 * button, so nothing here is a second code path.
 */
export function WorkspaceCommandPalette({ enabled, threads, onSelectThread, onNewChat, onOpenTool, onToggleBrowser, onTogglePanel }: {
  enabled: boolean;
  threads: readonly { id: string; title: string }[];
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onOpenTool: (tool: ChatTool) => void;
  onToggleBrowser: () => void;
  onTogglePanel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openSettings = useWorkspaceSettings();
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const primary = apple() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (!primary || !event.shiftKey || event.altKey || event.isComposing || event.key.toLowerCase() !== "p") return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  // Run after the palette closes, so focus has returned before a panel or dialog takes it.
  const run = (action: () => void) => () => { setOpen(false); requestAnimationFrame(action); };
  return <CommandPalette isOpen={open} onOpenChange={setOpen} shortcut={false} aria-label="命令面板"
    placeholder="输入命令、对话标题或设置名称…" emptyState="没有匹配的命令"
    footer={<><span>↑ ↓ 选择 · Esc 关闭</span><span>Enter 执行 · {COMMAND_PALETTE_SHORTCUT()} 打开</span></>}>
    <CommandPaletteSection title="对话">
      <CommandPaletteItem id="new" icon={SquarePenIcon} onAction={run(onNewChat)}>新建对话</CommandPaletteItem>
      {threads.slice(0, RECENT).map((thread) => <CommandPaletteItem key={thread.id} id={`thread:${thread.id}`} textValue={thread.title}
        icon={MessageSquareTextIcon} onAction={run(() => onSelectThread(thread.id))}>{thread.title}</CommandPaletteItem>)}
    </CommandPaletteSection>
    <CommandPaletteSection title="面板">
      {CHAT_TOOLS.map((tool) => <CommandPaletteItem key={tool} id={`tool:${tool}`} icon={CHAT_TOOL_ICONS[tool]}
        shortcut={chatToolShortcut(tool, platform())} onAction={run(() => onOpenTool(tool))}>打开{CHAT_TOOL_LABELS[tool]}</CommandPaletteItem>)}
      <CommandPaletteItem id="browser" icon={GlobeIcon} onAction={run(onToggleBrowser)}>打开或关闭浏览器</CommandPaletteItem>
      <CommandPaletteItem id="panel" icon={PanelRightIcon} onAction={run(onTogglePanel)}>打开或关闭工作面板</CommandPaletteItem>
    </CommandPaletteSection>
    <CommandPaletteSection title="设置">
      {SETTINGS.map((section) => <CommandPaletteItem key={section} id={`settings:${section}`} icon={settingsSections[section].icon} onAction={run(() => openSettings(section))}>设置：{settingsSections[section].label}</CommandPaletteItem>)}
    </CommandPaletteSection>
  </CommandPalette>;
}
