import { useMemo } from "react";
import type { UIMessage } from "ai";
import { readPageElementsPart } from "@/app/browser/page-element-part";
import { AnnotateIcon } from "@/components/foundations/icons/app-icons";

/**
 * The browser annotations a user message carried, under its text: each
 * element's note (or tag and selector when there is none) and its page. The
 * HTML and selector the model read stay out of the bubble; hovering a row
 * shows the page address and selector.
 */
export function MessagePageElements({ parts }: { parts: UIMessage["parts"] }) {
  const elements = useMemo(() => parts.flatMap((part) => readPageElementsPart(part) ?? []), [parts]);
  if (!elements.length) return null;
  return <ul aria-label={`网页标注 ${elements.length} 个`} className="ms-auto flex w-fit max-w-[75%] flex-col gap-1">
    {elements.map((element, index) => {
      const changes = Object.keys(element.changes ?? {}).length;
      return <li key={index} title={`${element.url}\n${element.selector || element.tag}`}
        className="flex min-w-0 items-center gap-2 rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-caption-1-regular text-text-secondary">
        <AnnotateIcon className="size-3.5 shrink-0 text-foreground-icon-secondary" aria-hidden />
        <span className="min-w-0 truncate text-text-primary">{element.comment || `<${element.tag}> ${element.text || element.selector}`}</span>
        {changes > 0 && <span className="shrink-0 text-text-tertiary">改动 {changes} 项样式</span>}
        <span className="max-w-40 shrink-0 truncate text-text-tertiary">{element.title || new URL(element.url).host}</span>
      </li>;
    })}
  </ul>;
}
