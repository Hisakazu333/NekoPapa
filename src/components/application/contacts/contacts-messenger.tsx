import { MessageCircleHeartIcon } from "@/components/foundations/icons/app-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useContacts } from "@/hooks/use-contacts";
import { useGroupChats } from "@/hooks/use-group-chats";
import type { GroupChat } from "@/app/group-chat-store";
import { GroupChatDialog } from "./group-chat-dialog";
import { GroupConversation } from "./group-conversation";
import { GroupDeleteDialog } from "./group-delete-dialog";
import { ContactDeleteDialog } from "./contact-delete-dialog";
import { ChatWorkspaceSplit } from "../agent-chat/chat-workspace-split";
import { AgentProfilePanel } from "./agent-profile-panel";
import type { useChatProvider } from "../agent-chat/use-chat-provider";
import { ContactConversation } from "./contact-conversation";
import { contactPreviews, findContactThread } from "./contact-conversations";
import { ContactsWorkspace, type ChatContact, type ContactPreview } from "./contacts-workspace";

export function ContactsMessenger({ onNavigate, provider, requestedContactId, onContactOpened }: { onNavigate: () => void; provider: ReturnType<typeof useChatProvider>; requestedContactId?: string; onContactOpened?: () => void }) {
  const history = useChatHistory();
  const { contacts, deletedIds } = useContacts();
  const groupHistory = useGroupChats();
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupInitialContactId, setGroupInitialContactId] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<GroupChat>();
  const [deleteContactTarget, setDeleteContactTarget] = useState<ChatContact>();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openedGroups, setOpenedGroups] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [draft, setDraft] = useState<ChatContact>();
  const [opened, setOpened] = useState<ChatContact[]>([]);
  const [livePreviews, setLivePreviews] = useState<Record<string, ContactPreview>>({});
  const previews = useMemo(() => {
    const current = contactPreviews(history.threads);
    // Settled previews follow shared history, including updates from another window.
    for (const [id, preview] of Object.entries(livePreviews)) {
      if (preview.busy) current[id] = preview;
    }
    return current;
  }, [history.threads, livePreviews]);
  const onPreview = useCallback((id: string, preview: ContactPreview) => {
    setLivePreviews((current) => {
      const old = current[id];
      return old?.text === preview.text && old?.updatedAt === preview.updatedAt && old?.busy === preview.busy ? current : { ...current, [id]: preview };
    });
  }, []);
  const select = (contact: ChatContact) => {
    setDraft(undefined);
    setOpened((current) => current.some((item) => item.id === contact.id) ? current : [...current, contact]);
    setSelectedId(contact.id);
  };
  const startGroup = (initialContactId?: string) => {
    setGroupInitialContactId(initialContactId);
    setGroupDialog(true);
  };
  const closeGroupDialog = () => {
    setGroupDialog(false);
    setGroupInitialContactId(undefined);
  };
  const selected = contacts.find((contact) => contact.id === selectedId);
  const editorContact = draft ?? selected;
  const closeEditor = () => {
    setProfileOpen(false);
    if (draft) {
      setDraft(undefined);
      if (selectedId === draft.id) setSelectedId(undefined);
    }
  };
  const create = () => {
    setDraft({ id: `draft-${crypto.randomUUID()}`, kind: "custom", name: "", description: "" });
    setProfileOpen(true);
  };
  const selectGroup = (group: GroupChat) => {
    setDraft(undefined); setProfileOpen(false); setSelectedId(group.id);
    setOpenedGroups((current) => current.includes(group.id) ? current : [...current, group.id]);
  };
  // Removing a group in any entry point also unmounts its running conversation.
  useEffect(() => {
    if (!groupHistory.ready) return;
    const remaining = new Set(groupHistory.groups.map((group) => group.id));
    setOpenedGroups((current) => current.every((id) => remaining.has(id)) ? current : current.filter((id) => remaining.has(id)));
    if (selectedId && openedGroups.includes(selectedId) && !remaining.has(selectedId)) setSelectedId(undefined);
  }, [groupHistory.ready, groupHistory.groups, openedGroups, selectedId]);
  useEffect(() => {
    if (!deletedIds.length) return;
    setOpened((current) => current.some((contact) => deletedIds.includes(contact.id)) ? current.filter((contact) => !deletedIds.includes(contact.id)) : current);
    if (selectedId && deletedIds.includes(selectedId)) { setSelectedId(undefined); setProfileOpen(false); }
  }, [deletedIds, selectedId]);
  useEffect(() => {
    if (!requestedContactId || !history.ready) return;
    const contact = contacts.find((item) => item.id === requestedContactId);
    if (contact) {
      setOpened((current) => current.some((item) => item.id === contact.id) ? current : [...current, contact]);
      setSelectedId(contact.id);
      setDraft(undefined);
    }
    onContactOpened?.();
  }, [requestedContactId, history.ready, contacts, onContactOpened]);

  return <ChatWorkspaceSplit mainMinWidth={560} panelOpen={profileOpen && Boolean(editorContact)} onClose={closeEditor} panelId="contact-profile-panel" panelLabel={editorContact?.kind === "official" ? "联系人资料" : "联系人设置"} resizeLabel="调整联系人资料区宽度" panel={editorContact && <AgentProfilePanel contact={editorContact} creating={Boolean(draft)} onClose={closeEditor} onCreated={(contact) => { setSearchQuery(""); select(contact); setProfileOpen(false); }} />}>
    <ContactsWorkspace onSelect={select} onCreate={() => create()} onStartGroup={() => startGroup()} groups={groupHistory.groups} onSelectGroup={selectGroup} onDeleteGroup={setDeleteTarget} onDeleteContact={setDeleteContactTarget} onEditContact={(contact) => { select(contact); setProfileOpen(true); }} searchInputRef={searchInputRef} selectedId={selectedId} previews={previews} onNavigate={onNavigate} disabled={!history.ready} query={searchQuery} onQueryChange={setSearchQuery} groupNotice={groupHistory.error} onRetryGroups={groupHistory.retry}>
    {draft && <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-8 text-center"><MessageCircleHeartIcon className="size-14 text-foreground-icon-secondary" aria-hidden /><h1 className="text-headline-semibold text-text-primary">{draft.name || "新的联系人"}</h1><p className="text-body-regular text-text-tertiary">完成右侧设定，开启你们的第一段对话。</p></div>}
    {!selectedId && !draft && <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-background-secondary-default text-text-tertiary">
      <MessageCircleHeartIcon className="size-12 opacity-30" aria-hidden />
      <p className="text-body-regular">选择一位联系人，开始聊天</p>
    </div>}
    {history.ready && opened.filter((snapshot) => !deletedIds.includes(snapshot.id)).map((snapshot) => { const contact = contacts.find((item) => item.id === snapshot.id) ?? snapshot; return <div key={contact.id} hidden={Boolean(draft) || selectedId !== contact.id} style={{ display: !draft && selectedId === contact.id ? "flex" : "none" }} className="h-full min-h-0 min-w-0 flex-1">
      <ContactConversation contact={contact} initialThread={findContactThread(history.threads, contact.id)} provider={provider} active={selectedId === contact.id}
        onBack={() => setSelectedId(undefined)} onOpenProfile={() => setProfileOpen(true)} onStartGroup={() => startGroup(contact.id)} onDelete={() => setDeleteContactTarget(contact)} onPreview={onPreview} />
    </div>; })}
    {openedGroups.filter((id) => groupHistory.groups.some((group) => group.id === id)).map((id) => <div key={id} hidden={Boolean(draft) || selectedId !== id} style={{ display: !draft && selectedId === id ? "flex" : "none" }} className="h-full min-h-0 min-w-0 flex-1"><GroupConversation groupId={id} provider={provider} onBack={() => setSelectedId(undefined)} onDelete={setDeleteTarget} /></div>)}
    </ContactsWorkspace>
    {groupDialog && <GroupChatDialog initialContactId={groupInitialContactId} onClose={closeGroupDialog} onSelectContact={select} onStart={selectGroup} />}
    {deleteTarget && <GroupDeleteDialog group={deleteTarget} onDeleted={(id) => {
      setOpenedGroups((current) => current.filter((groupId) => groupId !== id));
      if (selectedId === id) setSelectedId(undefined);
    }} onClose={(deleted) => {
      setDeleteTarget(undefined);
      if (deleted || !groupHistory.groups.some((group) => group.id === deleteTarget.id)) requestAnimationFrame(() => searchInputRef.current?.focus());
    }} />}
    {deleteContactTarget && <ContactDeleteDialog contact={deleteContactTarget} onDeleted={(id) => {
      setOpened((current) => current.filter((contact) => contact.id !== id));
      if (selectedId === id) { setSelectedId(undefined); setProfileOpen(false); }
    }} onClose={(deleted) => {
      setDeleteContactTarget(undefined);
      if (deleted || deletedIds.includes(deleteContactTarget.id)) requestAnimationFrame(() => searchInputRef.current?.focus());
    }} />}
  </ChatWorkspaceSplit>;
}
