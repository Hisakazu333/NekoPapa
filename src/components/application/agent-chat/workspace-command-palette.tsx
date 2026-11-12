import { useEffect, useState } from "react";
import { BookOpenIcon, CodeIcon, GlobeIcon, HistoryIcon, MessageSquareTextIcon, PanelRightIcon, SquarePenIcon } from "@/components/foundations/icons/app-icons";
import { CommandPalette, CommandPaletteItem, CommandPaletteSection } from "@/components/base/command-palette/command-palette";
import { CHAT_TOOL_LABELS, CHAT_TOOLS, chatToolShortcut } from "@/app/chat/chat-tools";
import { VIEW_COMMANDS } from "@/app/plugins/slot-registry";
import { unmetRequirement } from "@/app/plugins/plugin-host";
import { fillUrlTemplate } from "@/app/plugins/plugin-settings";
import type { PluginCommandContribution } from "@/app/plugins/plugin-contributions";
import { pluginIcon } from "@/components/application/plugins/plugin-icons";
import { toast } from "@/components/base/toast/toast";
import { openExternal } from "@/platform/open-external";
import { useSlotLayout } from "@/hooks/use-slot-layout";
import { usePluginContributions, useWorkPanelViews } from "@/hooks/use-ui-plugins";
import { usePluginSettingValues } from "@/hooks/use-plugin-settings";
import { settingsSections, type SettingsSection } from "@/components/application/settings/workspace-settings-catalog";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { CHAT_TOOL_ICONS } from "./tools/chat-tool-icons";
import type { WorkPanelView } from "./use-browser-placement";

const platform = () => (typeof navigator === "undefined" ? "" : navigator.platform);
const apple = () => /mac|iphone|ipad/i.test(platform());
/** ⇧⌘P / Ctrl+Shift+P, as in code editors; ⌘K and Ctrl+K already open search. */
export const COMMAND_PALETTE_SHORTCUT = () => apple() ? "⇧⌘P" : "Ctrl+Shift+P";
const SETTINGS: SettingsSection[] = ["model", "personalization", "appearance", "layout", "ui-plugins", "editor", "browser", "general", "shortcuts"];
const RECENT = 8;
const VIEW_ICONS = { history: HistoryIcon, code: CodeIcon, study: BookOpenIcon, outline: undefined };

/**
 * 命令面板: every workbench action in one searchable list — new chat, the
 * tool panels, the browser, the work panel, recent conversations and the
 * settings pages people open most. Each entry runs the same handler as its
 * button, so nothing here is a second code path. The work panel views come
 * from the extension registry and leave the list when their tab is hidden;
 * enabled interface plugins add their commands under 插件 (a command whose
 * requirement is not met is shown disabled with the reason; a URL command
 * missing a setting it reads opens that plugin's settings page instead).
 */
export function WorkspaceCommandPalette({ enabled, threads, onSelectThread, onNewChat, onOpenView, onToggleBrowser, onTogglePanel }: {
  enabled: boolean;
  threads: readonly { id: string; title: string }[];
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  /** Opens a view or tool in the work panel. */
  onOpenView: (view: WorkPanelView) => void;
  onToggleBrowser: () => void;
  onTogglePanel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const shownViews = (view: string) => views.shown.some((entry) => entry.view === view);
  const openSettings = useWorkspaceSettings();
  const views = useSlotLayout("workPanel.view", useWorkPanelViews());
  const plugins = usePluginContributions();
  const pluginValues = usePluginSettingValues();
  const pluginCommands = plugins.commands
    .filter((command) => !("openView" in command.action) || shownViews(command.action.openView));
  /** What running a plugin command does now: the filled URL, or the setting it still needs. */
  const resolve = (command: PluginCommandContribution) => {
    const action = command.action;
    if (!("openUrl" in action)) return { run: () => ("openView" in action ? onOpenView(action.openView) : openSettings(action.openSettings)) };
    const filled = fillUrlTemplate(action.openUrl, action.fields, pluginValues[command.plugin.pluginId]);
    if ("url" in filled) return { run: () => void openExternal(filled.url).catch((error: Error) => toast.error("没有打开网址", { description: error.message })) };
    const page = plugins.settings.find((entry) => entry.plugin.pluginId === command.plugin.pluginId && entry.fields.some((field) => field.key === filled.key));
    return {
      note: `先在插件设置里填写“${filled.missing}”`,
      run: () => {
        toast.info(`先填写“${filled.missing}”`, { description: `“${command.label}”的网址需要这个设置。` });
        if (page) openSettings(page.id);
      },
    };
  };
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
      {VIEW_COMMANDS.filter((command) => shownViews(command.opens)).map((command) => <CommandPaletteItem key={command.id} id={command.id}
        icon={VIEW_ICONS[command.opens]} onAction={run(() => onOpenView(command.opens))}>{command.label}</CommandPaletteItem>)}
      {CHAT_TOOLS.map((tool) => <CommandPaletteItem key={tool} id={`tool:${tool}`} textValue={`打开${CHAT_TOOL_LABELS[tool]}`} icon={CHAT_TOOL_ICONS[tool]}
        shortcut={chatToolShortcut(tool, platform())} onAction={run(() => onOpenView(tool))}>打开{CHAT_TOOL_LABELS[tool]}</CommandPaletteItem>)}
      <CommandPaletteItem id="browser" icon={GlobeIcon} onAction={run(onToggleBrowser)}>打开或关闭浏览器</CommandPaletteItem>
      <CommandPaletteItem id="panel" icon={PanelRightIcon} onAction={run(onTogglePanel)}>打开或关闭工作面板</CommandPaletteItem>
    </CommandPaletteSection>
    {pluginCommands.length > 0 && <CommandPaletteSection title="插件">
      {pluginCommands.map((command) => {
        const unmet = unmetRequirement(command.plugin.requires);
        const next = resolve(command);
        return <CommandPaletteItem key={command.id} id={command.id} textValue={command.label} icon={pluginIcon(command.icon)} isDisabled={Boolean(unmet)}
          description={unmet ?? next.note ?? command.plugin.pluginName} onAction={run(next.run)}>{command.label}</CommandPaletteItem>;
      })}
    </CommandPaletteSection>}
    <CommandPaletteSection title="设置">
      {SETTINGS.map((section) => <CommandPaletteItem key={section} id={`settings:${section}`} textValue={`设置：${settingsSections[section].label}`} icon={settingsSections[section].icon} onAction={run(() => openSettings(section))}>设置：{settingsSections[section].label}</CommandPaletteItem>)}
    </CommandPaletteSection>
  </CommandPalette>;
}
