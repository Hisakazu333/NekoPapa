import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * The terminal panel's shell session (src-tauri/src/terminal.rs). One session
 * per project folder lives for the app's lifetime, so closing and reopening
 * the panel, or switching chats in the same project, returns to the same
 * shell; its recent output is kept here and replayed into the new view.
 */

const REPLAY_LIMIT = 256 * 1024;

type Listener = (event: { kind: "output"; data: string } | { kind: "exit" }) => void;

export interface TerminalSession {
  readonly id: number;
  readonly cwd: string | undefined;
  /** Output so far (the newest REPLAY_LIMIT characters). */
  replay(): string;
  exited(): boolean;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  subscribe(listener: Listener): () => void;
  close(): Promise<void>;
}

export const terminalAvailable = () => isTauri();

const sessions = new Map<string, Promise<TerminalSession>>();
let routing: Promise<void> | undefined;
const byId = new Map<number, { push(data: string): void; end(): void }>();

/** One pair of app-wide event listeners routes output to the session it belongs to. */
function route() {
  routing ??= (async () => {
    await listen<{ id: number; data: string }>("terminal://output", ({ payload }) => byId.get(payload.id)?.push(payload.data));
    await listen<{ id: number }>("terminal://exit", ({ payload }) => byId.get(payload.id)?.end());
  })();
  return routing;
}

/** 设置 → 编辑器与终端 → Shell; "system" is the login shell ($SHELL). */
export type TerminalShell = "system" | "zsh" | "bash" | "fish" | "pwsh";
const keyOf = (cwd: string | undefined, shell: TerminalShell) => `${shell}:${cwd ?? "~"}`;

async function start(cwd: string | undefined, cols: number, rows: number, shell: TerminalShell): Promise<TerminalSession> {
  await route();
  const id = await invoke<number>("terminal_open", { cwd: cwd ?? null, cols, rows, shell });
  let buffer = "";
  let ended = false;
  const listeners = new Set<Listener>();
  byId.set(id, {
    push(data) {
      buffer = (buffer + data).slice(-REPLAY_LIMIT);
      for (const listener of listeners) listener({ kind: "output", data });
    },
    end() {
      ended = true;
      byId.delete(id);
      sessions.delete(keyOf(cwd, shell));
      for (const listener of listeners) listener({ kind: "exit" });
    },
  });
  const ignore = () => undefined;
  return {
    id, cwd,
    replay: () => buffer,
    exited: () => ended,
    write: (data) => { if (!ended) void invoke("terminal_write", { id, data }).catch(ignore); },
    resize: (cols, rows) => { if (!ended) void invoke("terminal_resize", { id, cols, rows }).catch(ignore); },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    async close() {
      sessions.delete(keyOf(cwd, shell));
      byId.delete(id);
      ended = true;
      await invoke("terminal_close", { id }).catch(ignore);
    },
  };
}

/** The live session for this folder and shell, or a new one. */
export function terminalFor(cwd: string | undefined, cols: number, rows: number, shell: TerminalShell = "system"): Promise<TerminalSession> {
  const key = keyOf(cwd, shell);
  const existing = sessions.get(key);
  if (existing) return existing;
  const created = start(cwd, cols, rows, shell);
  sessions.set(key, created);
  created.catch(() => sessions.delete(key));
  return created;
}
