import { FileSearchIcon } from "@/components/foundations/icons/app-icons";
import { lookSummary, toolTitle } from "@/app/agent/tool-labels";
import type { ReasoningSegment, ToolSegment } from "@/app/agent/message-segments";
import { MessageReasoning } from "../message-reasoning";
import { AgentToolCard } from "./agent-tool-card";
import { AgentToolRow } from "./agent-tool-row";

/**
 * A run of reads, listings and searches as one line ("读取了 3 个文件，搜索了
 * 1 次"). While one of them runs the line names it, with what is done so far
 * after it. Opening the line shows every call, and the reasoning between
 * them, in order; each call there still opens to its own result.
 */
export function AgentToolGroup({ items }: { items: (ToolSegment | ReasoningSegment)[] }) {
  const tools = items.filter((item): item is ToolSegment => item.kind === "tool");
  const running = tools.find((tool) => tool.part.state !== "output-available" && tool.part.state !== "output-error");
  const done = lookSummary(tools.filter((tool) => tool !== running).map((tool) => ({ name: tool.name, input: tool.part.input })));
  const failed = tools.some((tool) => tool.part.state === "output-error");
  return <AgentToolRow icon={FileSearchIcon} running={Boolean(running)} failed={!running && failed}
    title={running ? toolTitle(running.name, running.part.input, false) : done}
    detail={running ? done : failed ? "部分失败" : undefined}>
    <div className="flex flex-col gap-1 py-0.5">
      {items.map((item) => item.kind === "tool"
        ? <AgentToolCard key={item.key} name={item.name} part={item.part} />
        : <MessageReasoning key={item.key} text={item.text} streaming={false} />)}
    </div>
  </AgentToolRow>;
}
