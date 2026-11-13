import { tokenize } from "./code-highlight-engine";
import type { HighlightLines } from "./code-highlight";

/**
 * Runs Shiki off the window's thread (code-highlight.ts posts here):
 * `{ id, code, language }` in, `{ id, lines }` out, with `lines` undefined
 * when the language is unknown or highlighting failed. Typed locally: the
 * project compiles with the DOM library, not the worker one.
 */
type Request = { id: number; code: string; language: string };
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (reply: { id: number; lines?: HighlightLines }) => void;
};

scope.onmessage = async (event) => {
  const { id, code, language } = event.data;
  let lines: HighlightLines | undefined;
  try { lines = await tokenize(code, language); } catch { lines = undefined; }
  scope.postMessage({ id, lines });
};
