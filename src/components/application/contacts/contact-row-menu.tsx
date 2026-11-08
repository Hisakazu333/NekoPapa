import { RiDeleteBinLine, RiEditLine, RiMoreLine } from "@remixicon/react";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";

export function ContactRowMenu({ name, open, onOpenChange, onEdit, onDelete, disabled }: {
  name: string; open: boolean; onOpenChange: (open: boolean) => void;
  onEdit: () => void; onDelete: () => void; disabled: boolean;
}) {
  return <Dropdown isOpen={open} onOpenChange={onOpenChange}>
    <DropdownTrigger aria-label={`${name}的联系人选项`}
      isDisabled={disabled} className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground-icon-secondary opacity-100 hover:bg-background-tertiary-default hover:text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 data-[state=open]:opacity-100">
      <RiMoreLine className="size-5" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="联系人选项" placement="bottom end" className="w-[188px]">
      <DropdownItem onSelect={() => { onOpenChange(false); onEdit(); }} className="gap-3">
        <RiEditLine className="size-[18px] shrink-0" aria-hidden />编辑联系人
      </DropdownItem>
      <DropdownItem onSelect={() => { onOpenChange(false); onDelete(); }} className="gap-3 text-text-error-primary">
        <RiDeleteBinLine className="size-[18px] shrink-0" aria-hidden />删除联系人
      </DropdownItem>
    </DropdownPopover>
  </Dropdown>;
}
