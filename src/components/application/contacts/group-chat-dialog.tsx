import { useState } from "react";
import { UsersIcon } from "@/components/foundations/icons/app-icons";
import type { ChatContact } from "@/app/contacts-store";
import type { GroupChat } from "@/app/group-chat-store";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/base/modal/modal";
import { useContacts } from "@/hooks/use-contacts";
import { useGroupChats } from "@/hooks/use-group-chats";

export function GroupChatDialog({ initialContactId, onClose, onStart, onSelectContact }: {
  initialContactId?: string;
  onClose: () => void; onStart: (group: GroupChat) => void; onSelectContact: (contact: ChatContact) => void;
}) {
  const { contacts } = useContacts();
  const { createGroup } = useGroupChats();
  const candidates = contacts.filter((contact) => contact.kind === "custom");
  const [selected, setSelected] = useState<string[]>(() => candidates.some((contact) => contact.id === initialContactId) ? [initialContactId!] : []);
  const [error, setError] = useState("");
  const start = () => {
    const members = selected.map((id) => candidates.find((contact) => contact.id === id)).filter((contact): contact is ChatContact => !!contact);
    if (members.length === 1) { onSelectContact(members[0]); onClose(); return; }
    const result = createGroup(members);
    if (result.error) setError(result.error);
    else if (result.group) { onStart(result.group); onClose(); }
  };
  return <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}>
    <ModalHeader title="与联系人聊天" description="从自建联系人中选择 2–5 位建立群聊；选择一位则继续单独对话。官方人物仅用于单人陪伴聊天和学习。" icon={UsersIcon} closeLabel="取消选择联系人" />
    <ModalBody>
      <div className="flex max-h-[50dvh] flex-col gap-1 overflow-y-auto" aria-label="选择群聊成员">
        {candidates.length === 0 && <p role="status" className="px-3 py-6 text-body-regular text-text-secondary">还没有自建联系人。可先关闭此窗口，从联系人列表顶部新增。</p>}
        {candidates.map((contact) => <Checkbox key={contact.id} aria-label={`选择${contact.name}`} isSelected={selected.includes(contact.id)}
          isDisabled={!selected.includes(contact.id) && selected.length >= 5} className="w-full rounded-xl p-3 hover:bg-background-secondary-hover"
          onChange={(checked) => { setError(""); setSelected((current) => checked ? [...current, contact.id] : current.filter((id) => id !== contact.id)); }}>
          <span className="flex min-w-0 items-center gap-3">
            <Avatar src={contact.avatar} initials={Array.from(contact.name).slice(-1).join("")} color={contact.avatarColor ?? "neutral"} alt="" />
            <span className="min-w-0 flex-1"><span className="block truncate text-body-medium">{contact.name}</span><span className="block truncate text-caption-1-regular text-text-tertiary">{contact.description}</span></span>
          </span>
        </Checkbox>)}
      </div>
      <p className="mt-3 text-caption-1-regular text-text-secondary">已选 {selected.length}/5{selected.length > 0 ? ` · ${selected.map((id) => contacts.find((contact) => contact.id === id)?.name).join(" → ")}` : ""}</p>
      {error && <p role="alert" className="mt-2 text-body-regular text-text-error-primary">{error}</p>}
    </ModalBody>
    <ModalFooter><Button variant="secondary" onClick={onClose}>取消</Button><Button disabled={selected.length === 0} onClick={start}>{selected.length === 1 ? "继续对话" : "创建群聊"}</Button></ModalFooter>
  </Modal>;
}
