import { useState } from "react";
import {
  BookOpenIcon, CheckIcon, CopyIcon, DownloadIcon, EllipsisIcon, HistoryIcon, LayoutPanelLeftIcon, MailIcon, MonitorIcon, PuzzleIcon,
  Trash2Icon, type AppIcon,
} from "@/components/foundations/icons/app-icons";
import type { WorkPanelViewContribution } from "@/app/plugins/slot-registry";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { toolbarIconButtonClass, toolbarIconClass } from "@/components/application/dashboard/toolbar-icon-button";
import { pluginIcon } from "@/components/application/plugins/plugin-icons";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { useWorkPanelViews } from "@/hooks/use-ui-plugins";
import { useSlotLayout } from "@/hooks/use-slot-layout";
import { cx } from "@/utils/cx";
import type { ChatPaneControls } from "./chat-pane-buttons";

const ROW = "gap-2.5 px-2 py-1.5";
const ICON = "size-[18px] shrink-0 text-foreground-icon-secondary";
const VIEW_ICONS: Partial<Record<string, AppIcon>> = { code: MonitorIcon, history: HistoryIcon, study: BookOpenIcon };

export interface ChatThreadActions {
  /** Copies the chat as text (or opens the share sheet); false when there was nothing to copy. */
  onShare: () => Promise<boolean>;
  onExport: () => void;
  onToggleUnread: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
  /** Contact-owned history is managed from the contacts workspace. */
  showThreadMenu: boolean;
  /** No chat open yet, so there is nothing to act on. */
  empty: boolean;
}

/**
 * The title bar's ⋯: the panes without their own button (环境与上下文, 历史,
 * 资料 and plugin views, in the order 设置 → 界面布局 gives them; a hidden one
 * is shown again when chosen), the open chat's actions, and the layout and
 * plugin settings.
 */
export function ChatMoreMenu({ panes, thread }: { panes?: ChatPaneControls; thread: ChatThreadActions }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const openSettings = useWorkspaceSettings();
  const entries = useWorkPanelViews();
  const slot = useSlotLayout("workPanel.view", entries);
  const views = (list: readonly WorkPanelViewContribution[]) => list.filter((entry) => entry.view !== "outline");
  const run = (action: () => void) => () => { setOpen(false); action(); };
  const icon = (entry: WorkPanelViewContribution) => entry.plugin ? pluginIcon(entry.plugin.icon) : VIEW_ICONS[entry.view] ?? EllipsisIcon;
  const share = async () => {
    if (await thread.onShare()) { setCopied(true); setTimeout(() => { setCopied(false); setOpen(false); }, 900); }
    else setOpen(false);
  };

  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label="更多" className={cx(toolbarIconButtonClass, open && "bg-background-primary-hover text-text-primary")}>
      <EllipsisIcon className={toolbarIconClass} aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="更多" placement="bottom end" className="w-[230px] p-2">
      {panes && <DropdownGroup>
        {views(slot.shown).map((entry) => {
          const Icon = icon(entry);
          return <DropdownItem key={entry.id} selected={panes.shown === entry.view} onSelect={run(() => panes.open(entry.view))} className={ROW}>
            <Icon className={ICON} aria-hidden /><span className="min-w-0 flex-1 truncate">{entry.label}</span>
          </DropdownItem>;
        })}
        {views(slot.hidden).map((entry) => {
          const Icon = icon(entry);
          return <DropdownItem key={entry.id} onSelect={run(() => { slot.show(entry); panes.open(entry.view); })} className={ROW}>
            <Icon className={ICON} aria-hidden /><span className="min-w-0 flex-1 truncate">{entry.label}</span>
            <span className="shrink-0 text-caption-1-regular text-text-tertiary">已隐藏</span>
          </DropdownItem>;
        })}
      </DropdownGroup>}
      {!thread.empty && <>
        {panes && <DropdownDivider />}
        <DropdownGroup>
          <DropdownItem onSelect={() => void share()} className={ROW}>
            {copied ? <CheckIcon className={ICON} aria-hidden /> : <CopyIcon className={ICON} aria-hidden />}{copied ? "已复制对话文本" : "复制对话文本"}
          </DropdownItem>
          {thread.showThreadMenu && <>
            <DropdownItem onSelect={run(thread.onExport)} className={ROW}><DownloadIcon className={ICON} aria-hidden />导出对话</DropdownItem>
            <DropdownItem onSelect={run(thread.onToggleUnread)} className={ROW}><MailIcon className={ICON} aria-hidden />标为未读</DropdownItem>
            <DropdownItem disabled={thread.deleteDisabled} onSelect={run(thread.onDelete)} className={cx(ROW, "text-text-error-primary")}>
              <Trash2Icon className="size-[18px] shrink-0" aria-hidden />删除对话
            </DropdownItem>
          </>}
        </DropdownGroup>
      </>}
      {panes && <>
        <DropdownDivider />
        <DropdownGroup>
          <DropdownItem onSelect={run(() => openSettings("layout"))} className={ROW}><LayoutPanelLeftIcon className={ICON} aria-hidden />界面布局设置…</DropdownItem>
          <DropdownItem onSelect={run(() => openSettings("ui-plugins"))} className={ROW}><PuzzleIcon className={ICON} aria-hidden />管理界面插件…</DropdownItem>
        </DropdownGroup>
      </>}
    </DropdownPopover>
  </Dropdown>;
}
