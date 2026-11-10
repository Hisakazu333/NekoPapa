import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, UsersIcon } from "@/components/foundations/icons/app-icons";
import { useGroupChats } from "@/hooks/use-group-chats";
import { useContacts } from "@/hooks/use-contacts";
import { useChatComposer } from "@/hooks/use-chat-composer";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { IconButton } from "@/components/base/buttons/icon-button";
import { Button } from "@/components/base/buttons/button";
import { useWorkspaceSettings } from "@/components/application/settings/workspace-settings";
import type { GroupChat, GroupMessage } from "@/app/contacts/group-chat-store";
import { officialGroupRestriction } from "@/app/contacts/group-chat-store";
import { TranscriptViewport } from "../agent-chat/transcript-viewport";
import type { useChatProvider } from "../agent-chat/use-chat-provider";
import { ContactComposer } from "./contact-composer";
import { ContactMessage } from "./contact-message";
import { requestGroupReply } from "./group-reply";
import { runGroupTurn, unfinishedGroupTurn } from "./group-turn";
import { GroupChatMenu } from "./group-chat-menu";

export function GroupConversation({ groupId, provider, onBack, onDelete }: { groupId: string; provider: ReturnType<typeof useChatProvider>; onBack: () => void; onDelete: (group: GroupChat) => void }) {
  const history = useGroupChats();
  const { contacts } = useContacts();
  const { profile } = useLocalProfile();
  const openSettings = useWorkspaceSettings();
  const stored = history.groups.find((group) => group.id === groupId);
  const group = stored && { ...stored, members: stored.members.map((member) => contacts.find((contact) => contact.id === member.id) ?? member) };
  const groupRef = useRef<GroupChat | undefined>(group);
  groupRef.current = group;
  const [input, setInput] = useState("");
  const composer = useChatComposer(groupId, { model: provider.model, provider: provider.label ?? provider.provider });
  const [speakerId, setSpeakerId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"failed" | "stopped" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const run = async (next: GroupChat, turnId: string) => {
    if (composer.draft.mode === "study" || composer.modelBlockReason || abortRef.current || provider.status !== "ready" || officialGroupRestriction(next.members)) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true); setOutcome(null);
    try {
      const result = await runGroupTurn({ group: next, turnId, signal: abort.signal, reply: requestGroupReply, onSpeaker: setSpeakerId,
        onMessage: (message) => { if (!history.putMessage(groupId, message)) abort.abort(); } });
      setOutcome(result === "complete" ? null : result);
    } catch { setOutcome(abort.signal.aborted ? "stopped" : "failed"); }
    finally { abortRef.current = null; setBusy(false); setSpeakerId(undefined); }
  };
  const send = () => {
    const current = groupRef.current;
    if (!current || busy || composer.blockReason || !input.trim() || provider.status !== "ready" || history.error || officialGroupRestriction(current.members) || unfinishedGroupTurn(current)) return;
    const message: GroupMessage = { id: crypto.randomUUID(), role: "user", text: composer.prepareText(input), at: Date.now() };
    const saved = history.putMessage(groupId, message);
    setInput("");
    if (!saved) return;
    void run({ ...current, messages: [...current.messages, message] }, message.id);
  };
  if (!group) return <div role="status" className="flex h-full items-center justify-center text-text-secondary">{history.ready ? "群聊暂时不可用，请重新选择。" : "正在读取群聊…"}</div>;
  const restriction = officialGroupRestriction(group.members);
  const unfinished = unfinishedGroupTurn(group);
  const interrupted = !busy && unfinished;
  const speaker = group.members.find((member) => member.id === speakerId);
  return <section aria-label={`群聊：${group.title}`} className="flex h-full min-h-0 flex-1 flex-col bg-background-secondary-default">
    <header className="flex min-h-[76px] shrink-0 items-center gap-3 px-5">
      <IconButton icon={ChevronLeftIcon} aria-label="返回联系人列表" onClick={onBack} className="md:hidden" />
      <UsersIcon className="size-7 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <div className="min-w-0 flex-1"><h1 className="truncate text-headline-semibold">{group.title}</h1><p className="mt-1 truncate text-caption-1-regular text-text-tertiary">{group.members.length} 位联系人 · {group.members.map((member) => member.name).join(" → ")}</p></div>
      <GroupChatMenu title={group.title} onDelete={() => onDelete(group)} />
    </header>
    <TranscriptViewport conversationId={groupId} busy={busy} showLatest={group.messages.length > 0} className="px-5 py-6">
      {group.messages.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center"><UsersIcon className="size-14 text-text-tertiary" aria-hidden /><h2 className="text-headline-semibold">{restriction ? "历史群聊" : "一起聊聊吧"}</h2><p className="text-body-2-regular text-text-secondary">{restriction ? "记录仍然保留，请从联系人列表与官方人物单独对话。" : "发送后，成员会按上面的顺序依次回复。"}</p></div> : <ol aria-label="群聊消息" className="flex flex-col gap-5">{group.messages.map((message) => {
        const member = group.members.find((item) => item.id === message.speakerId) ?? group.members[0];
        return <ContactMessage key={message.id} text={message.text} isUser={message.role === "user"} contact={member} userName={profile.name} at={message.at} streaming={busy && message.speakerId === speakerId && message.state === "streaming"} />;
      })}</ol>}
      {interrupted && !restriction ? <div role="status" className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-background-full p-4"><span className="text-body-regular text-text-secondary">{outcome === "failed" ? "本轮回复失败，已保留消息。" : "本轮尚未完成，已保留现有回复。"}</span><Button size="small" variant="secondary" disabled={provider.status !== "ready" || Boolean(history.error) || Boolean(composer.modelBlockReason) || composer.draft.mode === "study"} onClick={() => { const current = groupRef.current; if (current) void run(current, unfinished.id); }}>继续本轮</Button></div> : null}
    </TranscriptViewport>
    {history.error && <p role="alert" className="px-5 py-2 text-caption-1-regular text-text-secondary">{history.error} <button className="cursor-pointer underline" onClick={history.retry}>重试保存</button></p>}
    <ContactComposer name="群聊" value={input} onChange={setInput} onSend={send} onStop={() => abortRef.current?.abort()} onConfigure={(target) => openSettings("model", target)} busy={busy} ready={provider.status === "ready"} composer={composer}
      activityLabel={busy && speaker ? `${speaker.name}正在回复` : undefined}
      sendBlockedReason={restriction ?? history.error ?? (!history.writable ? "正在读取群聊记录，请稍候。" : !busy && unfinished ? provider.status === "ready" ? "本轮尚未完成，请先继续本轮。" : "连接模型后即可继续本轮。" : undefined)} />
  </section>;
}
