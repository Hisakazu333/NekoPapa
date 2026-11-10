import { useCallback, useMemo } from "react";
import { RiBook2Line, RiChatAiLine, RiContactsLine, RiFolder5Line, RiGraduationCapLine, RiHome4Line } from "@remixicon/react";
import type { SidebarDestination } from "@/app/sidebar-pins";
import { useSidebarPins } from "@/hooks/use-sidebar-pins";
import type { SidebarMoreEntry } from "@/components/application/dashboard/sidebar-more-menu";
import type { WorkspacePage } from "@/components/application/dashboard/workspace-page";
import { settingsNavigationSections, settingsSections, type SettingsSection } from "@/components/application/settings/workspace-settings-catalog";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { StoredThread } from "./thread-storage";
import type { ChatContact } from "@/app/contacts-store";
import { DashboardRecentConversations } from "@/components/application/dashboard/dashboard-recent-conversations";
import { buildSidebarSearchEntries, type SidebarSearchEntry } from "@/components/application/dashboard/sidebar-search";
import type { DashboardNavItem } from "@/components/application/dashboard/sidebar-navigation";

export function useAgentChatSidebar({
  setPage, setRequestedContactId, setNavOpen, activeContactId, activeId,
  threads, contacts, busy, onSelectThread, onShowAllThreads,
  onRenameThread, onToggleUnread, onDeleteThread, onNewChatInProject,
}: {
  setPage: (page: WorkspacePage) => void;
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
  onNewChatInProject: (folder: string) => void;
}) {
  const openSettings = useWorkspaceSettings();
  const { pins, toggle, notice } = useSidebarPins();
  // Secondary pages offered by "更多"; pinned ones also appear in the main navigation.
  const destinations: Record<SidebarDestination, Omit<DashboardNavItem, "key">> = useMemo(() => ({
    space: { label: "空间", icon: RiFolder5Line, href: "#space", onSelect: () => { setPage("space"); setNavOpen(false); } },
    knowledge: { label: "知识库", icon: RiBook2Line, href: "#knowledge", onSelect: () => { setPage("knowledge"); setNavOpen(false); } },
    cabin: { label: "小屋", icon: RiHome4Line, href: "#cabin", onSelect: () => { setPage("cabin"); setNavOpen(false); } },
  }), [setNavOpen, setPage]);
  const items: DashboardNavItem[] = useMemo(() => [
    { key: "chat", label: "工作台", icon: RiChatAiLine, href: "/", onSelect: () => { setPage("chat"); setNavOpen(false); } },
    { key: "contacts", label: "联系人", icon: RiContactsLine, href: "#contacts", onSelect: () => { setRequestedContactId(activeContactId); setPage("contacts"); setNavOpen(false); } },
    { key: "learning", label: "学习", icon: RiGraduationCapLine, href: "#learning", onSelect: () => { setPage("learning"); setNavOpen(false); } },
    ...pins.map((id) => ({ key: id, ...destinations[id] })),
  ], [activeContactId, destinations, pins, setNavOpen, setPage, setRequestedContactId]);
  const more = useMemo(() => ({
    entries: (Object.keys(destinations) as SidebarDestination[]).map((id): SidebarMoreEntry => ({
      id, label: destinations[id].label, icon: destinations[id].icon, pinned: pins.includes(id), onOpen: destinations[id].onSelect!,
    })),
    notice,
    onTogglePin: (id: string) => toggle(id as SidebarDestination),
  }), [destinations, notice, pins, toggle]);
  // Search offers every page, pinned or not.
  const navigation = useMemo(() => [...items, ...(Object.keys(destinations) as SidebarDestination[])
    .filter((id) => !pins.includes(id)).map((id) => ({ key: id, ...destinations[id] }))], [destinations, items, pins]);
  const entries = useMemo(() => buildSidebarSearchEntries({
    navigation, threads, contacts,
    settings: settingsNavigationSections.map((id) => ({ id, ...settingsSections[id] })),
  }), [contacts, navigation, threads]);
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
    } else if (target.key === "learning" || target.key in destinations) {
      setPage(target.key as WorkspacePage);
    } else if (target.key === "contacts") {
      setRequestedContactId(activeContactId);
      setPage("contacts");
    } else {
      setPage("chat");
    }
    setNavOpen(false);
    return true;
  }, [activeContactId, busy, contacts, destinations, onSelectThread, openSettings, setNavOpen, setPage, setRequestedContactId, threads]);
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
    onRename={onRenameThread} onToggleUnread={onToggleUnread} onDelete={onDeleteThread} busy={busy}
    onNewChatInProject={(folder) => { onNewChatInProject(folder); setPage("chat"); setNavOpen(false); }} />,
  [activeId, busy, onDeleteThread, onRenameThread, onSelectRecent, onShowAllThreads, onToggleUnread, threads, onNewChatInProject, setPage, setNavOpen]);

  return { items, more, searchEntries: entries, onSearchSelect, children };
}
