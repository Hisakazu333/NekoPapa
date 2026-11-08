import { useCallback, useMemo } from "react";
import { RiChatAiLine, RiContactsLine } from "@remixicon/react";
import { settingsSections, type SettingsSection } from "@/components/application/settings/workspace-settings-catalog";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { StoredThread } from "./thread-storage";
import type { ChatContact } from "@/app/contacts-store";
import { DashboardRecentConversations } from "@/components/application/dashboard/dashboard-recent-conversations";
import { buildSidebarSearchEntries, type SidebarSearchEntry } from "@/components/application/dashboard/sidebar-search";
import type { DashboardNavItem } from "@/components/application/dashboard/sidebar-navigation";

export function useAgentChatSidebar({
  setPage, setRequestedContactId, setNavOpen, activeContactId, activeId,
  threads, contacts, busy, onSelectThread, onShowAllThreads,
  onRenameThread, onToggleUnread, onDeleteThread,
}: {
  setPage: (page: "chat" | "contacts") => void;
  setRequestedContactId: (id: string | undefined) => void;
  setNavOpen: (open: boolean) => void;
  activeContactId?: string;
  activeId: string;
  threads: StoredThread[];
  contacts: ChatContact[];
  busy: boolean;
  onSelectThread: (id: string) => void;
  onShowAllThreads: () => void;
  onRenameThread: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  onDeleteThread: (id: string) => boolean;
}) {
  const openSettings = useWorkspaceSettings();
  const items: DashboardNavItem[] = useMemo(() => [
    { key: "chat", label: "工作台", icon: RiChatAiLine, href: "/", onSelect: () => { setPage("chat"); setNavOpen(false); } },
    { key: "contacts", label: "联系人", icon: RiContactsLine, href: "#contacts", onSelect: () => { setRequestedContactId(activeContactId); setPage("contacts"); setNavOpen(false); } },
  ], [activeContactId, setNavOpen, setPage, setRequestedContactId]);
  const entries = useMemo(() => buildSidebarSearchEntries({
    navigation: items, threads, contacts,
    settings: Object.entries(settingsSections).map(([id, entry]) => ({ id, ...entry })),
  }), [contacts, items, threads]);
  const onSearchSelect = useCallback((entry: SidebarSearchEntry) => {
    const target = entry.target;
    if (target.type === "setting") {
      openSettings(target.section as SettingsSection);
    } else if (target.type === "thread") {
      const thread = threads.find((item) => item.id === target.id);
      if (!thread) return false;
      if (thread.contact) {
        if (!contacts.some((contact) => contact.id === thread.contact?.id)) return false;
        setRequestedContactId(thread.contact.id);
        setPage("contacts");
      } else {
        if (busy) return false;
        onSelectThread(thread.id);
        setPage("chat");
      }
    } else if (target.type === "contact") {
      if (!contacts.some((contact) => contact.id === target.id)) return false;
      setRequestedContactId(target.id);
      setPage("contacts");
    } else if (target.key === "contacts") {
      setRequestedContactId(activeContactId);
      setPage("contacts");
    } else {
      setPage("chat");
    }
    setNavOpen(false);
    return true;
  }, [activeContactId, busy, contacts, onSelectThread, openSettings, setNavOpen, setPage, setRequestedContactId, threads]);
  const onSelectRecent = useCallback((thread: StoredThread) => {
    if (thread.contact) {
      if (!contacts.some((contact) => contact.id === thread.contact?.id)) return false;
      setRequestedContactId(thread.contact.id);
      setPage("contacts");
    } else {
      if (busy) return false;
      onSelectThread(thread.id);
      setPage("chat");
    }
    setNavOpen(false);
    return true;
  }, [busy, contacts, onSelectThread, setNavOpen, setPage, setRequestedContactId]);
  const children = useCallback((collapsed: boolean) => <DashboardRecentConversations
    threads={threads} collapsed={collapsed} activeId={activeId} onSelect={onSelectRecent} onShowAll={onShowAllThreads}
    onRename={onRenameThread} onToggleUnread={onToggleUnread} onDelete={onDeleteThread} busy={busy} />,
  [activeId, busy, onDeleteThread, onRenameThread, onSelectRecent, onShowAllThreads, onToggleUnread, threads]);

  return { items, searchEntries: entries, onSearchSelect, children };
}
