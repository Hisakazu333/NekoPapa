import { useMemo } from "react";
import { checkChart } from "@/app/chat/chart-spec";
import { MessageChart } from "./message-chart";
import { MessageCodeBlock } from "./message-code-block";
import { MessageDiagram } from "./message-diagram";
import { MessageMarkdown } from "./message-markdown";

/**
 * A fenced block of a reply, by its language: ```mermaid becomes a diagram,
 * ```chart a chart, ```math display math; everything else is a code card.
 * Until the block is complete (still streaming) it shows as code, so a half
 * written diagram or chart never flashes an error.
 */
export function MessageRichBlock({ lang, code, complete }: { lang: string; code: string; complete: boolean }) {
  if (!complete) return <MessageCodeBlock lang={lang} code={code} complete={false} />;
  if (lang === "mermaid") return <MessageDiagram code={code} />;
  if (lang === "chart") return <ChartBlock code={code} />;
  if (lang === "math") return <div className="overflow-x-auto"><MessageMarkdown text={`$$\n${code.trim()}\n$$`} /></div>;
  return <MessageCodeBlock lang={lang} code={code} complete />;
}

function ChartBlock({ code }: { code: string }) {
  const check = useMemo(() => checkChart(code), [code]);
  if (check.ok) return <MessageChart chart={check.chart} />;
  return <MessageCodeBlock lang="chart" code={code} complete notice={`图表没有画出来：${check.errors.join(" ")}`} />;
}
