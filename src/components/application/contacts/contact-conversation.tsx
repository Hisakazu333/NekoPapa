import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatContact } from "@/app/contacts-store";
import { chatContactAvailability } from "@/app/chat-provider-status";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useChatComposer } from "@/hooks/use-chat-composer";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { Avatar } from "@/components/base/avatar/avatar";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import { messageText, readThreads, type StoredThread } from "../agent-chat/thread-storage";
import type { useChatProvider } from "../agent-chat/use-chat-provider";
import { ContactComposer } from "./contact-composer";
import { ContactMessage } from "./contact-message";
import { reconcileContactThread, sameContactThread } from "./contact-thread-sync";
import type { ContactPreview } from "./contacts-workspace";
import { ContactConversationHeader } from "./contact-conversation-header";
import { resolveContactThread } from "./contact-conversations";
import { toChatContactRequest } from "../agent-chat/chat-contact";

interface ContactConversationProps {
  contact: ChatContact;
  initialThread?: StoredThread;
  provider: ReturnType<typeof useChatProvider>;
  active: boolean;
  onBack: () => void;
  onOpenProfile: () => void;
  onStartGroup: () => void;
  onDelete: () => void;
  onPreview: (id: string, preview: ContactPreview) => void;
}

/** A contact owns a continuous chat. Mounted sessions keep drafts and streams when another is selected. */
export function ContactConversation({ contact, initialThread, provider, active, onBack, onOpenProfile, onStartGroup, onDelete, onPreview }: ContactConversationProps) {
  const history = useChatHistory();
  const openSettings = useWorkspaceSettings();
  const { profile } = useLocalProfile();
  const [initial] = useState<StoredThread>(() => initialThread ?? resolveContactThread(history.threads, contact));
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const { messages, setMessages, sendMessage, regenerate, status, stop, error } = useChat({ id: initial.id, messages: initial.messages, transport });
  const synchronized = useRef(initial);
  const [metadata, setMetadata] = useState(initial);
  const [input, setInput] = useState("");
  const composer = useChatComposer(contact.id, { model: provider.model, provider: provider.label ?? provider.provider });
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [messageAt, setMessageAt] = useState(initial.messageAt);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";
  const availability = chatContactAvailability(provider, contact);
  const draftBlockedReason = contact.kind === "official" ? composer.draftBlockReason : composer.blockReason;
  const modeBlocked = Boolean(draftBlockedReason);
  const last = messages[messages.length - 1];
  const lastText = last ? messageText(last) : "";
  const showThinking = busy && (last?.role !== "assistant" || !lastText);
  const thread = useMemo<StoredThread>(() => ({
    ...metadata, contact, messages, messageAt, updatedAt,
  }), [metadata, contact, messages, messageAt, updatedAt]);
  const savedThread = history.threads.find((candidate) => candidate.id === initial.id);

  useEffect(() => () => { void stop(); }, [stop]);

  useEffect(() => {
    const unseen = messages.filter((message) => messageAt[message.id] === undefined);
    if (!unseen.length) return;
    const now = Date.now();
    setMessageAt((current) => ({ ...current, ...Object.fromEntries(unseen.map((message) => [message.id, now])) }));
  }, [messages, messageAt]);

  useEffect(() => {
    if (!history.ready || busy || messages.some((message) => messageAt[message.id] === undefined)) return;
    // Storage events can arrive while this contact is replying in the background.
    // Reconcile once idle instead of saving a stale transcript over another window.
    // A storage event may still be queued behind this render. Read immediately
    // before reconciliation; the shared store remains the only write owner.
    const latest = readThreads();
    const remote = latest.writable ? latest.threads.find((candidate) => candidate.id === initial.id) : savedThread;
    const next = reconcileContactThread(synchronized.current, thread, remote);
    if (!sameContactThread(thread, next)) {
      setMessages(next.messages);
      setMessageAt(next.messageAt);
      setUpdatedAt(next.updatedAt);
      setMetadata(next);
    }
    history.upsertThread(next);
    // A failed save must not become the common baseline: the old persisted
    // record would then look like an external change and roll back local work.
    const written = readThreads();
    const persisted = written.writable ? written.threads.find((candidate) => candidate.id === initial.id) : undefined;
    if (persisted && sameContactThread(next, persisted)) synchronized.current = next;
  }, [history.ready, busy, messages, messageAt, thread, savedThread, history.upsertThread, setMessages]);

  useEffect(() => {
    onPreview(contact.id, { text: lastText ? `${last?.role === "user" ? "我：" : ""}${lastText}` : "", updatedAt, busy });
  }, [contact.id, lastText, last?.role, updatedAt, busy, onPreview]);

  useEffect(() => {
    if (active) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy, active]);

  const send = () => {
    if (!input.trim() || modeBlocked || busy || !availability.ready) return;
    setUpdatedAt(Date.now());
    void sendMessage({ text: contact.kind === "official" ? input.trim() : composer.prepareText(input) }, { body: { contact: toChatContactRequest(contact) } });
    setInput("");
  };

  return <section aria-label={`与${contact.name}的聊天`} className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background-secondary-default">
    <ContactConversationHeader contact={contact} onBack={onBack} onOpenProfile={onOpenProfile} onStartGroup={onStartGroup} onDelete={onDelete}
      transcript={messages.filter((message) => message.role !== "system").map((message) => `${message.role === "user" ? profile.name : contact.name}：${messageText(message)}`).join("\n\n")} />
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
      {messages.length === 0 ? <div className="flex h-full min-h-28 flex-col items-center justify-center gap-3 text-text-tertiary">
        <Avatar size="lg" src={contact.avatar} initials={Array.from(contact.name).slice(-1).join("")} alt="" color={contact.avatarColor ?? "neutral"} className="mb-5 size-20 text-3xl" />
        <p className="text-headline-semibold text-text-primary">和{contact.name}聊聊吧</p>
        <p className="text-caption-1-regular">聊天记录保存在当前浏览器</p>
      </div> : <ol aria-label="聊天消息" className="flex flex-col gap-5">
        {messages.filter((message) => message.role !== "system").map((message, index) => <ContactMessage key={message.id} text={messageText(message)} isUser={message.role === "user"}
          contact={contact} userName={profile.name} at={messageAt[message.id]} streaming={busy && index === messages.length - 1} />)}
      </ol>}
      {showThinking && <AgentThinking variant="wave" label={`${contact.name}正在回复`} className="mt-5" />}
      {error && <div role="alert" className="mt-4 flex items-center gap-3 rounded-xl border border-separator-border bg-background-full p-3 text-body-regular text-text-secondary">
        <span>{availability.reason ?? "回复失败，消息已保留。请检查模型连接后重试。"}</span>
        <button type="button" disabled={busy || !availability.ready || modeBlocked || Boolean(composer.modelBlockReason)} className="shrink-0 cursor-pointer underline disabled:opacity-50" onClick={() => { if (!availability.ready || busy || modeBlocked || composer.modelBlockReason) return; setUpdatedAt(Date.now()); void regenerate({ body: { contact: toChatContactRequest(contact) } }); }}>重试回复</button>
      </div>}
    </div>
    {history.error && <p role="alert" className="border-t border-separator-border px-5 py-2 text-caption-1-regular text-text-secondary">{history.error} <button type="button" onClick={history.retryHistory} className="cursor-pointer underline">重试保存</button></p>}
    <ContactComposer name={contact.name} value={input} onChange={setInput} onSend={send} onStop={() => { void stop(); }}
      onConfigure={(target) => openSettings("model", target)} busy={busy} ready={availability.ready} composer={composer} officialCompanion={contact.kind === "official"} sendBlockedReason={availability.reason} />
  </section>;
}
