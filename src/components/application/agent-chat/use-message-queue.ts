import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatStatus, UIMessage } from "ai";
import { pendingApprovals } from "@/app/agent/message-segments";
import { steerRun } from "@/app/agent/run-steering";
import { mergeQueuedMessages, type QueuedMessage, type SendInput } from "@/app/agent/message-queue";

/**
 * Messages typed while the chat is answering. They wait under the composer
 * and go out as the next message once the run is done (all of them as one,
 * in order). One can instead be put into the running Agent now (插话): it
 * joins at the next step boundary, after the tool calls in flight, and shows
 * in the reply where the model received it. Nothing goes out by itself after
 * the user pressed stop, or while an approval waits; the queue belongs to the
 * open chat and is dropped when another chat opens.
 */
export function useMessageQueue({ conversationId, messages, status, send, runId, canSteer }: {
  conversationId: string;
  messages: UIMessage[];
  status: ChatStatus;
  send: (message: SendInput) => void;
  /** The id of the run going now, for steering. */
  runId: () => string;
  /** This window runs the chat itself (the desktop app) in a project, so a run can be steered. */
  canSteer: boolean;
}) {
  const busy = status === "submitted" || status === "streaming";
  const [queue, setQueue] = useState<{ id: string; items: QueuedMessage[]; stopped: boolean }>({ id: conversationId, items: [], stopped: false });
  const current = queue.id === conversationId ? queue : { id: conversationId, items: [], stopped: false };
  const items = current.items;
  const update = useCallback((change: (items: QueuedMessage[]) => QueuedMessage[], stopped?: boolean) => setQueue((state) => {
    const base = state.id === conversationId ? state : { id: conversationId, items: [], stopped: false };
    return { id: conversationId, items: change(base.items), stopped: stopped ?? base.stopped };
  }), [conversationId]);
  const nextId = useRef(0);

  const add = useCallback((text: string, message: SendInput) => {
    nextId.current += 1;
    update((list) => [...list, { id: `queued-${Date.now().toString(36)}-${nextId.current}`, text, message, state: "queued" }], false);
  }, [update]);

  const remove = useCallback((id: string) => update((list) => list.filter((item) => item.id !== id)), [update]);

  const steer = useCallback(async (id: string) => {
    const item = items.find((each) => each.id === id);
    if (!item || item.state !== "queued") return;
    const outcome = steerRun(runId(), item.text, id);
    if (!outcome) {
      update((list) => list.map((each) => each.id === id ? { ...each, note: "当前运行无法插话，会在结束后发送" } : each));
      return;
    }
    update((list) => list.map((each) => each.id === id ? { ...each, state: "steering", note: undefined } : each));
    const result = await outcome;
    // Delivered: it is in the reply now. Otherwise it goes out after the run.
    update((list) => result.type === "delivered" ? list.filter((each) => each.id !== id)
      : list.map((each) => each.id === id ? { ...each, state: "queued", note: "这一轮已结束，未能插入，会作为下一条发送" } : each));
  }, [items, runId, update]);

  /** The stop button: what is queued stays, and waits for 发送. */
  const markStopped = useCallback(() => { if (items.length > 0) update((list) => list, true); }, [items.length, update]);

  const sendNow = useCallback(() => {
    if (busy || items.length === 0) return;
    update(() => [], false);
    send(mergeQueuedMessages(items));
  }, [busy, items, send, update]);

  // The run is done: what waits goes out as the next message.
  const last = messages[messages.length - 1];
  const waiting = last?.role === "assistant" && pendingApprovals(last.parts).length > 0;
  const steering = items.some((item) => item.state === "steering");
  useEffect(() => {
    if (busy || status !== "ready" || current.stopped || waiting || steering || items.length === 0) return;
    update(() => []);
    send(mergeQueuedMessages(items));
  }, [busy, status, current.stopped, waiting, steering, items, send, update]);

  return { items, stopped: current.stopped, add, remove, steer, sendNow, markStopped, canSteer: canSteer && busy };
}

export type MessageQueue = ReturnType<typeof useMessageQueue>;
