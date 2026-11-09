"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgentChatHistory } from "@/components/application/agent-chat/agent-chat-history";
import { AgentMessage } from "@/components/application/agent-chat/agent-chat-message";
import { AgentComposer } from "@/components/application/agent-chat/agent-composer";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { DashboardSidebar } from "@/components/application/dashboard/dashboard-sidebar";
import { DashboardSidebarDrawer } from "@/components/application/dashboard/dashboard-sidebar-drawer";
import { isBackendWorkspacePage, type WorkspacePage } from "@/components/application/dashboard/workspace-page";
import { BackendPendingPage } from "@/components/application/workspace-pages/backend-pending-page";
import { isMacTauriWindow, MacWindowFrame } from "@/components/application/dashboard/mac-window-frame";
import { useChatWorkspaceNavigation } from "@/components/application/dashboard/use-chat-workspace-navigation";
import { cx } from "@/utils/cx";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { ContactsMessenger } from "@/components/application/contacts/contacts-messenger";
import { reconcileContactThread, sameContactThread } from "@/components/application/contacts/contact-thread-sync";
import { resolveContactThread } from "@/components/application/contacts/contact-conversations";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useChatComposer } from "@/hooks/use-chat-composer";
import { useContacts } from "@/hooks/use-contacts";
import type { ChatContact } from "@/app/contacts-store";
import { chatContactAvailability } from "@/app/chat-provider-status";
import { useAgentChatSidebar } from "./use-agent-chat-sidebar";
import { downloadChatThreads } from "./export-chat-history";
import { useChatWindowNavigation } from "./use-chat-window-navigation";
import { createChatWindowChrome } from "./chat-window-chrome";

import { ChatHome } from "./chat-home";
import { useChatProvider } from "./use-chat-provider";
import { ChatWorkspaceSplit } from "./chat-workspace-split";
import { toChatContactRequest } from "./chat-contact";
import { ChatSessionMemory, emptyChatSession, type ChatSessionSnapshot } from "./chat-session-memory";
import {
  deriveTitle, messageText, newThreadId, orderThreads, readThreads,
  type StoredThread,
} from "./thread-storage";

const ENDPOINT = "/api/chat";


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
  const [page, setPage] = useState<WorkspacePage>("chat");
  const [requestedContactId, setRequestedContactId] = useState<string>();
  const [panelOpen, setPanelOpen] = useState(false);
  const history = useChatHistory();
  const { contacts, deletedIds } = useContacts();
  const [selectedContact, setSelectedContact] = useState<ChatContact>();
  const activeContact = selectedContact ? contacts.find((contact) => contact.id === selectedContact.id) ?? selectedContact : undefined;
  const availability = chatContactAvailability(probe, activeContact);
  const threads = useMemo(() => history.threads.filter((thread) => !thread.contact), [history.threads]);
  // Empty until the mount effect assigns one: an id generated during render
  // would differ between server and client and break hydration.
  const [activeId, setActiveId] = useState("");
  const composer = useChatComposer(activeId, { model: probe.model, provider: probe.label ?? probe.provider }, activeContact?.kind ?? "workspace");
  const composerBlockedReason = (activeContact?.kind === "official" ? composer.draftBlockReason : composer.blockReason) ?? availability.reason;
  /** Stamped on send, so render never calls Date.now(). */
  const [activeUpdatedAt, setActiveUpdatedAt] = useState(0);
  /** Set when the open thread is renamed. Without it the derived title
   *  (built from the first message) would immediately overwrite the name. */
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const contactBaseline = useRef<StoredThread | null>(null);
  const sessionMemory = useRef(new ChatSessionMemory());
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  /** When each message arrived, for the hover timestamp. */
  const [messageAt, setMessageAt] = useState<Record<string, number>>({});
  const historyError = history.error;
  const retryHistory = history.retryHistory;

  const [transport] = useState(() => new DefaultChatTransport({ api: ENDPOINT }));

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

  // Reasoning models stream their thinking before any text, and the SDK flips
  // status to "streaming" on that first non-text chunk. Gating the indicator on
  // "submitted" alone therefore hides it seconds before a word appears, leaving
  // an empty transcript. It stays up until real text exists.
  const streamedText = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return "";
    return last.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }, [messages]);
  const showThinking = busy && streamedText.length === 0;

  /** The open chat as plain text, for the share control. */
  const transcript = useMemo(
    () =>
      messages
        .map((message) => `${message.role === "user" ? "You" : "Assistant"}: ${messageText(message)}`)
        .filter((line) => !line.endsWith(": "))
        .join("\n\n"),
    [messages],
  );

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
            ...(activeContact ? { contact: activeContact } : {}),
          }
        : null,
    [activeId, messages, activeUpdatedAt, messageAt, activeTitle, activeContact],
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
    void sendMessage({ text: activeContact?.kind === "official" ? trimmed : composer.prepareText(trimmed) }, activeContact ? { body: { contact: toChatContactRequest(activeContact) } } : undefined);
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
      ...(activeContact ? { contact: activeContact } : {}),
    }, Boolean(activeContact));
  }, [activeId, activeTitle, activeUpdatedAt, messages, messageAt, input, activeContact]);
  const restoreSession = useCallback((session: ChatSessionSnapshot) => {
    setSelectedContact(session.contact);
    setActiveId(session.id);
    setActiveUpdatedAt(session.updatedAt);
    setActiveTitle(session.title);
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

  const startNewChat = useCallback(() => {
    if (busy) return;
    keepLiveThread();
    rememberSession();
    contactBaseline.current = null;
    setSelectedContact(undefined);
    restoreSession(emptyChatSession(newThreadId()));
  }, [busy, keepLiveThread, rememberSession, restoreSession]);

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
    setSelectedContact(contact);
    restoreSession(sessionMemory.current.openThread(thread));
  }, [busy, activeContact?.id, keepLiveThread, rememberSession, history.threads, toggleUnread, restoreSession]);

  const { showAllThreads } = useChatWorkspaceNavigation({
    setNavOpen,
    setPage,
    setPanelOpen,
  });
  const sidebar = useAgentChatSidebar({
    setPage, setRequestedContactId, setNavOpen, activeContactId: activeContact?.id, activeId,
    threads: history.threads, contacts, busy, onSelectThread: selectThread,
    onShowAllThreads: showAllThreads, onRenameThread: renameThread, onToggleUnread: toggleUnread, onDeleteThread: deleteThread,
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
  });
  const workspaceTitle = activeContact?.name ?? allThreads.find((thread) => thread.id === activeId)?.title ?? "新对话";
  const nativeWindow = !contained && isMacTauriWindow();
  const windowToolbar = !contained && page === "chat";
  const chatActions = {
    transcript,
    onExport: exportThreads,
    onToggleUnread: () => toggleUnread(activeId),
    onDelete: () => deleteThread(activeId),
    deleteDisabled: busy,
    disabled: messages.length === 0,
    showThreadMenu: !activeContact,
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
  });

  return localize((
    <MacWindowFrame
      contained={contained}
      className={className}
      titlebarContent={windowActions}
      toolbarNavigation={{
        onBack: windowNavigation.back,
        onForward: windowNavigation.forward,
        onCreate: windowNavigation.create,
        canGoBack: windowNavigation.canGoBack,
        canGoForward: windowNavigation.canGoForward,
      }}
    >
      <DashboardSidebar {...sidebar} selected={page} className="hidden lg:flex" />

      {/* The Pro template pushes the workspace across; this is the plain overlay drawer. */}
      <DashboardSidebarDrawer open={navOpen} contained={contained} onClose={() => setNavOpen(false)}>
        <DashboardSidebar mobile {...sidebar} selected={page} onClose={() => setNavOpen(false)} className="flex" />
      </DashboardSidebarDrawer>

      <div hidden={page !== "contacts"} style={{ display: page === "contacts" ? "flex" : "none" }} className="min-h-0 min-w-0 flex-1">
        <ContactsMessenger onNavigate={() => setNavOpen(true)} provider={probe} requestedContactId={requestedContactId} onContactOpened={() => setRequestedContactId(undefined)} />
      </div>
      {isBackendWorkspacePage(page) && <BackendPendingPage key={page} page={page} onNavigate={() => setNavOpen(true)} />}
      <div hidden={page !== "chat"} style={{ display: page === "chat" ? "flex" : "none" }} className="min-h-0 min-w-0 flex-1">
      <ChatWorkspaceSplit panelOpen={panelOpen} onOpen={() => setPanelOpen(true)} onClose={() => setPanelOpen(false)} panel={
        <AgentChatHistory threads={allThreads} activeId={activeId} onSelect={selectThread}
          onNewChat={startNewChat} onRename={renameThread} onToggleUnread={toggleUnread}
          onDelete={deleteThread} onExport={exportThreads} disabled={busy}
          onClose={() => setPanelOpen(false)} className="w-full" />
      }>
        <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
            {workspaceHeader}
            <>
                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 overflow-y-auto scroll-smooth"
                >
                  <div
                    className={cx(
                      "mx-auto flex w-full flex-col gap-5 pb-6 pt-6",
                      messages.length === 0
                        ? "min-h-full max-w-[1000px] justify-center px-5 sm:px-10 lg:px-12"
                        : "max-w-3xl px-4",
                    )}
                  >
                    {messages.length === 0 ? (
                      <ChatHome
                        value={input}
                        onValueChange={setInput}
                        onSubmit={(text) => submit(text ?? input)}
                        disabled={!availability.ready || Boolean(composerBlockedReason)}
                        sendBlockedReason={composerBlockedReason}
                        onOpenSettings={openSettings}
                        onSelectContact={selectContact}
                        onClearContact={clearContact}
                        selectedContact={activeContact}
                        composer={composer}
                      />
                    ) : (
                      messages.map((message, index) => (
                        <AgentMessage
                          key={message.id}
                          role={message.role}
                          text={messageText(message)}
                          streaming={busy && index === messages.length - 1}
                          at={messageAt[message.id]}
                        />
                      ))
                    )}

                    {showThinking && (
                      <AgentThinking variant="wave" label="Thinking" className="px-1" />
                    )}

                    {error && (
                      <p role="alert" className="px-1 text-body-regular text-text-tertiary">
                        Something went wrong. Check the server logs, then try again.
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 px-3 pb-3">
                  <div className="mx-auto w-full max-w-3xl">
                    {historyError && (
                      <p role="alert" className="mb-2 text-body-2-medium text-text-secondary">
                        {historyError} <button type="button" className="underline" onClick={retryHistory}>重试</button>
                      </p>
                    )}
                    {messages.length > 0 && <AgentComposer
                      value={input}
                      onValueChange={setInput}
                      onSubmit={() => submit(input)}
                      onStop={stop}
                      busy={busy}
                      composer={composer}
                      onConfigure={(target) => openSettings("model", target)}
                      officialCompanion={activeContact?.kind === "official"}
                      context={activeContact?.kind ?? "workspace"}
                      name={activeContact?.name ?? "NekoPapa"}
                      disabled={!availability.ready || Boolean(composerBlockedReason)}
                      sendBlockedReason={composerBlockedReason}
                    />}
                  </div>
                </div>
            </>
        </div>

      </ChatWorkspaceSplit>
      </div>
    </MacWindowFrame>
  ));
}

