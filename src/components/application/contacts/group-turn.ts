import type { GroupChat, GroupMessage } from "../../../app/contacts/group-chat-store";
import type { ChatContactMetadata } from "../agent-chat/chat-contact";

export function pendingGroupSpeakers(group: GroupChat, turnId: string) {
  return group.members.filter((member) => !group.messages.some((message) => message.turnId === turnId && message.speakerId === member.id && message.state === "complete"));
}

/** Finish the earliest unanswered turn before accepting another user message. */
export function unfinishedGroupTurn(group: GroupChat) {
  return group.messages.find((message) => message.role === "user" && pendingGroupSpeakers(group, message.id).length > 0);
}

function turnContext(group: GroupChat, turnId: string): GroupMessage[] {
  const users = group.messages.filter((message) => message.role === "user");
  const turnIndex = users.findIndex((message) => message.id === turnId);
  if (turnIndex < 0) throw new Error("Missing user turn");
  // Legacy histories can contain later user turns after an interrupted reply.
  // Resuming one must not expose future questions to the model.
  return users.slice(0, turnIndex + 1).flatMap((user) => [user, ...group.members.flatMap((member) =>
    group.messages.filter((message) => message.turnId === user.id && message.speakerId === member.id))]);
}
export interface GroupReplyInput { group: GroupChat; contact: ChatContactMetadata; signal: AbortSignal; onText: (text: string) => void }
export type GroupReply = (input: GroupReplyInput) => Promise<string>;

/** Each member answers once in stable order. A failed or stopped member pauses the round. */
export async function runGroupTurn({ group, turnId, signal, reply, onMessage, onSpeaker }: {
  group: GroupChat; turnId: string; signal: AbortSignal; reply: GroupReply;
  onMessage: (message: GroupMessage) => void; onSpeaker: (id?: string) => void;
}): Promise<"complete" | "stopped" | "failed"> {
  const working = structuredClone({ ...group, messages: turnContext(group, turnId) });
  try {
    for (const contact of pendingGroupSpeakers(working, turnId)) {
      if (signal.aborted) return "stopped";
      onSpeaker(contact.id);
      const previous = working.messages.find((message) => message.turnId === turnId && message.speakerId === contact.id);
      let message: GroupMessage = { id: previous?.id ?? `reply-${turnId}-${contact.id}`, role: "assistant", speakerId: contact.id, turnId, text: "", at: previous?.at ?? Date.now(), state: "streaming" };
      const publish = () => {
        working.messages = working.messages.filter((item) => item.id !== message.id);
        working.messages.push(message);
        onMessage({ ...message });
      };
      publish();
      try {
        const text = await reply({ group: { ...working, messages: working.messages.filter((item) => item.id !== message.id) }, contact, signal, onText: (text) => { message = { ...message, text }; publish(); } });
        if (signal.aborted) { message = { ...message, state: "stopped" }; publish(); return "stopped"; }
        if (!text.trim()) throw new Error("Empty group reply");
        message = { ...message, text, state: "complete" };
        publish();
      } catch {
        message = { ...message, state: signal.aborted ? "stopped" : "failed" };
        publish();
        return signal.aborted ? "stopped" : "failed";
      }
    }
    return "complete";
  } finally { onSpeaker(undefined); }
}
