import { ArrowRightIcon, CircleCheckIcon, ListChecksIcon } from "@/components/foundations/icons/app-icons";
import { planProgress, planRemainingLabel, type PlanStep } from "@/app/agent/agent-plan";
import { cx } from "@/utils/cx";

/**
 * The Agent's checklist for a multi-step task (its update_plan calls), with
 * the latest state of each step: done steps struck through, the current one
 * marked, and how many are left.
 */
export function AgentPlanCard({ steps }: { steps: PlanStep[] }) {
  const progress = planProgress(steps);
  return <section aria-label="任务进度" className="overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default">
    <header className="flex h-9 items-center gap-2 border-b border-separator-border px-3">
      <ListChecksIcon className="size-3.5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
      <span className="text-caption-1-medium text-text-secondary">任务进度</span>
      <span className="ms-auto text-caption-1-regular text-text-tertiary tabular-nums">{progress.done}/{steps.length} · {planRemainingLabel(progress)}</span>
    </header>
    <ol className="flex flex-col gap-0.5 px-3 py-2">
      {steps.map((step, index) => <li key={index} className="flex items-start gap-2 py-0.5 text-body-2-regular">
        {step.status === "completed"
          ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-status-lime-text" aria-label="已完成" />
          : step.status === "in_progress"
            ? <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-text-primary" aria-label="进行中" />
            : <span aria-label="未开始" className="mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] border-foreground-icon-tertiary" />}
        <span className={cx("min-w-0 break-words",
          step.status === "completed" ? "text-text-tertiary line-through" : step.status === "in_progress" ? "text-text-primary" : "text-text-secondary")}>
          {step.title}
        </span>
      </li>)}
    </ol>
  </section>;
}
