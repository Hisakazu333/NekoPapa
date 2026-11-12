import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, CodeIcon, CopyIcon } from "@/components/foundations/icons/app-icons";
import { highlightCode, type HighlightLines } from "@/app/chat/code-highlight";
import { useThemeMode } from "@/components/application/theme/theme-toggle";
import { cx } from "@/utils/cx";

/**
 * A fenced code block in a reply: language and line count in the header, a
 * copy button, and the code with line numbers that scrolls sideways rather
 * than wrapping. While the block is still streaming the copy button waits
 * and the code stays plain; once it is complete it is highlighted (when the
 * language is known) in the colors of the current theme. `notice` shows a
 * line above the code, e.g. why a diagram or chart block could not be drawn.
 */
export function MessageCodeBlock({ lang, code, complete, notice, actions }: {
  lang: string;
  code: string;
  complete: boolean;
  notice?: ReactNode;
  /** Extra header controls (e.g. switching a diagram back to its picture). */
  actions?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [tokens, setTokens] = useState<{ code: string; lines: HighlightLines }>();
  const theme = useThemeMode();
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (!complete) return;
    let live = true;
    void highlightCode(code.replace(/\n$/, ""), lang).then((lines) => { if (live && lines) setTokens({ code, lines }); });
    return () => { live = false; };
  }, [code, complete, lang]);
  const lines = code.replace(/\n$/, "").split("\n");
  const highlighted = complete && tokens?.code === code ? tokens.lines : undefined;
  const copy = () => { void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => undefined); };

  return <figure className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <figcaption className="flex h-9 items-center gap-2 border-b border-separator-border ps-3 pe-1.5">
      <CodeIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span translate="no" className="min-w-0 truncate font-mono text-caption-1-medium text-text-secondary">{lang || "代码"}</span>
      <span className="text-caption-1-regular text-text-tertiary">{lines.length} 行{complete ? "" : " · 生成中"}</span>
      <span className="ms-auto flex items-center gap-0.5">
        {actions}
        <button type="button" onClick={copy} disabled={!complete} aria-label={copied ? "已复制代码" : "复制代码"} title={copied ? "已复制" : "复制代码"}
          className={cx("flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-caption-1-regular text-text-tertiary outline-none",
            "hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default disabled:opacity-50")}>
          {copied ? <CheckIcon className="size-3.5" aria-hidden /> : <CopyIcon className="size-3.5" aria-hidden />}{copied ? "已复制" : "复制"}
        </button>
      </span>
    </figcaption>
    {notice && <div role="alert" className="border-b border-separator-border px-3 py-2 text-caption-1-regular text-text-error-primary">{notice}</div>}
    <div translate="no" className="flex max-h-[480px] overflow-auto font-mono text-caption-1-regular leading-5">
      <pre aria-hidden className="sticky start-0 shrink-0 select-none bg-background-primary-default py-2 ps-3 pe-3 text-end text-text-tertiary">{lines.map((_, index) => index + 1).join("\n")}</pre>
      <pre className="flex-1 py-2 pe-4 text-text-primary"><code>{highlighted
        ? highlighted.map((line, index) => <span key={index}>{line.map((token, at) => {
          const color = theme === "dark" ? token.dark : token.light;
          return <span key={at} style={color ? { color } : undefined}>{token.content}</span>;
        })}{index < highlighted.length - 1 ? "\n" : ""}</span>)
        : lines.join("\n")}</code></pre>
    </div>
  </figure>;
}
