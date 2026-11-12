/**
 * The checklist the Agent keeps for a multi-step task (its `update_plan`
 * tool). Each call carries the whole list; the transcript shows the latest
 * one as the task progress card, the way Codex and Claude Code show theirs.
 */

export type PlanStatus = "pending" | "in_progress" | "completed";
export interface PlanStep { title: string; status: PlanStatus }

const STATUSES: readonly PlanStatus[] = ["pending", "in_progress", "completed"];
const MAX_STEPS = 20;
const MAX_TITLE = 200;

/** The steps of a plan input or output; malformed steps are dropped. */
export function readPlan(value: unknown): PlanStep[] {
  const steps = value !== null && typeof value === "object" ? (value as { steps?: unknown }).steps : undefined;
  if (!Array.isArray(steps)) return [];
  return steps.flatMap((step): PlanStep[] => {
    if (step === null || typeof step !== "object") return [];
    const { title, status } = step as { title?: unknown; status?: unknown };
    if (typeof title !== "string" || !title.trim() || !STATUSES.includes(status as PlanStatus)) return [];
    return [{ title: title.trim().slice(0, MAX_TITLE), status: status as PlanStatus }];
  }).slice(0, MAX_STEPS);
}

export interface PlanProgress { steps: PlanStep[]; done: number; current?: PlanStep }

export function planProgress(steps: readonly PlanStep[]): PlanProgress {
  return {
    steps: [...steps],
    done: steps.filter((step) => step.status === "completed").length,
    current: steps.find((step) => step.status === "in_progress"),
  };
}

/** "还剩 2 步", or "已完成" when every step is done. */
export function planRemainingLabel(progress: PlanProgress): string {
  const left = progress.steps.length - progress.done;
  return left === 0 ? "已完成" : `还剩 ${left} 步`;
}
