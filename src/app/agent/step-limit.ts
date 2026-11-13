/**
 * The Agent's step cap: one request runs at most this many model calls, so a
 * model looping on its tools cannot run (and bill) without end. A run that
 * hits it while still calling tools stopped mid-task, not because it was
 * done; the reply says so and offers to continue (`metadata.stepLimit`).
 */
export const MAX_AGENT_STEPS = 30;

export function stepLimitReached(steps: number, finishReason: unknown): boolean {
  return steps >= MAX_AGENT_STEPS && finishReason === "tool-calls";
}

/** Whether a saved reply stopped at the step cap. */
export function readStepLimit(metadata: unknown): boolean {
  return Boolean(metadata) && typeof metadata === "object" && (metadata as { stepLimit?: unknown }).stepLimit === true;
}
