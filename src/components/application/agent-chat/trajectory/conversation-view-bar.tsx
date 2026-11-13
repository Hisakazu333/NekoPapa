import { useState } from "react";
import { EllipsisIcon, MessagesSquareIcon, PuzzleIcon, WorkflowIcon } from "@/components/foundations/icons/app-icons";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { toolbarIconButtonClass, toolbarIconClass } from "@/components/application/dashboard/toolbar-icon-button";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { cx } from "@/utils/cx";

export type ConversationView = "chat" | "trace";

/**
 * The open chat's views (docs/plugin-slots.md, `conversation.view`): 对话
 * (the transcript) and 轨迹 (what happened, step by step), both of the same
 * chat; switching never opens another chat or changes the title-bar tab.
 * ⋯ leads to the interface plugins, where later plugin views will come from.
 */
export function ConversationViewBar({ view, onChange }: { view: ConversationView; onChange: (view: ConversationView) => void }) {
  const [open, setOpen] = useState(false);
  const openSettings = useWorkspaceSettings();
  // Below lg the chat's navigation button floats at the top start (ChatWorkspaceHeader, compact); keep clear of it.
  return <div className="flex shrink-0 items-center gap-1 px-4 pt-2 max-lg:ps-14 max-lg:pt-3">
    <PillTabList role="group" aria-label="会话视图" className="gap-0.5">
      <PillTab variant="gray" icon={MessagesSquareIcon} isSelected={view === "chat"} onSelect={() => onChange("chat")}>对话</PillTab>
      <PillTab variant="gray" icon={WorkflowIcon} isSelected={view === "trace"} onSelect={() => onChange("trace")}>轨迹</PillTab>
    </PillTabList>
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger aria-label="更多会话视图" className={cx(toolbarIconButtonClass, open && "bg-background-primary-hover text-text-primary")}>
        <EllipsisIcon className={toolbarIconClass} aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label="更多会话视图" placement="bottom start" className="w-[230px] p-2">
        <DropdownItem onSelect={() => { setOpen(false); openSettings("ui-plugins"); }} className="gap-2.5 px-2 py-1.5">
          <PuzzleIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />管理界面插件…
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  </div>;
}
