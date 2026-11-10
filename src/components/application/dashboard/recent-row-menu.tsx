import { EllipsisVerticalIcon, MailCheckIcon, MailOpenIcon, PencilIcon, Trash2Icon } from "@/components/foundations/icons/app-icons";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import {
  Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { cx } from "@/utils/cx";

/** Row "…" menu for a recent chat; it overlays the age badge, which fades out on hover. */
export function RecentRowMenu({ thread, isOpen, onOpenChange, onRename, onToggleUnread, deleteDisabled, onDelete }: {
  thread: StoredThread;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onToggleUnread: () => void;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  const localize = useTemplateCopy();
  const choose = (action: () => void) => () => { onOpenChange(false); action(); };
  const label = thread.unread ? "标为已读" : "标为未读";
  const ReadIcon = thread.unread ? MailCheckIcon : MailOpenIcon;

  return localize(<Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
    <DropdownTrigger
      aria-label={`更多操作：${thread.title}`}
      className={cx(
        "absolute end-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-foreground-icon-secondary transition-colors duration-150 ease",
        "opacity-0 hover:bg-background-tertiary-default hover:text-foreground-icon-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-border-focus-ring group-hover/recent:opacity-100 group-focus-within/recent:opacity-100",
        isOpen && "bg-background-tertiary-default text-foreground-icon-primary opacity-100",
      )}
    >
      <EllipsisVerticalIcon className="size-4" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label={`更多操作：${thread.title}`} placement="bottom end" className="w-[190px] p-2">
      <DropdownGroup>
        <DropdownItem onSelect={choose(onRename)} className="px-2 py-1.5">
          <PencilIcon className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">重命名</span>
        </DropdownItem>
        <DropdownItem onSelect={choose(onToggleUnread)} className="px-2 py-1.5">
          <ReadIcon className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium text-text-primary">{label}</span>
        </DropdownItem>
        <DropdownItem disabled={deleteDisabled} onSelect={choose(onDelete)} className="px-2 py-1.5">
          <Trash2Icon className="size-4 text-text-error-primary" aria-hidden />
          <span className="text-body-medium text-text-error-primary">删除对话</span>
        </DropdownItem>
      </DropdownGroup>
    </DropdownPopover>
  </Dropdown>);
}
