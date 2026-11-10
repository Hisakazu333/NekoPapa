import { useEffect, useState } from "react";
import { CheckIcon, CodeIcon, CopyIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";

/**
 * A fenced code block in a reply: language and line count in the header, a
 * copy button, and the code with line numbers that scrolls sideways rather
 * than wrapping. While the block is still streaming the copy button waits.
 */
export function MessageCodeBlock({ lang, code, complete }: { lang: string; code: string; complete: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const lines = code.replace(/\n$/, "").split("\n");
  const copy = () => { void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => undefined); };

  return <figure className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <figcaption className="flex h-9 items-center gap-2 border-b border-separator-border ps-3 pe-1.5">
      <CodeIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span translate="no" className="min-w-0 truncate font-mono text-caption-1-medium text-text-secondary">{lang || "代码"}</span>
      <span className="text-caption-1-regular text-text-tertiary">{lines.length} 行{complete ? "" : " · 生成中"}</span>
      <button type="button" onClick={copy} disabled={!complete} aria-label={copied ? "已复制代码" : "复制代码"} title={copied ? "已复制" : "复制代码"}
        className={cx("ms-auto flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-caption-1-regular text-text-tertiary outline-none",
          "hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default disabled:opacity-50")}>
        {copied ? <CheckIcon className="size-3.5" aria-hidden /> : <CopyIcon className="size-3.5" aria-hidden />}{copied ? "已复制" : "复制"}
      </button>
    </figcaption>
    <div translate="no" className="flex max-h-[480px] overflow-auto font-mono text-caption-1-regular leading-5">
      <pre aria-hidden className="sticky start-0 shrink-0 select-none bg-background-primary-default py-2 ps-3 pe-3 text-end text-text-tertiary">{lines.map((_, index) => index + 1).join("\n")}</pre>
      <pre className="flex-1 py-2 pe-4 text-text-primary"><code>{lines.join("\n")}</code></pre>
    </div>
  </figure>;
}
