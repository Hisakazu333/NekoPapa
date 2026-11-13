import type { ToolUIPart, UIMessage } from "ai";
import { readPlan, type PlanStep } from "./agent-plan";

/**
 * An assistant reply that used tools, in the order things happened: runs of
 * text between tool calls, the reasoning before each step, each tool call,
 * and the task checklist. The checklist shows once, where the Agent first set
 * it, with its latest steps.
 *
 * Two or more looks in a row (reading, listing, searching) fold into one
 * group, as "读取了 3 个文件": they are how the Agent finds its way, and one
 * line each pushed the edits and commands that matter off the screen.
 * Reasoning between those looks stays inside the group, in order.
 */
export type ToolSegment = { kind: "tool"; key: string; name: string; part: ToolUIPart };
export type ReasoningSegment = { kind: "reasoning"; key: string; text: string; streaming: boolean };
export type MessageSegment =
  | { kind: "text"; key: string; text: string }
  | ReasoningSegment
  | ToolSegment
  | { kind: "group"; key: string; items: (ToolSegment | ReasoningSegment)[] }
  /** A message the user added while the reply ran (插话), where the model received it. */
  | { kind: "steer"; key: string; text: string }
  | { kind: "plan"; key: string; steps: PlanStep[] };

export const toolName = (part: ToolUIPart) => part.type.slice("tool-".length);

/** A call to one of this app's own tools (stored as `tool-<name>`). */
export const isToolUIPart = (part: UIMessage["parts"][number]): part is ToolUIPart => part.type.startsWith("tool-");

export const hasToolParts = (parts: UIMessage["parts"]) => parts.some(isToolUIPart);

/** A reply laid out in order (ToolReply): it used tools, or the user added a message while it ran. */
export const hasOrderedParts = (parts: UIMessage["parts"]) => parts.some((part) => isToolUIPart(part) || part.type === "steering-message");

/** Tools that only look at the project; a run of them folds into one group. */
export const LOOK_TOOLS = new Set(["read_file", "list_files", "search_files", "find_files"]);
const isLook = (segment: MessageSegment) => segment.kind === "tool" && LOOK_TOOLS.has(segment.name);

export function messageSegments(parts: UIMessage["parts"]): MessageSegment[] {
  return groupLooks(orderedSegments(parts));
}

function orderedSegments(parts: UIMessage["parts"]): MessageSegment[] {
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
    const last = segments[segments.length - 1];
    if (part.type === "text") {
      if (last?.kind === "text") last.text += part.text;
      // Blank text between two calls says nothing and would split a group.
      else if (part.text.trim()) segments.push({ kind: "text", key: `text-${index}`, text: part.text });
    } else if (part.type === "reasoning") {
      if (last?.kind === "reasoning") { last.text += part.text; last.streaming = part.state === "streaming"; }
      else if (part.text.trim() || part.state === "streaming") segments.push({ kind: "reasoning", key: `reasoning-${index}`, text: part.text, streaming: part.state === "streaming" });
    } else if (part.type === "steering-message") {
      const text = part.parts.flatMap((each) => each.type === "text" ? [each.text] : []).join("");
      if (text.trim()) segments.push({ kind: "steer", key: `steer-${part.id}`, text });
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

function groupLooks(segments: MessageSegment[]): MessageSegment[] {
  const result: MessageSegment[] = [];
  let index = 0;
  while (index < segments.length) {
    const first = segments[index];
    if (!isLook(first)) { result.push(first); index += 1; continue; }
    // The run: looks, with reasoning between them; it ends at the last look.
    let end = index;
    for (let next = index + 1; next < segments.length; next += 1) {
      if (isLook(segments[next])) end = next;
      else if (segments[next].kind !== "reasoning") break;
    }
    const items = segments.slice(index, end + 1) as (ToolSegment | ReasoningSegment)[];
    if (items.filter((item) => item.kind === "tool").length > 1) result.push({ kind: "group", key: `group-${first.key}`, items });
    else result.push(...items);
    index = end + 1;
  }
  return result;
}

/**
 * The approvals still waiting for the user in a reply. A call the permission
 * mode or an allowance already approved passes through approval-requested
 * too, marked automatic: that one is running, not waiting.
 */
export function pendingApprovals(parts: UIMessage["parts"]): ToolUIPart[] {
  return parts.filter((part): part is ToolUIPart => isToolUIPart(part) && part.state === "approval-requested" && !part.approval.isAutomatic);
}

/** A call executing now: its input is complete, or it was approved and has no result yet. */
export function isRunningCall(part: ToolUIPart): boolean {
  return part.state === "input-available" || (part.state === "approval-requested" && part.approval.isAutomatic === true)
    || (part.state === "approval-responded" && part.approval.approved === true);
}
