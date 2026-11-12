import type { ToolUIPart, UIMessage } from "ai";
import { readPlan, type PlanStep } from "./agent-plan";

/**
 * An assistant reply that used tools, in the order things happened: runs of
 * text between tool calls, each tool call, and the task checklist. The
 * checklist shows once, where the Agent first set it, with its latest steps.
 */
export type MessageSegment =
  | { kind: "text"; key: string; text: string }
  | { kind: "tool"; key: string; name: string; part: ToolUIPart }
  | { kind: "plan"; key: string; steps: PlanStep[] };

export const toolName = (part: ToolUIPart) => part.type.slice("tool-".length);

/** A call to one of this app's own tools (stored as `tool-<name>`). */
export const isToolUIPart = (part: UIMessage["parts"][number]): part is ToolUIPart => part.type.startsWith("tool-");

export const hasToolParts = (parts: UIMessage["parts"]) => parts.some(isToolUIPart);

export function messageSegments(parts: UIMessage["parts"]): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let latestPlan: PlanStep[] | undefined;
  for (const part of parts) {
    if (isToolUIPart(part) && toolName(part) === "update_plan") {
      const steps = readPlan(part.state === "output-available" ? part.output : part.input);
      if (steps.length > 0) latestPlan = steps;
    }
  }
  let planPlaced = false;
  for (const [index, part] of parts.entries()) {
    if (part.type === "text") {
      const last = segments[segments.length - 1];
      if (last?.kind === "text") last.text += part.text;
      else if (part.text) segments.push({ kind: "text", key: `text-${index}`, text: part.text });
    } else if (isToolUIPart(part)) {
      const name = toolName(part);
      if (name !== "update_plan") segments.push({ kind: "tool", key: part.toolCallId, name, part });
      else if (!planPlaced && latestPlan) {
        planPlaced = true;
        segments.push({ kind: "plan", key: part.toolCallId, steps: latestPlan });
      }
    }
  }
  return segments;
}

/** The approvals still waiting in a reply. */
export function pendingApprovals(parts: UIMessage["parts"]): ToolUIPart[] {
  return parts.filter((part): part is ToolUIPart => isToolUIPart(part) && part.state === "approval-requested");
}
