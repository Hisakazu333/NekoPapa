import type { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import type { HighlightLines } from "./code-highlight";

/**
 * The Shiki highlighter itself, used inside the highlight worker (and
 * directly where there is no worker, as in tests). One highlighter is made
 * once with both themes; each language loads the first time it is asked for.
 *
 * Shiki's regular-expression engine is WebAssembly. The desktop app's CSP
 * does not allow compiling WebAssembly, so when that engine cannot start the
 * highlighter uses Shiki's JavaScript engine instead: slower, but it runs in
 * the worker, where its time never blocks the window.
 */
const THEMES = { light: "github-light", dark: "github-dark" } as const satisfies Record<string, BundledTheme>;
let highlighter: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | undefined;

async function create(): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> {
  const { createHighlighter } = await import("shiki");
  const themes = [THEMES.light, THEMES.dark];
  try {
    const { createOnigurumaEngine } = await import("shiki/engine/oniguruma");
    return await createHighlighter({ themes, langs: [], engine: createOnigurumaEngine(import("shiki/wasm")) });
  } catch {
    const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
    return await createHighlighter({ themes, langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) });
  }
}

/** Tokens for `code` in `language` with a light and a dark color each; undefined for a language Shiki does not have. */
export async function tokenize(code: string, language: string): Promise<HighlightLines | undefined> {
  const { bundledLanguages } = await import("shiki");
  if (!Object.prototype.hasOwnProperty.call(bundledLanguages, language)) return undefined;
  highlighter ??= create();
  const shiki = await highlighter.catch((error: unknown) => { highlighter = undefined; throw error; });
  const lang = language as BundledLanguage;
  if (!shiki.getLoadedLanguages().includes(lang)) await shiki.loadLanguage(lang);
  return shiki.codeToTokens(code, { lang, themes: THEMES, defaultColor: false }).tokens.map((line) => line.map((token) => ({
    content: token.content,
    light: token.htmlStyle?.["--shiki-light"],
    dark: token.htmlStyle?.["--shiki-dark"],
  })));
}
