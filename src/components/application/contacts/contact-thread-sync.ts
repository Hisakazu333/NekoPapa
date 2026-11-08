import type { UIMessage } from "ai";
import type { StoredThread } from "../agent-chat/thread-storage";
import { sameJsonData } from "../agent-chat/json-data-equal";

export function sameContactThread(left: StoredThread, right: StoredThread) {
  return sameJsonData(left, right);
}

function sameMessage(left: UIMessage | undefined, right: UIMessage | undefined) {
  return sameJsonData(left, right);
}

/** Preserve both windows' new messages, while respecting uncontested removals such as retry. */
function mergeMessages(base: UIMessage[], local: UIMessage[], remote: UIMessage[]) {
  const original = new Map(base.map((message) => [message.id, message]));
  const localById = new Map(local.map((message) => [message.id, message]));
  const remoteById = new Map(remote.map((message) => [message.id, message]));
  const ids = new Set([...remote.map((message) => message.id), ...local.map((message) => message.id)]);
  const merged: UIMessage[] = [];
  for (const id of ids) {
    const before = original.get(id);
    const here = localById.get(id);
    const there = remoteById.get(id);
    if (before && ((!here && sameMessage(there, before)) || (!there && sameMessage(here, before)))) continue;
    const message = here && !sameMessage(here, before) ? here : there ?? here;
    if (message) merged.push(message);
  }
  return merged;
}

/** Call only after a local stream settles; the composer draft is independent of the transcript. */
export function reconcileContactThread(base: StoredThread, local: StoredThread, remote?: StoredThread): StoredThread {
  if (!remote || remote.id !== local.id || base.id !== local.id || sameContactThread(local, remote)) return local;
  if (sameContactThread(local, base)) return remote;
  if (sameContactThread(remote, base)) return local;
  return {
    ...remote,
    title: local.title !== base.title ? local.title : remote.title,
    unread: local.unread !== base.unread ? local.unread : remote.unread,
    contact: local.contact ?? remote.contact,
    messages: mergeMessages(base.messages, local.messages, remote.messages),
    messageAt: { ...remote.messageAt, ...local.messageAt },
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}
