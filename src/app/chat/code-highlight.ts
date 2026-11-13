/**
 * Syntax highlighting for reply code blocks. Shiki and each language load
 * only when a finished block needs them, so the app starts without them.
 * The result is plain tokens carrying a light and a dark color; the view
 * renders them as text (no HTML is inserted) and picks the color by theme.
 * An unknown language, or a block too large to be worth the work, resolves
 * to undefined and the block stays plain.
 *
 * Tokenizing a long file takes Shiki from half a second to a few seconds, so
 * in the app it runs in a worker (code-highlight.worker.ts) and the window
 * keeps responding meanwhile; without workers (tests) it runs in place.
 */

import { tokenize } from "./code-highlight-engine";

export interface HighlightToken { content: string; light?: string; dark?: string }
export type HighlightLines = HighlightToken[][];

const MAX_CHARS = 200_000;
const ALIASES: Record<string, string> = { sh: "bash", shell: "bash", zsh: "bash", console: "bash", js: "javascript", ts: "typescript", py: "python", rs: "rust", yml: "yaml", md: "markdown", "c++": "cpp", "c#": "csharp", cs: "csharp", golang: "go", kt: "kotlin", rb: "ruby", ps1: "powershell" };
const cache = new Map<string, Promise<HighlightLines | undefined>>();

export const highlightLanguage = (lang: string) => ALIASES[lang] ?? lang;

export function highlightCode(code: string, lang: string): Promise<HighlightLines | undefined> {
  const language = highlightLanguage(lang.trim().toLowerCase());
  if (!language || language === "text" || language === "plaintext" || code.length > MAX_CHARS) return Promise.resolve(undefined);
  const key = `${language}\u0000${code}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = load(code, language);
    cache.set(key, pending);
    // Keep the cache small: the transcript re-renders, it does not need history.
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  return pending;
}

type Reply = { id: number; lines?: HighlightLines };
let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, (lines: HighlightLines | undefined) => void>();

function highlightWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === "undefined" || typeof window === "undefined" ? null
      : new Worker(new URL("./code-highlight.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (event: MessageEvent<Reply>) => {
      waiting.get(event.data.id)?.(event.data.lines);
      waiting.delete(event.data.id);
    };
    // A worker that cannot start leaves every block plain rather than waiting forever.
    worker.onerror = () => {
      for (const resolve of waiting.values()) resolve(undefined);
      waiting.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

async function load(code: string, language: string): Promise<HighlightLines | undefined> {
  const target = highlightWorker();
  if (target) {
    const id = nextId++;
    return new Promise((resolve) => {
      waiting.set(id, resolve);
      target.postMessage({ id, code, language });
    });
  }
  try {
    return await tokenize(code, language);
  } catch {
    return undefined;
  }
}
