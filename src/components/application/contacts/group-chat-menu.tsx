import { useState } from "react";
import { RiDeleteBinLine, RiMoreLine } from "@remixicon/react";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";

export function GroupChatMenu({ title, onDelete }: { title: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger aria-label={`${title}的群聊选项`}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground-icon-secondary hover:bg-background-tertiary-default hover:text-text-primary">
      <RiMoreLine className="size-5" aria-hidden />
    </DropdownTrigger>
    <DropdownPopover aria-label="群聊选项" placement="bottom end" className="w-[188px]">
      <DropdownItem onSelect={() => { setOpen(false); onDelete(); }} className="gap-3 text-text-error-primary">
        <RiDeleteBinLine className="size-[18px] shrink-0" aria-hidden />删除群聊
      </DropdownItem>
    </DropdownPopover>
  </Dropdown>;
}
