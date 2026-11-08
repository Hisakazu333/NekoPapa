import { useState } from "react";
import { RiAddLine, RiGroupLine, RiUserAddLine } from "@remixicon/react";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";

/** Contact creation and group chat actions share one compact anchored menu. */
export function ContactActionsMenu({ onCreate, onStartGroup, disabled }: {
  onCreate: () => void;
  onStartGroup: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label="新增联系人或聊天" isDisabled={disabled}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground-icon-secondary transition-colors hover:bg-background-tertiary-default hover:text-text-primary disabled:opacity-50">
      <RiAddLine className="size-5" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="新增联系人或聊天" placement="bottom end" className="w-[208px] max-w-[calc(100vw-24px)]" dialogClassName="gap-0.5">
        <DropdownItem onSelect={() => { close(); onCreate(); }} className="gap-3 px-3 py-2.5">
          <RiUserAddLine className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium">新建联系人</span>
        </DropdownItem>
        <DropdownItem onSelect={() => { close(); onStartGroup(); }} className="gap-3 px-3 py-2.5">
          <RiGroupLine className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="text-body-medium">发起群聊</span>
        </DropdownItem>
    </DropdownPopover>
  </Dropdown>;
}
