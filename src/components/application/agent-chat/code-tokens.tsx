import { useEffect, useState } from "react";
import { highlightCode, type HighlightLines, type HighlightToken } from "@/app/chat/code-highlight";

/**
 * Highlighted lines for `text` in `lang`, once Shiki has them. Until then,
 * and for plain text or an unknown language, it is undefined and callers
 * show the text uncolored, so nothing waits on the highlighter.
 */
export function useHighlightedLines(text: string, lang: string, enabled = true): HighlightLines | undefined {
  const [result, setResult] = useState<{ key: string; lines: HighlightLines }>();
  const key = `${lang}\u0000${text}`;
  useEffect(() => {
    if (!enabled || !lang) return;
    let live = true;
    void highlightCode(text, lang).then((lines) => { if (live && lines) setResult({ key, lines }); });
    return () => { live = false; };
  }, [enabled, key, lang, text]);
  return enabled && result?.key === key ? result.lines : undefined;
}

/**
 * One highlighted line in its light or dark colors. The caller reads the
 * theme once (useThemeMode) rather than every line subscribing to it.
 */
export function CodeTokens({ tokens, dark }: { tokens: readonly HighlightToken[]; dark: boolean }) {
  return <>{tokens.map((token, index) => {
    const color = dark ? token.dark : token.light;
    return <span key={index} style={color ? { color } : undefined}>{token.content}</span>;
  })}</>;
}
