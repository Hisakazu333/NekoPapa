/**
 * Output of the Agent's running commands, as it arrives, by tool call id.
 * The tool (agent-tools.ts) appends what the host streams; the command card
 * in the transcript reads it while the call runs. Once the call returns, its
 * saved result takes over and the live text is dropped. Readers are told at
 * most once per frame, however fast a command prints.
 */
const LIMIT = 64 * 1024;
const live = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const waiting = new Set<string>();
let scheduled = false;

const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (run: () => void) => setTimeout(run, 16);

function notify(id: string) {
  waiting.add(id);
  if (scheduled) return;
  scheduled = true;
  schedule(() => {
    scheduled = false;
    const ids = [...waiting];
    waiting.clear();
    for (const each of ids) for (const listener of listeners.get(each) ?? []) listener();
  });
}

/** Adds output; only the last 64 KB is kept, since the card shows the end. */
export function appendCommandOutput(id: string, text: string): void {
  if (!text) return;
  const next = (live.get(id) ?? "") + text;
  live.set(id, next.length > LIMIT ? next.slice(next.length - LIMIT) : next);
  notify(id);
}

/** The call returned: its result is in the message now. */
export function endCommandOutput(id: string): void {
  if (!live.delete(id)) return;
  notify(id);
}

export function readCommandOutput(id: string): string {
  return live.get(id) ?? "";
}

export function subscribeCommandOutput(id: string, listener: () => void): () => void {
  let set = listeners.get(id);
  if (!set) listeners.set(id, set = new Set());
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(id);
  };
}
