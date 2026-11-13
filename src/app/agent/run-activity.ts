import type { UIMessage } from "ai";
import { isRunningCall, isToolUIPart, pendingApprovals, toolName } from "./message-segments";
import { toolTitle } from "./tool-labels";

/**
 * The line above the composer while a reply runs: what the Agent is doing
 * this moment and which step of the run it is on ("正在运行 npm test · 第 4 步").
 * Read from the reply's own parts; the composer's indicator adds the time.
 * A step is one model call: the SDK marks each with a `step-start` part.
 */
export function runActivity(messages: UIMessage[], busy: boolean): string | undefined {
  if (!busy) return undefined;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return "正在等待回复";
  const steps = last.parts.filter((part) => part.type === "step-start").length;
  const step = steps > 1 ? ` · 第 ${steps} 步` : "";
  return `${currentAction(last.parts)}${step}`;
}

function currentAction(parts: UIMessage["parts"]): string {
  const running = parts.find((part) => isToolUIPart(part) && (part.state === "input-streaming" || isRunningCall(part)));
  if (running && isToolUIPart(running)) {
    const name = toolName(running);
    if (name === "update_plan") return "正在更新计划";
    // While the model is still writing the call, its input is incomplete.
    return running.state === "input-streaming" ? "正在准备工具调用" : toolTitle(name, running.input, false);
  }
  if (pendingApprovals(parts).length > 0) return "等待你的确认";
  // Only text still arriving is "replying"; everything else between calls is the model thinking.
  const latest = parts.filter((part) => part.type !== "step-start").at(-1);
  return latest?.type === "text" && latest.state === "streaming" ? "正在回复" : "正在思考";
}
