import { useEffect, useRef, type Key } from "react";
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, EyeOffIcon, LayoutPanelLeftIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOLS } from "@/app/chat/chat-tools";
import { isPluginViewId, type WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu, ContextMenuTrigger } from "@/components/base/context-menu/context-menu";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { toast } from "@/components/base/toast/toast";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { useWorkPanelViews } from "@/hooks/use-ui-plugins";
import { useSlotLayout } from "@/hooks/use-slot-layout";
import type { WorkPanelView } from "./use-browser-placement";
import { WorkPanelMoreMenu } from "./work-panel-more-menu";

/** The panel tab a view belongs to: the tools all sit under 工具. */
const tabOf = (view: WorkPanelView) => (CHAT_TOOLS as readonly string[]).includes(view) ? "outline" : view;

/**
 * The work panel's tabs, from the extension registry in the user's order
 * (`workPanel.view`): built-in views and enabled plugin views. Right-click
 * (or Shift+F10 / the Menu key) on a tab to hide it, move it, show a hidden
 * tab or open the layout settings; 更多工具 lists hidden tabs and the plugin
 * page. 历史 and 工具 cannot be hidden. When the open view's tab is hidden,
 * or its plugin is turned off or removed, the panel goes back to 历史 and
 * says so.
 */
export function WorkPanelTabs({ view, onSelectView }: { view: WorkPanelView; onSelectView: (view: WorkPanelView) => void }) {
  const entries = useWorkPanelViews();
  const slot = useSlotLayout("workPanel.view", entries);
  const openSettings = useWorkspaceSettings();
  const listRef = useRef<HTMLDivElement>(null);
  const tool = CHAT_TOOLS.find((candidate) => candidate === view);
  const openTab = tabOf(view);
  const hiddenOpen = slot.hidden.find((entry) => entry.view === openTab)?.label;
  const missing = isPluginViewId(openTab) && !entries.some((entry) => entry.view === openTab);
  useEffect(() => {
    if (!hiddenOpen && !missing) return;
    onSelectView("history");
    if (hiddenOpen) toast.info(`已隐藏“${hiddenOpen}”标签`, { description: "工作面板回到了“历史”。可在右键菜单、更多工具或 设置 → 界面布局 中重新显示。" });
    else toast.info("插件视图已关闭", { description: "提供它的界面插件已停用或移除，工作面板回到了“历史”。" });
  }, [hiddenOpen, missing, onSelectView]);

  // The hidden tab took the focus with it: keep keyboard users on the tab bar.
  const focusTab = (index: number) => requestAnimationFrame(() => {
    const tabs = listRef.current?.querySelectorAll("button");
    if (tabs?.length) tabs[Math.min(index, tabs.length - 1)].focus();
  });

  const act = (entry: WorkPanelViewContribution, index: number) => (key: Key) => {
    const action = String(key);
    if (action === "hide") { slot.hide(entry); focusTab(Math.max(0, index - 1)); }
    else if (action === "earlier") slot.move(entry, -1);
    else if (action === "later") slot.move(entry, 1);
    else if (action === "settings") openSettings("layout");
    else if (action.startsWith("show:")) {
      const hidden = slot.hidden.find((candidate) => candidate.id === action.slice(5));
      if (hidden) slot.show(hidden);
    }
  };

  return <div className="flex min-w-0 items-center gap-0.5">
    <div ref={listRef} className="contents"><PillTabList aria-label="工作面板" className="flex min-w-0 gap-0.5 overflow-x-auto">
      {slot.shown.map((entry, index) => <ContextMenuTrigger key={entry.id}>
        <PillTab variant="gray" isSelected={entry.view === openTab}
          onSelect={() => onSelectView(entry.view === "outline" ? tool ?? "outline" : entry.view)}>{entry.label}</PillTab>
        <ContextMenu aria-label={`“${entry.label}”标签`} onAction={act(entry, index)}>
          <ContextMenuItem id="hide" icon={EyeOffIcon} isDisabled={entry.required}>{entry.required ? `“${entry.label}”不能隐藏` : `隐藏“${entry.label}”`}</ContextMenuItem>
          <ContextMenuItem id="earlier" icon={ArrowLeftIcon} isDisabled={index === 0}>向前移</ContextMenuItem>
          <ContextMenuItem id="later" icon={ArrowRightIcon} isDisabled={index === slot.shown.length - 1}>向后移</ContextMenuItem>
          {slot.hidden.length > 0 && <ContextMenuSubmenu label="显示已隐藏的标签" icon={EyeIcon}>
            {slot.hidden.map((hidden) => <ContextMenuItem key={hidden.id} id={`show:${hidden.id}`}>{hidden.label}</ContextMenuItem>)}
          </ContextMenuSubmenu>}
          <ContextMenuSeparator />
          <ContextMenuItem id="settings" icon={LayoutPanelLeftIcon}>界面布局设置…</ContextMenuItem>
        </ContextMenu>
      </ContextMenuTrigger>)}
    </PillTabList></div>
    <WorkPanelMoreMenu hidden={slot.hidden} onLayout={() => openSettings("layout")} onPlugins={() => openSettings("ui-plugins")}
      onOpenHidden={(entry) => { slot.show(entry); onSelectView(entry.view); }} />
  </div>;
}
