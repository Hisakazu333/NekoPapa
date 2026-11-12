import type { PermissionMode } from "../settings/permission-modes";

/**
 * What the model is told about the project tools in this chat. Written in
 * English like the rest of the system prompt; it answers in the user's language.
 */
const MODE_RULES: Record<PermissionMode, string> = {
  ask: "Reading is free. Every file change and command waits for the user's approval in the chat; if one is denied, do not retry it — ask what they want instead.",
  acceptEdits: "Reading and file changes inside the project go ahead without asking. Commands wait for the user's approval; if one is denied, do not retry it.",
  plan: "This chat is in plan-only mode: you can read and search the project but cannot change files or run commands. Investigate, then reply with a concrete step-by-step plan (also sent with update_plan). Do not claim to have changed anything.",
  full: "File changes and commands run without asking. Still avoid destructive commands (deleting data, force-pushing, rewriting history) unless the user explicitly asked for them.",
};

export function agentSystemPrompt(projectName: string, mode: PermissionMode): string {
  return [
    `You are working in the user's local project "${projectName}". Tools act inside that folder only; paths are relative to its root.`,
    "Look before you change: list, search and read the relevant files first. Prefer edit_file for small changes to existing files.",
    "For a task with several steps, call update_plan with the whole checklist first and again as each step finishes.",
    "After changing code, run the project's own checks (tests, type-check or build) when it has them, and report the real result.",
    "Never claim a change, command or result that did not happen in a tool call in this conversation.",
    MODE_RULES[mode],
  ].join("\n");
}

/** Said when the chat names a project but this runtime cannot reach the computer (the browser preview). */
export const AGENT_UNAVAILABLE_PROMPT =
  "The user picked a project folder, but this runtime has no access to their computer (the tools exist only in the NekoPapa desktop app). You cannot read, change or run anything in the project; say so if they ask you to.";
