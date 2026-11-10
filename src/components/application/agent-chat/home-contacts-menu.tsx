import { useState } from "react";
import { ContactIcon } from "@/components/foundations/icons/app-icons";
import type { ChatContact } from "@/app/contacts-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import { useContacts } from "@/hooks/use-contacts";

/** Selects a contact for the current workbench conversation without navigation. */
export function HomeContactsMenu({ onSelectContact, onClearContact, selectedContact }: {
  onSelectContact: (contact: ChatContact) => void;
  onClearContact: () => void;
  selectedContact?: ChatContact;
}) {
  const { contacts, notice } = useContacts();
  const [open, setOpen] = useState(false);
  const choose = (contact: ChatContact) => {
    setOpen(false);
    onSelectContact(contact);
  };
  const row = (contact: ChatContact) => <DropdownItem key={contact.id} selected={selectedContact?.id === contact.id} onSelect={() => choose(contact)} className="gap-3 rounded-xl px-3 py-2.5">
    <Avatar src={contact.avatar} initials={Array.from(contact.name).slice(-1).join("")} color={contact.avatarColor ?? "neutral"} alt="" />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
      <span className="truncate text-body-medium text-text-primary">{contact.name}</span>
      <span className="truncate text-caption-1-regular text-text-tertiary">{contact.kind === "custom" && contact.prompt ? "已设置专业提示词" : contact.tags || contact.description || "开始对话"}</span>
    </span>
  </DropdownItem>;
  const official = contacts.filter((contact) => contact.kind === "official");
  const custom = contacts.filter((contact) => contact.kind === "custom");

  return <Dropdown isOpen={open} onOpenChange={setOpen}>
    <DropdownTrigger className="chat-home__toolbar-button" aria-label={selectedContact ? `当前联系人：${selectedContact.name}，更换联系人` : "选择联系人"}>
      {selectedContact
        ? <Avatar size="xs" src={selectedContact.avatar} initials={Array.from(selectedContact.name).slice(-1).join("")} color={selectedContact.avatarColor ?? "neutral"} alt="" />
        : <ContactIcon aria-hidden />}
      <span className="max-w-[112px] truncate" title={selectedContact?.name}>{selectedContact?.name ?? "联系人"}</span><ChevronDownSmall className="chat-home__chevron" />
    </DropdownTrigger>
    {/* The panel itself scrolls (React Aria caps it to the room on screen); an
        inner scroller here would swallow the wheel without moving. */}
    <DropdownPopover aria-label="选择联系人聊天" placement="bottom end" className="w-[300px] max-w-[calc(100vw-24px)] overscroll-contain rounded-3xl">
      <DropdownGroup label="对话对象">
        <DropdownItem selected={!selectedContact} onSelect={() => { setOpen(false); onClearContact(); }} className="rounded-xl px-3 py-2.5">
          {selectedContact ? "工作台对话（不选择联系人）" : "工作台对话"}
        </DropdownItem>
      </DropdownGroup>
      <DropdownGroup label="官方同伴">{official.map(row)}</DropdownGroup>
      {custom.length > 0 && <DropdownGroup label="我的联系人">{custom.map(row)}</DropdownGroup>}
      {notice && <p role="status" className="px-3 py-2 text-caption-1-regular text-text-secondary">{notice}</p>}
    </DropdownPopover>
  </Dropdown>;
}
