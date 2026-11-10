import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { FolderIcon, FolderOpenIcon, PinFilledIcon, PlusIcon, SquarePenIcon } from "@/components/foundations/icons/app-icons";
import type { Project } from "@/app/projects";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { ProjectFolderForm } from "@/components/application/agent-chat/project-folder-form";
import { ProjectRowMenu } from "@/components/application/projects/project-row-menu";
import { useProjectFolderChooser } from "@/hooks/use-project-folder-chooser";
import { useProjects } from "@/hooks/use-projects";
import { toast } from "@/components/base/toast/toast";
import { cx } from "@/utils/cx";
import type { RecentProjectGroup } from "./sidebar-recent-groups";
import { RecentConversationRow, type RowActions } from "./recent-conversation-row";
import { Collapsible } from "./sidebar-navigation";

const ICON_BUTTON = "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * "+" beside the 对话 heading: adds a project from a folder without starting
 * a chat. The desktop app opens the system folder picker directly; the
 * browser preview asks for the path in a popover. Both check the folder
 * exists first; a folder that already belongs to a project is not added twice.
 */
export function AddProjectFolderButton() {
  const { addFolder, notice } = useProjects();
  const chooser = useProjectFolderChooser();
  const [open, setOpen] = useState(false);
  const announce = (folder: string) => {
    const { project, created } = addFolder(folder);
    if (project) toast.success(created ? "已添加项目" : "这个文件夹已在项目中", { description: `${project.name} · ${folder}` });
    return Boolean(project);
  };
  if (chooser.desktop) {
    return <AriaButton aria-label="添加项目文件夹" isDisabled={chooser.picking} className={ICON_BUTTON}
      onPress={() => void chooser.pick().then(({ folder, error }) => {
        if (folder) announce(folder);
        else if (error) toast.error("没有添加项目", { description: error });
      })}>
      <PlusIcon className="size-4" aria-hidden />
    </AriaButton>;
  }
  return <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
    <AriaButton aria-label="添加项目文件夹" className={cx(ICON_BUTTON, open && "bg-background-tertiary-default")}>
      <PlusIcon className="size-4" aria-hidden />
    </AriaButton>
    <Popover aria-label="添加项目文件夹" placement="bottom start" className="w-[300px]" dialogClassName="p-2.5 outline-none">
      <ProjectFolderForm autoFocus notice={notice} onSubmitFolder={async (path) => {
        const { folder, error } = await chooser.check(path);
        if (error || !folder) return error ?? "无法使用这个文件夹路径。";
        if (!announce(folder)) return "无法使用这个文件夹路径。";
        setOpen(false);
        return undefined;
      }} />
    </Popover>
  </PopoverTrigger>;
}

/**
 * A project row that expands into an indented tree of its chats, like
 * BoardUI's repository list. Hovering reveals the "…" menu (pin, edit,
 * remove) and "new chat in this project".
 */
export function ProjectFolderGroup({ group, open, onToggle, actions, onNewChat, onShowAll, onEdit, onRemove }: {
  group: RecentProjectGroup;
  open: boolean;
  onToggle: (open: boolean) => void;
  actions: RowActions;
  onNewChat: (projectId: string) => void;
  onShowAll: () => void;
  onEdit: (project: Project) => void;
  onRemove: (project: Project) => void;
}) {
  const { togglePinned } = useProjects();
  const [menuOpen, setMenuOpen] = useState(false);
  const { project } = group;
  const listId = `recent-project-${project.id}`;
  const showChildren = open && !actions.collapsed;
  const ProjectFolderIcon = showChildren ? FolderOpenIcon : FolderIcon;
  const reveal = cx("opacity-0 focus-visible:opacity-100 group-hover/folder:opacity-100 group-focus-within/folder:opacity-100", menuOpen && "opacity-100");
  return <div className="flex min-w-0 flex-col">
    <div className="group/folder relative flex min-w-0 items-center rounded-2lg hover:bg-background-secondary-hover/60">
      <button type="button" aria-expanded={showChildren} aria-controls={showChildren ? listId : undefined}
        aria-label={`项目：${project.name}`} title={project.folders.join("\n")} onClick={() => onToggle(!open)}
        className={cx(
          "flex min-w-0 cursor-pointer items-center gap-2 rounded-2lg p-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          actions.collapsed ? "w-9" : "w-full pe-16",
        )}>
        <ProjectFolderIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <Collapsible collapsed={actions.collapsed} className="flex-1 gap-1.5">
          <span translate="no" className="truncate text-body-medium text-text-secondary">{project.name}</span>
          {project.pinned && <PinFilledIcon className="size-3 shrink-0 text-foreground-icon-tertiary" aria-label="已置顶" />}
        </Collapsible>
      </button>
      {!actions.collapsed && <span className="absolute end-1.5 flex items-center gap-0.5">
        <ProjectRowMenu project={project} isOpen={menuOpen} onOpenChange={setMenuOpen} className={reveal}
          onTogglePinned={() => togglePinned(project.id)} onEdit={() => onEdit(project)} onRemove={() => onRemove(project)} />
        <button type="button" aria-label={`在${project.name}中新建对话`} title="在此项目中新建对话" disabled={actions.busy}
          onClick={() => onNewChat(project.id)} className={cx(ICON_BUTTON, reveal)}>
          <SquarePenIcon className="size-4" aria-hidden />
        </button>
      </span>}
    </div>
    {showChildren && <ul id={listId} aria-label={`${project.name} 中的对话`} className="ms-[17px] flex flex-col gap-0.5 border-s border-border-button-default py-0.5 ps-2">
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
