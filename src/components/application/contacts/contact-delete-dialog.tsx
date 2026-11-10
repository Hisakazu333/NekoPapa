import { useRef, useState } from "react";
import type { ChatContact } from "@/app/contacts/contacts-store";
import { AlertDialog } from "@/components/base/modal/modal";
import { useContacts } from "@/hooks/use-contacts";
import { useChatHistory } from "@/hooks/use-chat-history";

export function ContactDeleteDialog({ contact, onClose, onDeleted }: {
  contact: ChatContact;
  onClose: (deleted: boolean) => void;
  onDeleted: (contactId: string) => void;
}) {
  const { removeContact } = useContacts();
  const { removeContactThreads } = useChatHistory();
  const [error, setError] = useState("");
  const deleted = useRef(false);
  return <AlertDialog isOpen title="删除联系人？" description={`将删除「${contact.name}」及其单独聊天记录，无法恢复。已有群聊及其中的消息保留。`}
    confirmLabel={error ? "重试删除" : "删除联系人"} cancelLabel="取消" pendingLabel="正在删除…"
    onOpenChange={(open) => { if (!open) onClose(deleted.current); }}
    onConfirm={async () => {
      if (!removeContact(contact.id)) {
        setError("删除失败，联系人和聊天记录已保留。请检查本机存储后重试。");
        throw new Error("Contact deletion failed");
      }
      deleted.current = true;
      onDeleted(contact.id);
      if (!removeContactThreads(contact.id)) {
        setError("联系人已移除，单独聊天记录尚未完成清理。请重试；原有群聊保留。");
        throw new Error("Contact history deletion failed");
      }
    }}>
    {error && <p role="alert" className="text-body-regular text-text-error-primary">{error}</p>}
  </AlertDialog>;
}
