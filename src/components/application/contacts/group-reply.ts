import { readUIMessageStream, type UIMessage } from "ai";
import { createChatTransport } from "../../../app/chat/chat-transport";
import type { GroupReply } from "./group-turn";
import { toChatContactRequest } from "../agent-chat/chat-contact";

/** Uses the same real model route as one-to-one chat; no local scripted replies. */
export const requestGroupReply: GroupReply = async ({ group, contact, signal, onText }) => {
  const messages: UIMessage[] = group.messages.filter((message) => message.text.trim()).map((message) => {
    const speaker = group.members.find((member) => member.id === message.speakerId);
    const own = message.role === "assistant" && message.speakerId === contact.id;
    const label = message.role === "user" ? "用户" : `${speaker?.name ?? "联系人"} [${message.speakerId}]`;
    return { id: message.id, role: own ? "assistant" : "user", parts: [{ type: "text", text: `${label}：\n${message.text}` }] };
  });
  const transport = createChatTransport();
  const body = { contact: toChatContactRequest(contact), groupContext: { members: group.members.map(toChatContactRequest) } };
  const stream = await transport.sendMessages({ chatId: group.id, trigger: "submit-message", messageId: undefined, messages, abortSignal: signal, body });
  let text = "";
  for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
    text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
    onText(text);
  }
  return text;
};
