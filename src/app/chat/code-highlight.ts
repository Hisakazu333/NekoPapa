/**
 * Syntax highlighting for reply code blocks. Shiki and each language load
 * only when a finished block needs them, so the app starts without them.
 * The result is plain tokens carrying a light and a dark color; the view
 * renders them as text (no HTML is inserted) and picks the color by theme.
 * An unknown language, or a block too large to be worth the work, resolves
 * to undefined and the block stays plain.
 */

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

async function load(code: string, language: string): Promise<HighlightLines | undefined> {
  try {
    const { bundledLanguages, codeToTokens } = await import("shiki");
    if (!Object.prototype.hasOwnProperty.call(bundledLanguages, language)) return undefined;
    const result = await codeToTokens(code, { lang: language as never, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false });
    return result.tokens.map((line) => line.map((token) => ({
      content: token.content,
      light: token.htmlStyle?.["--shiki-light"],
      dark: token.htmlStyle?.["--shiki-dark"],
    })));
  } catch {
    return undefined;
  }
}
