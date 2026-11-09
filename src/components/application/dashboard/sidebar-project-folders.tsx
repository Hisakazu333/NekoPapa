import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { RiAddLine, RiChatNewLine, RiFolder3Line, RiFolderOpenLine } from "@remixicon/react";
import { projectFolderName } from "@/app/project-folders";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ProjectFolderForm } from "@/components/application/agent-chat/project-folder-form";
import { useProjectFolders } from "@/hooks/use-project-folders";
import { cx } from "@/utils/cx";
import type { RecentProjectGroup } from "./sidebar-recent-groups";
import { RecentConversationRow, type RowActions } from "./recent-conversation-row";
import { Collapsible } from "./sidebar-navigation";

const ICON_BUTTON = "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50";

/** "+" beside the 项目 heading: adds a folder to the shared recent list without starting a chat. */
export function AddProjectFolderButton() {
  const { remember, notice } = useProjectFolders();
  const [open, setOpen] = useState(false);
  return <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
    <AriaButton aria-label="添加项目文件夹" className={cx(ICON_BUTTON, open && "bg-background-tertiary-default")}>
      <RiAddLine className="size-4" aria-hidden />
    </AriaButton>
    <Popover aria-label="添加项目文件夹" placement="bottom start" className="w-[300px]" dialogClassName="p-2.5 outline-none">
      <ProjectFolderForm notice={notice} onSubmitFolder={(folder) => {
        const added = Boolean(remember(folder));
        if (added) setOpen(false);
        return added;
      }} />
    </Popover>
  </PopoverTrigger>;
}

/**
 * A project folder row that expands into an indented tree of its chats, like
 * BoardUI's repository list. Hovering reveals "new chat in this folder".
 */
export function ProjectFolderGroup({ group, open, onToggle, actions, onNewChat, onShowAll }: {
  group: RecentProjectGroup;
  open: boolean;
  onToggle: (open: boolean) => void;
  actions: RowActions;
  onNewChat: (folder: string) => void;
  onShowAll: () => void;
}) {
  const name = projectFolderName(group.folder);
  const listId = `recent-project-${encodeURIComponent(group.folder)}`;
  const showChildren = open && !actions.collapsed;
  const FolderIcon = showChildren ? RiFolderOpenLine : RiFolder3Line;
  return <div className="flex min-w-0 flex-col">
    <div className="group/folder relative flex min-w-0 items-center rounded-2lg hover:bg-background-secondary-hover/60">
      <button type="button" aria-expanded={showChildren} aria-controls={showChildren ? listId : undefined}
        aria-label={`项目文件夹：${name}`} title={group.folder} onClick={() => onToggle(!open)}
        className={cx(
          "flex min-w-0 cursor-pointer items-center gap-2 rounded-2lg p-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          actions.collapsed ? "w-9" : "w-full pe-9",
        )}>
        <FolderIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <Collapsible collapsed={actions.collapsed} className="flex-1">
          <span translate="no" className="truncate text-body-medium text-text-secondary">{name}</span>
        </Collapsible>
      </button>
      {!actions.collapsed && <button type="button" aria-label={`在${name}中新建对话`} title="在此项目中新建对话" disabled={actions.busy}
        onClick={() => onNewChat(group.folder)}
        className={cx(ICON_BUTTON, "absolute end-1.5 opacity-0 focus-visible:opacity-100 group-hover/folder:opacity-100")}>
        <RiChatNewLine className="size-4" aria-hidden />
      </button>}
    </div>
    {showChildren && <ul id={listId} aria-label={`${name} 中的对话`} className="ms-[17px] flex flex-col gap-0.5 border-s border-border-button-default py-0.5 ps-2">
      {group.threads.map((thread) => <li key={thread.id} className="relative before:absolute before:-start-2 before:top-1/2 before:w-1.5 before:border-t before:border-border-button-default">
        <RecentConversationRow thread={thread} actions={actions} nested />
      </li>)}
      {group.threads.length === 0 && <li className="px-2 py-1.5 text-body-2-regular text-text-tertiary">还没有对话</li>}
      {group.hidden > 0 && <li><button type="button" onClick={onShowAll}
        className="w-full cursor-pointer rounded-2lg px-2 py-1.5 text-start text-body-2-medium text-text-tertiary hover:bg-background-secondary-hover/60 hover:text-text-secondary">
        还有 {group.hidden} 个对话
      </button></li>}
    </ul>}
  </div>;
}
