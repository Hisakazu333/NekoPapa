import { useDeferredValue, useMemo } from "react";
import { splitMessageBlocks } from "@/app/chat/message-blocks";
import { MessageMarkdown } from "./message-markdown";
import { MessageRichBlock } from "./message-rich-block";

/** Prose as Markdown; fenced blocks as code, diagrams, charts or math (message-rich-block). */
export function ReplyBlocks({ text }: { text: string }) {
  // Rendering new tokens yields to scrolling and input; the text catches up
  // in the next idle frame instead of blocking the transcript.
  const shown = useDeferredValue(text);
  const blocks = useMemo(() => splitMessageBlocks(shown), [shown]);
  return <div className="flex flex-col gap-3">
    {blocks.map((block, index) => block.kind === "code"
      ? <MessageRichBlock key={index} lang={block.lang} code={block.code} complete={block.complete} />
      : <MessageMarkdown key={index} text={block.text} />)}
  </div>;
}
