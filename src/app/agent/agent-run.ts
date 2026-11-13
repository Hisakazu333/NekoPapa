import { experimental_createSteering, isStepCount, type ModelMessage, type ToolSet } from "ai";
import { pruneToolTraffic } from "../chat/context-budget";
import { PRUNE_AT } from "../chat/context-compaction";
import type { AgentHost } from "./agent-host";
import type { AgentAllowances, AgentWorkspace } from "./agent-request";
import { activeAgentTools, agentToolApproval, createAgentTools } from "./agent-tools";
import { closeRun, openRun, RUN_ID } from "./run-steering";
import { MAX_AGENT_STEPS } from "./step-limit";

/**
 * The tool loop's part of one streamText call in a project chat: the tools
 * the permission mode offers, which calls wait for the user (with what the
 * user already allowed in this chat), the step cap, and the steering that
 * lets the composer add a message while the run goes (keyed by `runId`).
 * Before each step, old tool output is trimmed once the run's messages pass
 * PRUNE_AT of the context window, so a long task does not overflow it.
 */
export function agentRunOptions(host: AgentHost, workspace: AgentWorkspace, allow: AgentAllowances, runId: unknown, contextWindow: number) {
  const steering = typeof runId === "string" && RUN_ID.test(runId) ? experimental_createSteering() : undefined;
  if (steering) openRun(runId as string, steering);
  const close = () => { if (steering) closeRun(runId as string, steering); };
  return {
    tools: createAgentTools(host, workspace.root) as ToolSet,
    activeTools: activeAgentTools(workspace.permission),
    toolApproval: agentToolApproval(workspace.permission, allow),
    stopWhen: isStepCount(MAX_AGENT_STEPS),
    // Returned messages carry forward to later steps, steering messages included.
    prepareStep: ({ messages }: { messages: ModelMessage[] }) => {
      const pruned = pruneToolTraffic(messages, contextWindow * PRUNE_AT);
      return pruned === messages ? undefined : { messages: pruned };
    },
    ...(steering ? { experimental_steering: steering } : {}),
    onEnd: close,
    // streamText logs errors by default; replacing the callback keeps that.
    onError: ({ error }: { error: unknown }) => { close(); console.error(error); },
    onAbort: close,
  };
}
