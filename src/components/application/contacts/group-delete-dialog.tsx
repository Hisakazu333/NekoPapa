import { useRef, useState } from "react";
import type { GroupChat } from "@/app/contacts/group-chat-store";
import { AlertDialog } from "@/components/base/modal/modal";
import { useGroupChats } from "@/hooks/use-group-chats";

export function GroupDeleteDialog({ group, onClose, onDeleted }: {
  group: GroupChat;
  onClose: (deleted: boolean) => void;
  onDeleted: (groupId: string) => void;
}) {
  const { removeGroup } = useGroupChats();
  const [error, setError] = useState("");
  const deleted = useRef(false);
  return <AlertDialog isOpen title="删除群聊？" description={`将删除「${group.title}」及其聊天记录，无法恢复。联系人及其单独聊天不受影响。`}
    confirmLabel={error ? "重试删除" : "删除群聊"} cancelLabel="取消" pendingLabel="正在删除…"
    onOpenChange={(open) => { if (!open) onClose(deleted.current); }}
    onConfirm={async () => {
      if (!removeGroup(group.id)) {
        setError("删除失败，原记录已保留。请检查本机存储后重试。");
        throw new Error("Group deletion failed");
      }
      deleted.current = true;
      onDeleted(group.id);
    }}>
    {error && <p role="alert" className="text-body-regular text-text-error-primary">{error}</p>}
  </AlertDialog>;
}
