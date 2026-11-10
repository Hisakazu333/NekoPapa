import { EllipsisIcon, PencilIcon, PinIcon, PinOffIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import {
  Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import type { Project } from "@/app/projects/projects";
import { cx } from "@/utils/cx";

/** "…" menu on a sidebar project row: pin, edit, remove. */
export function ProjectRowMenu({ project, isOpen, onOpenChange, onTogglePinned, onEdit, onRemove, className }: {
  project: Project;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTogglePinned: () => void;
  onEdit: () => void;
  onRemove: () => void;
  className?: string;
}) {
  const localize = useTemplateCopy();
  const choose = (action: () => void) => () => { onOpenChange(false); action(); };
  const PinToggleIcon = project.pinned ? PinOffIcon : PinIcon;

  return localize(<Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
    <DropdownTrigger aria-label={`项目操作：${project.name}`} className={cx(
      "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-icon-secondary outline-none hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      isOpen && "bg-background-tertiary-default text-foreground-icon-primary",
      className,
    )}>
      <EllipsisIcon className="size-4" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label={`项目操作：${project.name}`} placement="bottom end" className="w-[190px] p-2">
      <DropdownGroup>
        <DropdownItem onSelect={choose(onTogglePinned)} className="px-2 py-1.5">
          <PinToggleIcon className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">{project.pinned ? "取消置顶" : "置顶"}</span>
        </DropdownItem>
        <DropdownItem onSelect={choose(onEdit)} className="px-2 py-1.5">
          <PencilIcon className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">编辑</span>
        </DropdownItem>
      </DropdownGroup>
      <DropdownDivider />
      <DropdownGroup>
        <DropdownItem onSelect={choose(onRemove)} className="px-2 py-1.5">
          <XIcon className="size-4 text-text-error-primary" aria-hidden />
          <span className="text-body-medium text-text-error-primary">移除项目</span>
        </DropdownItem>
      </DropdownGroup>
    </DropdownPopover>
  </Dropdown>);
}
