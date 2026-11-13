import { useMemo } from "react";
import type { UIMessage } from "ai";
import { messageSegments } from "@/app/agent/message-segments";
import { runChanges } from "@/app/agent/run-changes";
import { MessageReasoning } from "../message-reasoning";
import { ReplyBlocks } from "../reply-blocks";
import { AgentPlanCard } from "./agent-plan-card";
import { AgentToolCard } from "./agent-tool-card";
import { AgentToolGroup } from "./agent-tool-group";
import { AgentRunSummary } from "./agent-run-summary";
import { AgentStepLimit } from "./agent-step-limit";

/**
 * A reply that used tools, in the order things happened (message-segments):
 * the reasoning before each step, text, tool calls, groups of looks and the
 * task checklist, and anything the user added while it ran (插话). Once it is done, a reply that changed files more than once
 * ends with what it changed in all (AgentRunSummary).
 */
/** A message the user added mid-run, at the step that received it. */
function SteerNote({ text }: { text: string }) {
  return <div className="flex flex-col items-end gap-0.5">
    <span className="px-1 text-caption-1-regular text-text-tertiary">运行中插话</span>
    <p translate="no" className="max-w-[75%] rounded-2xl bg-background-primary-default px-3 py-2 text-body-2-regular break-words whitespace-pre-wrap text-text-primary shadow-card">{text}</p>
  </div>;
}

export function ToolReply({ parts, streaming, stepLimit = false }: { parts: UIMessage["parts"]; streaming: boolean; stepLimit?: boolean }) {
  const segments = useMemo(() => messageSegments(parts), [parts]);
  const changes = useMemo(() => streaming ? undefined : runChanges(parts), [parts, streaming]);
  return <div className="flex flex-col gap-2.5">
    {segments.map((segment) => {
      switch (segment.kind) {
        case "text": return <ReplyBlocks key={segment.key} text={segment.text} />;
        case "reasoning": return <MessageReasoning key={segment.key} text={segment.text} streaming={streaming && segment.streaming} />;
        case "plan": return <AgentPlanCard key={segment.key} steps={segment.steps} />;
        case "group": return <AgentToolGroup key={segment.key} items={segment.items} />;
        case "steer": return <SteerNote key={segment.key} text={segment.text} />;
        default: return <AgentToolCard key={segment.key} name={segment.name} part={segment.part} />;
      }
    })}
    {changes && changes.count > 1 && <AgentRunSummary changes={changes} />}
    {stepLimit && !streaming && <AgentStepLimit />}
  </div>;
}
