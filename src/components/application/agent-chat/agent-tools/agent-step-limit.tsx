import { CircleAlertIcon } from "@/components/foundations/icons/app-icons";
import { Button } from "@/components/base/buttons/button";
import { MAX_AGENT_STEPS } from "@/app/agent/step-limit";
import { useAgentToolActions } from "./agent-tool-actions";

/** Under the last reply when the run hit the step cap mid-task: says so, and 继续 picks it back up. */
export function AgentStepLimit() {
  const { continueRun, canRespond } = useAgentToolActions();
  return <div role="status" className="flex items-center gap-2 rounded-2xl border border-separator-border bg-background-primary-default px-3 py-2">
    <CircleAlertIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
    <p className="min-w-0 flex-1 text-caption-1-regular text-text-secondary">
      已达到单次运行的 {MAX_AGENT_STEPS} 步上限，任务可能还没做完。
    </p>
    <Button variant="secondary" size="xs" disabled={!canRespond} onClick={continueRun}>继续</Button>
  </div>;
}
