import type { Experimental_Steering, Experimental_SteeringOutcome } from "ai";

/**
 * The Agent runs that can take a message mid-way, by the run id the window
 * sends with each request. The desktop app answers chats in the window
 * itself (desktop-chat-runtime.ts), so the composer reaches the running
 * generation directly; the dev server runs it in another process, where no
 * run is ever found here and the composer keeps messages queued instead.
 */
const runs = new Map<string, Experimental_Steering>();

export const RUN_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function openRun(id: string, steering: Experimental_Steering): void {
  runs.set(id, steering);
}

export function closeRun(id: string, steering: Experimental_Steering): void {
  if (runs.get(id) === steering) runs.delete(id);
}

/**
 * Adds `text` to run `id` at its next step boundary (after the tool calls in
 * flight). Undefined when no such run is going; otherwise the SDK's outcome,
 * which says whether the model received it.
 */
export function steerRun(id: string, text: string, messageId: string): Promise<Experimental_SteeringOutcome> | undefined {
  return runs.get(id)?.steer(text, { id: messageId });
}

export const canSteerRun = (id: string) => runs.has(id);
