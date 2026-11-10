"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { useChat } from "@ai-sdk/react";
import { createChatTransport } from "@/app/chat-transport";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceNavigation } from "@/components/application/dashboard/workspace-navigation";
import { normalizeNavigationLayout } from "@/app/dock-magnification";
import { isPendingWorkspacePage, type WorkspacePage } from "@/components/application/dashboard/workspace-page";
import { BackendPendingPage } from "@/components/application/workspace-pages/backend-pending-page";
import { SpacePage } from "@/components/application/workspace-pages/space-page";
import { isMacTauriWindow, MacWindowFrame } from "@/components/application/dashboard/mac-window-frame";
import { useChatWorkspaceNavigation } from "@/components/application/dashboard/use-chat-workspace-navigation";
import { useSidebarVisibility } from "@/components/application/dashboard/use-sidebar-visibility";
import { toast } from "@/components/base/toast/toast";
import { useSidebarPeek } from "@/components/application/dashboard/sidebar-peek";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { ContactsMessenger } from "@/components/application/contacts/contacts-messenger";
import { reconcileContactThread, sameContactThread } from "@/components/application/contacts/contact-thread-sync";
import { resolveContactThread } from "@/components/application/contacts/contact-conversations";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useChatComposer } from "@/hooks/use-chat-composer";
import { useContacts } from "@/hooks/use-contacts";
import { useConfiguration } from "@/hooks/use-configuration";
import { useProjects } from "@/hooks/use-projects";
import { resolveProject } from "@/app/projects";
import { browserTabLabel } from "@/app/browser-address";
import { CHAT_TOOL_LABELS, CHAT_TOOLS, type ChatTool } from "@/app/chat-tools";
import type { ChatContact } from "@/app/contacts-store";
import { chatContactAvailability } from "@/app/chat-provider-status";
import { useAgentChatSidebar } from "./use-agent-chat-sidebar";
import { downloadChatThreads } from "./export-chat-history";
import { useChatWindowNavigation } from "./use-chat-window-navigation";
import { createChatWindowChrome } from "./chat-window-chrome";

import { ChatConversation } from "./chat-conversation";
import { useChatProvider } from "./use-chat-provider";
import { useChatTranscript } from "./use-chat-transcript";
import { useStartupThread } from "./use-startup-thread";
import { ChatWorkspaceSplit } from "./chat-workspace-split";
import { ChatTitleTabs } from "./chat-title-tabs";
import { ChatSidePanel } from "./chat-side-panel";
import { ChatBrowserPanel } from "./chat-browser-panel";
import { MessageLinkProvider, useMessageLinkOpener } from "./message-links";
import { ChatToolPanel } from "./tools/chat-tool-panel";
import { useChatToolShortcuts } from "./tools/chat-tool-buttons";
import { useChatBrowser } from "./use-chat-browser";
import { useBrowserPlacement } from "./use-browser-placement";
import { BrowserDragLayer, useBrowserDrag } from "./use-browser-drag";
import { chatTabEntries } from "./chat-workspace-tabs";
import { toChatContactRequest } from "./chat-contact";
import { ChatSessionMemory, emptyChatSession, type ChatSessionSnapshot } from "./chat-session-memory";
import {
  deriveTitle, newThreadId, orderThreads, readThreads,
  type StoredThread,
} from "./thread-storage";

const ENDPOINT = "/api/chat";
/** Beside the browser the chat keeps room for a one-line greeting and composer row; below that the browser overlays it. */
const BROWSER_CHAT_MIN_WIDTH = 480;


export function AgentChat({
  className,
  contained = false,
}: {
  className?: string;
  /** Docs preview mode: fill the preview frame's height instead of the
   *  viewport, and keep the phone nav drawer inside the frame. */
  contained?: boolean;
}) {
  const localize = useTemplateCopy();
  const openSettings = useWorkspaceSettings();
  const probe = useChatProvider(ENDPOINT);
  const [input, setInput] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  // The dock's open panel (对话 / 搜索 / 更多); a finished navigation closes it like the drawer.
  const [dockPanel, setDockPanel] = useState<string | null>(null);
  const closeNavigation = useCallback((open: boolean) => { setNavOpen(open); if (!open) setDockPanel(null); }, []);
  const sidebarVisibility = useSidebarVisibility();
  const configuration = useConfiguration().data;
  const navigationLayout = normalizeNavigationLayout(configuration.groups.appearance.navigation);
  const sidebarPeek = useSidebarPeek(navigationLayout === "sidebar" && sidebarVisibility.hidden && !contained);
  const [page, setPage] = useState<WorkspacePage>("chat");
  const [requestedContactId, setRequestedContactId] = useState<string>();
  const history = useChatHistory();
  const { contacts, deletedIds } = useContacts();
  const [selectedContact, setSelectedContact] = useState<ChatContact>();
  const activeContact = selectedContact ? contacts.find((contact) => contact.id === selectedContact.id) ?? selectedContact : undefined;
  const threads = useMemo(() => history.threads.filter((thread) => !thread.contact), [history.threads]);
  // Empty until the mount effect assigns one: an id generated during render
  // would differ between server and client and break hydration.
  const [activeId, setActiveId] = useState("");
  const composer = useChatComposer(activeId, { model: probe.model, provider: probe.label ?? probe.provider }, activeContact?.kind ?? "workspace");
  const availability = chatContactAvailability(probe, activeContact, composer.usesProfile);
  // Elements picked in the built-in browser join the open chat's draft.
  const browser = useChatBrowser(composer.addPageElement);
  // The right-hand area holds either the side panel or the built-in browser;
  // the browser can also move to its own title-bar tab and be dragged back.
  const placement = useBrowserPlacement(activeId);
  const { auxiliary, openSidePanel } = placement;
  const activeTool = CHAT_TOOLS.find((tool) => tool === auxiliary) ?? null;
  const toggleTool = useCallback((tool: ChatTool) => placement.toggleAuxiliary(tool), [placement.toggleAuxiliary]);
  const browserDrag = useBrowserDrag((zone) => zone === "tab" ? placement.moveToTab() : placement.moveToSide());
  const browserLabel = browserTabLabel(browser.url, browser.title);
  const openLink = useMessageLinkOpener(browser, placement.showBrowser);
  const composerBlockedReason = (activeContact?.kind === "official" ? composer.draftBlockReason : composer.blockReason) ?? availability.reason;
  /** Stamped on send, so render never calls Date.now(). */
  const [activeUpdatedAt, setActiveUpdatedAt] = useState(0);
  /** Set when the open thread is renamed. Without it the derived title
   *  (built from the first message) would immediately overwrite the name. */
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  /** Project folder the open workbench chat is grouped under. */
  const [activeProject, setActiveProject] = useState<string>();
  const { projects, legacyAdopted, adoptLegacy: adoptLegacyProjects } = useProjects();
  const contactBaseline = useRef<StoredThread | null>(null);
  const sessionMemory = useRef(new ChatSessionMemory());
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  /** When each message arrived, for the hover timestamp. */
  const [messageAt, setMessageAt] = useState<Record<string, number>>({});
  const historyError = history.error;
  const retryHistory = history.retryHistory;

  const [transport] = useState(createChatTransport);

  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!selectedContact || !deletedIds.includes(selectedContact.id)) return;
    let cancelled = false;
    void (async () => {
      try { await stop(); } finally {
        if (!cancelled) {
          contactBaseline.current = null;
          setSelectedContact(undefined);
          setActiveId(newThreadId());
          setActiveUpdatedAt(0);
          setActiveTitle(null);
          setMessageAt({});
          setMessages([]);
          setInput("");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedContact, deletedIds, stop, setMessages]);

  const { showThinking, transcript } = useChatTranscript(messages, busy);

  useEffect(() => { setActiveId(newThreadId()); }, []);

  // The thread being typed into is derived rather than stored, so its title
  // appears as soon as the first message lands without a state round-trip.
  // The timestamp is stamped when a message is sent rather than read during
  // render, so rendering stays pure and the badge does not drift each frame.
  const liveThread: StoredThread | null = useMemo(
    () =>
      activeId && messages.length > 0
        ? {
            id: activeId,
            title: activeContact?.name ?? activeTitle ?? deriveTitle(messages),
            updatedAt: activeUpdatedAt,
            messages,
            messageAt,
            ...(activeContact ? { contact: activeContact } : activeProject ? { project: activeProject } : {}),
          }
        : null,
    [activeId, messages, activeUpdatedAt, messageAt, activeTitle, activeContact, activeProject],
  );

  // Ordered by last message, never by what is open: selecting a thread must
  // not move it, or the list reshuffles under the pointer as you browse it.
  const allThreads = useMemo(() => {
    const rest = threads.filter((thread) => thread.id !== activeId);
    return orderThreads(liveThread && !liveThread.contact ? [liveThread, ...rest] : rest);
  }, [liveThread, threads, activeId]);

  // Plain workbench chats save directly. Contact chats reconcile against the
  // other entry point below before reaching the shared history owner.
  useEffect(() => {
    if (history.ready && !busy && liveThread && !liveThread.contact) history.upsertThread(liveThread);
  }, [history.ready, history.upsertThread, busy, liveThread]);

  useEffect(() => {
    if (!history.ready || busy || !activeContact || !activeId || messages.some((message) => messageAt[message.id] === undefined)) return;
    const local: StoredThread = {
      id: activeId,
      title: activeTitle ?? activeContact.name,
      updatedAt: activeUpdatedAt,
      messages,
      messageAt,
      contact: activeContact,
    };
    const loaded = readThreads();
    const remote = loaded.writable
      ? loaded.threads.find((thread) => thread.id === activeId)
      : history.threads.find((thread) => thread.id === activeId);
    const base = contactBaseline.current ?? remote ?? local;
    const next = reconcileContactThread(base, local, remote);
    if (!sameContactThread(local, next)) {
      setMessages(next.messages);
      setMessageAt(next.messageAt);
      setActiveUpdatedAt(next.updatedAt);
      setActiveTitle(next.title);
    }
    history.upsertThread(next);
    const written = readThreads();
    const persisted = written.writable ? written.threads.find((thread) => thread.id === activeId) : undefined;
    if (persisted && sameContactThread(next, persisted)) contactBaseline.current = next;
  }, [history.ready, history.threads, history.upsertThread, busy, activeContact, activeId, activeTitle,
    activeUpdatedAt, messages, messageAt, setMessages]);

  // Arrival times come from outside React (they are a property of when the
  // stream delivered each message), so they are recorded rather than derived.
  useEffect(() => {
    const unseen = messages.filter((message) => messageAt[message.id] === undefined);
    if (unseen.length === 0) return;
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring from localStorage after mount; there is no render-time source for it
    setMessageAt((prev) => {
      const next = { ...prev };
      for (const message of unseen) next[message.id] = now;
      return next;
    });
  }, [messages, messageAt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !availability.ready || composerBlockedReason) return;
    setActiveUpdatedAt(Date.now());
    void sendMessage({ text: activeContact?.kind === "official" ? trimmed : composer.prepareText(trimmed) }, { body: { ...composer.requestBody, ...(activeContact ? { contact: toChatContactRequest(activeContact) } : {}) } });
    setInput("");
  };

  /** Folds the thread being left back into the stored list before switching.
   *  Its timestamp is carried over untouched, so leaving a thread never
   *  changes where it sits in the list. */
  const keepLiveThread = useCallback(() => {
    if (!liveThread) return;
    history.upsertThread(liveThread);
  }, [liveThread, history.upsertThread]);
  const rememberSession = useCallback(() => {
    sessionMemory.current.remember({
      id: activeId, title: activeTitle, updatedAt: activeUpdatedAt, messages, messageAt, input,
      ...(activeContact ? { contact: activeContact } : {}), ...(activeProject ? { project: activeProject } : {}),
    }, Boolean(activeContact));
  }, [activeId, activeTitle, activeUpdatedAt, messages, messageAt, input, activeContact, activeProject]);
  const restoreSession = useCallback((session: ChatSessionSnapshot) => {
    setSelectedContact(session.contact);
    setActiveId(session.id);
    setActiveUpdatedAt(session.updatedAt);
    setActiveTitle(session.title);
    setActiveProject(session.project);
    setMessageAt(session.messageAt);
    setMessages(session.messages);
    setInput(session.input);
  }, [setMessages]);
  const toggleUnread = history.toggleThreadUnread;

  const clearContact = useCallback(() => {
    if (busy || !activeContact) return;
    keepLiveThread();
    rememberSession();
    contactBaseline.current = null;
    setSelectedContact(undefined);
    const session = sessionMemory.current.restoreWorkspace(newThreadId);
    restoreSession(session);
  }, [busy, activeContact, keepLiveThread, rememberSession, restoreSession]);

  /** A new chat stays in the open project folder unless another one is given. */
  const startChatIn = useCallback((project: string | undefined) => {
    if (busy) return;
    keepLiveThread();
    rememberSession();
    contactBaseline.current = null;
    setSelectedContact(undefined);
    restoreSession({ ...emptyChatSession(newThreadId()), ...(project ? { project } : {}) });
  }, [busy, keepLiveThread, rememberSession, restoreSession]);
  // General → 新建对话 → 项目文件夹 decides whether a new chat stays in the open project
  // (by id; a legacy folder path resolves to its project, a removed project to none).
  const newChatProject = configuration.groups.general.projectFolder === "none" ? undefined : resolveProject(projects, activeProject)?.id;
  const startNewChat = useCallback(() => startChatIn(newChatProject), [startChatIn, newChatProject]);

  const renameThread = useCallback((id: string, title: string) => {
    if (id === activeId) setActiveTitle(title);
    history.renameThread(id, title);
  }, [activeId, history.renameThread]);

  const deleteThread = useCallback((id: string) => {
    if (busy && id === activeId) return false;
    if (!history.removeThread(id)) return false;
    sessionMemory.current.forget(id);
    if (id === activeId) {
      contactBaseline.current = null;
      setActiveId(newThreadId());
      setSelectedContact(undefined);
      setActiveUpdatedAt(0);
      setActiveTitle(null);
      setMessageAt({});
      setMessages([]);
      setInput("");
    }
    return true;
  }, [activeId, busy, history.removeThread, setMessages]);

  /** Hands the stored chats back as a file. Nothing leaves the browser: the
   *  blob is built locally and revoked straight after the click. */
  const exportThreads = useCallback(() => downloadChatThreads(allThreads), [allThreads]);

  const selectThread = useCallback(
    (id: string) => {
      if (busy || id === activeId) return;
      const thread = allThreads.find((candidate) => candidate.id === id);
      if (!thread) return;
      keepLiveThread();
      rememberSession();
      // Reading a chat is what marks it read again.
      if (thread.unread) toggleUnread(id);
      contactBaseline.current = null;
      setSelectedContact(undefined);
      const snapshot = sessionMemory.current.getSession(id);
      restoreSession(snapshot ?? sessionMemory.current.openThread(thread));
    },
    [busy, activeId, allThreads, keepLiveThread, rememberSession, toggleUnread, restoreSession],
  );

  const selectContact = useCallback((contact: ChatContact) => {
    if (busy || activeContact?.id === contact.id) return;
    keepLiveThread();
    rememberSession();
    const loaded = readThreads();
    const thread = resolveContactThread(loaded.writable ? loaded.threads : history.threads, contact);
    contactBaseline.current = thread;
    if (thread?.unread) toggleUnread(thread.id);
    // restoreSession sets the contact from the snapshot, so the snapshot must carry it.
    restoreSession(sessionMemory.current.openThread(thread, contact));
  }, [busy, activeContact?.id, keepLiveThread, rememberSession, history.threads, toggleUnread, restoreSession]);

  useStartupThread({ ready: history.ready, activeId, threads: allThreads, onOpen: selectThread });
  const { showAllThreads } = useChatWorkspaceNavigation({
    setNavOpen: closeNavigation,
    setPage,
    openSidePanel,
  });
  const sidebar = useAgentChatSidebar({
    setPage, setRequestedContactId, setNavOpen: closeNavigation, activeContactId: activeContact?.id, activeId,
    threads: history.threads, contacts, busy, onSelectThread: selectThread,
    onShowAllThreads: showAllThreads, onRenameThread: renameThread, onToggleUnread: toggleUnread, onDeleteThread: deleteThread,
    onNewChatInProject: startChatIn,
  });
  const windowNavigation = useChatWindowNavigation({
    activeId,
    busy,
    threads: allThreads,
    sessionMemory,
    keepLiveThread,
    rememberSession,
    restoreSession,
    setSelectedContact,
    enterWorkspace: () => setPage("chat"),
    project: newChatProject,
  });
  // Chats saved before projects stored a folder path: turn those into projects once.
  useEffect(() => {
    if (!legacyAdopted) adoptLegacyProjects([...new Set(allThreads.flatMap((thread) => thread.project ? [thread.project] : []))]);
  }, [legacyAdopted, allThreads, adoptLegacyProjects]);
  const workspaceTitle = activeContact?.name ?? allThreads.find((thread) => thread.id === activeId)?.title ?? "新对话";
  const nativeWindow = !contained && isMacTauriWindow();
  const windowToolbar = !contained && page === "chat";
  useChatToolShortcuts(page === "chat", toggleTool);
  // 新建对话 from the title bar leaves the browser tab for the new chat.
  const createChat = () => { placement.leaveBrowserTab(); windowNavigation.create(); };
  // 清理标签: closes the views only; saved chats stay in the sidebar under their project.
  const clearTabs = () => {
    placement.leaveBrowserTab();
    const closed = windowNavigation.closeAll();
    if (closed > 0) toast.success(`已关闭 ${closed} 个标签`, { description: "用过的对话仍保留在侧栏对应的项目中。" });
  };
  const chatActions = {
    transcript,
    onExport: exportThreads,
    onToggleUnread: () => toggleUnread(activeId),
    onDelete: () => deleteThread(activeId),
    deleteDisabled: busy,
    disabled: messages.length === 0,
    showThreadMenu: !activeContact,
    panelOpen: auxiliary === "panel",
    onTogglePanel: () => placement.toggleAuxiliary("panel"),
    browserOpen: placement.browserShown,
    onToggleBrowser: placement.toggleBrowser,
    activeTool,
    onToggleTool: toggleTool,
  };
  const { workspaceHeader, windowActions } = createChatWindowChrome({
    title: workspaceTitle,
    titleRef,
    navOpen,
    onToggleNavigation: () => setNavOpen((open) => !open),
    hasMessages: messages.length > 0,
    windowToolbar,
    nativeWindow,
    actions: chatActions,
    tabs: <ChatTitleTabs activeId={activeId} busy={busy} nativeWindow={nativeWindow} onClose={windowNavigation.close}
      onCreate={createChat}
      onSelect={(id) => { placement.leaveBrowserTab(); windowNavigation.select(id); }}
      dropTarget={browserDrag.drag?.from === "side" && (browserDrag.drag.over === "tab" ? "over" : true)}
      browserTab={placement.browserTab ? {
        title: browserLabel, active: placement.browserTabActive, loading: browser.loading && Boolean(browser.url), onSelect: placement.selectBrowserTab, onClose: placement.closeBrowserTab,
        onPointerDown: (event) => browserDrag.begin(event, "tab", browserLabel, placement.selectBrowserTab),
      } : undefined}
      tabs={chatTabEntries(windowNavigation.state, { activeId, activeTitle: workspaceTitle, threads: allThreads, sessionOf: (id) => sessionMemory.current.getSession(id) })} />,
  });

  return localize(<MessageLinkProvider value={openLink}>
    <MacWindowFrame
      contained={contained}
      className={className}
      titlebarContent={windowActions}
      dockInset={navigationLayout === "dock"}
      sidebarToggle={navigationLayout === "dock" ? undefined : { hidden: sidebarVisibility.hidden, shortcut: sidebarVisibility.shortcut, onHoverChange: sidebarPeek.hover,
        onToggle: () => { sidebarPeek.setOpen(false); sidebarVisibility.toggle(); } }}
      toolbarNavigation={{
        onBack: windowNavigation.back,
        onForward: windowNavigation.forward,
        onCreate: createChat,
        createInTabs: windowToolbar,
        canGoBack: windowNavigation.canGoBack,
        canGoForward: windowNavigation.canGoForward,
        onClearTabs: windowToolbar ? clearTabs : undefined,
        canClearTabs: !busy && (windowNavigation.state.ids.length > 1 || messages.length > 0),
      }}
    >
      <WorkspaceNavigation layout={navigationLayout} sidebar={sidebar} page={page} preferRail={page === "chat" && auxiliary !== null && auxiliary !== "panel"}
        sidebarHidden={sidebarVisibility.hidden} peek={sidebarPeek} navOpen={navOpen} setNavOpen={setNavOpen} contained={contained} dockPanel={dockPanel} onDockPanelChange={setDockPanel}
        onOpenSettings={() => openSettings("general")} />

      <div hidden={page !== "contacts"} style={{ display: page === "contacts" ? "flex" : "none" }} className="min-h-0 min-w-0 flex-1">
        <ContactsMessenger onNavigate={() => setNavOpen(true)} provider={probe} requestedContactId={requestedContactId} onContactOpened={() => setRequestedContactId(undefined)} />
      </div>
      {isPendingWorkspacePage(page) && <BackendPendingPage key={page} page={page} onNavigate={() => setNavOpen(true)} />}
      {page === "space" && <SpacePage onNavigate={() => setNavOpen(true)} />}
      <div hidden={page !== "chat"} style={{ display: page === "chat" ? "flex" : "none" }} className="min-h-0 min-w-0 flex-1">
      {placement.browserTabActive && <section aria-label="浏览器" className="flex min-h-0 min-w-0 flex-1">
        <ChatBrowserPanel browser={browser} placement="tab" onClose={placement.closeBrowserTab} onMove={placement.moveToSide}
          suspended={browserDrag.drag !== null}
          onMovePointerDown={(event) => browserDrag.begin(event, "tab", browserLabel, placement.moveToSide)} />
      </section>}
      {/* The chat stays mounted behind the browser tab, so its scroll and draft survive. */}
      <div style={{ display: placement.browserTabActive ? "none" : "flex" }} className="min-h-0 min-w-0 flex-1">
      <ChatWorkspaceSplit panelOpen={auxiliary !== null} onOpen={openSidePanel} onClose={placement.closeAuxiliary}
        widthKey={auxiliary ?? "panel"} defaultRatio={auxiliary === "browser" ? 0.5 : activeTool ? 0.45 : undefined}
        mainMinWidth={auxiliary === "browser" ? BROWSER_CHAT_MIN_WIDTH : undefined}
        panelLabel={auxiliary === "browser" ? "浏览器" : activeTool ? CHAT_TOOL_LABELS[activeTool] : "辅助工作区"} panel={activeTool
          ? <ChatToolPanel tool={activeTool} project={resolveProject(projects, activeProject)} messages={messages} messageAt={messageAt}
            scrollRef={scrollRef} onClose={placement.closeAuxiliary} />
          : auxiliary === "browser"
          ? <ChatBrowserPanel browser={browser} placement="side" onClose={placement.closeAuxiliary} onMove={placement.moveToTab}
            suspended={browserDrag.drag !== null}
            onMovePointerDown={(event) => browserDrag.begin(event, "side", browserLabel, placement.moveToTab)} />
          : <ChatSidePanel project={activeProject} threads={allThreads} activeId={activeId} onSelect={selectThread}
            onNewChat={startNewChat} onRename={renameThread} onToggleUnread={toggleUnread}
            onDelete={deleteThread} onExport={exportThreads} disabled={busy}
            onClose={placement.closeAuxiliary} onOpenTool={toggleTool} />
      }>
        <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
            {workspaceHeader}
            <ChatConversation scrollRef={scrollRef} messages={messages} messageAt={messageAt} busy={busy}
              showThinking={showThinking} error={error} historyError={historyError} onRetryHistory={retryHistory}
              input={input} onInputChange={setInput} onSubmit={submit} onStop={stop} composer={composer}
              onOpenSettings={openSettings} sendDisabled={!availability.ready || Boolean(composerBlockedReason)}
              sendBlockedReason={composerBlockedReason} contact={activeContact} onSelectContact={selectContact}
              onClearContact={clearContact} project={activeProject} onProjectChange={setActiveProject} />
        </div>

      </ChatWorkspaceSplit>
      </div>
      </div>
      <BrowserDragLayer drag={browserDrag.drag} />
    </MacWindowFrame>
  </MessageLinkProvider>);
}

