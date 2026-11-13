import { jsonSchema, tool, type JSONSchema7, type ToolApprovalConfiguration, type ToolSet } from "ai";
import type { PermissionMode } from "../settings/permission-modes";
import type { AgentHost, CommandResult, FileChange } from "./agent-host";
import { readPlan, type PlanStep } from "./agent-plan";

/**
 * The tools the chat Agent may call in one project folder, and which of them
 * need the user's approval under each permission mode (设置 → 权限规则 and the
 * composer's 权限 menu). Tool names are part of saved chat history: each call
 * is stored as a `tool-<name>` part and rendered by agent-tool-card.tsx.
 */

export const AGENT_TOOL_NAMES = ["list_files", "read_file", "search_files", "write_file", "edit_file", "run_command", "update_plan"] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

const READ_TOOLS: AgentToolName[] = ["list_files", "read_file", "search_files", "update_plan"];
const EDIT_TOOLS: AgentToolName[] = ["write_file", "edit_file"];

/** Lines of a file sent to the model in one read; the model asks for the next range. */
export const READ_LINES = 400;
/** Characters of a file sent to the model in one read, so one minified file cannot fill the context. */
export const MAX_READ_CHARS = 60_000;
const MAX_MODEL_OUTPUT = 12_000;

export interface ReadOutput { path: string; startLine: number; endLine: number; totalLines: number; text: string; note?: string }

const clip = (value: string, limit = MAX_MODEL_OUTPUT) =>
  value.length > limit ? `${value.slice(0, limit)}\n…（已截断，共 ${value.length} 个字符）` : value;

const object = (properties: Record<string, JSONSchema7>, required: string[]): JSONSchema7 =>
  ({ type: "object", properties, required, additionalProperties: false });

/**
 * The lines from `start`, at most READ_LINES of them and at most
 * MAX_READ_CHARS characters — cut on a line boundary, because half a line is
 * indistinguishable from real code once the model reads it, and a line cut
 * mid-token silently turns a correct file into a wrong fact. Stopping early
 * says which limit did it and where to continue; only a single line longer
 * than the whole budget comes back partial, and its note says so.
 */
function readRange(lines: readonly string[], start: number): { text: string; end: number; note?: string } {
  const kept: string[] = [];
  let size = 0;
  let overChars = false;
  let partialLine = false;
  for (const line of lines.slice(start - 1, start - 1 + READ_LINES)) {
    const cost = (kept.length > 0 ? 1 : 0) + line.length;
    if (size + cost > MAX_READ_CHARS) {
      overChars = true;
      // Nothing kept yet: this one line is longer than the whole budget, so
      // return its beginning and say plainly that the line is incomplete.
      if (kept.length === 0) {
        kept.push(line.slice(0, MAX_READ_CHARS));
        partialLine = true;
      }
      break;
    }
    kept.push(line);
    size += cost;
  }
  const end = start - 1 + kept.length;
  const note = partialLine
    ? `第 ${start} 行本身超过单次读取 ${MAX_READ_CHARS} 字符上限，这里只有它的前 ${MAX_READ_CHARS} 个字符，这一行不完整。`
    : overChars
      ? `单次读取最多 ${MAX_READ_CHARS} 字符，已在第 ${end} 行停止；继续读请传 startLine=${end + 1}，文件共 ${lines.length} 行。`
      : undefined;
  return { text: kept.join("\n"), end, note };
}

/** Tools that act in `root` through `host`. Paths are relative to the project folder. */
export function createAgentTools(host: AgentHost, root: string): ToolSet {
  return {
    list_files: tool({
      description: "List one folder of the project. Use an empty path for the project root.",
      inputSchema: jsonSchema<{ path?: string }>(object({ path: { type: "string", description: "Folder relative to the project root." } }, [])),
      execute: async ({ path }) => {
        const listing = await host.list(root, path ?? "");
        return { path: path ?? "", entries: listing.entries.map(({ name, kind, size }) => ({ name, kind, size })), truncated: listing.truncated };
      },
    }),
    read_file: tool({
      description: `Read a text file of the project, ${READ_LINES} lines or ${MAX_READ_CHARS} characters at a time, always in whole lines. Pass startLine to read further; the note says when a limit stopped it early and where to continue.`,
      inputSchema: jsonSchema<{ path: string; startLine?: number }>(object({
        path: { type: "string", description: "File relative to the project root." },
        startLine: { type: "integer", minimum: 1, description: "First line to return (1-based)." },
      }, ["path"])),
      execute: async ({ path, startLine }): Promise<ReadOutput> => {
        const file = await host.read(root, path);
        if (file.binary || file.tooLarge || file.text === undefined) {
          return { path, startLine: 0, endLine: 0, totalLines: 0, text: "", note: file.binary ? "二进制文件，无法以文本读取。" : "文件超过 512 KB，无法读取。" };
        }
        const lines = file.text.split("\n");
        const asked = Math.floor(startLine ?? 1);
        // Past the end: say so instead of quietly returning the last line as if
        // it were the one asked for.
        if (asked > lines.length) {
          return { path, startLine: 0, endLine: 0, totalLines: lines.length, text: "", note: `文件只有 ${lines.length} 行，没有第 ${asked} 行。` };
        }
        const start = Math.max(1, asked);
        const range = readRange(lines, start);
        return { path, startLine: start, endLine: range.end, totalLines: lines.length, text: range.text, note: range.note };
      },
    }),
    search_files: tool({
      description: "Find text (case-insensitive) in the project's files, and files whose path contains it. Skips .git, node_modules and build output.",
      inputSchema: jsonSchema<{ query: string }>(object({ query: { type: "string", minLength: 1 } }, ["query"])),
      execute: async ({ query }) => host.search(root, query, 50),
    }),
    write_file: tool({
      description: "Create a file or replace its whole contents. Prefer edit_file for changes to an existing file.",
      inputSchema: jsonSchema<{ path: string; content: string }>(object({ path: { type: "string" }, content: { type: "string" } }, ["path", "content"])),
      execute: async ({ path, content }): Promise<FileChange> => host.write(root, path, content),
      toModelOutput: ({ output }) => ({ type: "text", value: changeSummary(output as FileChange) }),
    }),
    edit_file: tool({
      description: "Replace one exact, unique passage of an existing file. Read the file first; include enough surrounding text to make oldText unique.",
      inputSchema: jsonSchema<{ path: string; oldText: string; newText: string }>(object({
        path: { type: "string" }, oldText: { type: "string", minLength: 1 }, newText: { type: "string" },
      }, ["path", "oldText", "newText"])),
      execute: async ({ path, oldText, newText }): Promise<FileChange> => host.edit(root, path, oldText, newText),
      toModelOutput: ({ output }) => ({ type: "text", value: changeSummary(output as FileChange) }),
    }),
    run_command: tool({
      description: "Run a shell command in the project folder (no input; output is captured). Use for tests, builds, git and other CLI tools.",
      inputSchema: jsonSchema<{ command: string; timeoutSeconds?: number }>(object({
        command: { type: "string", minLength: 1 },
        timeoutSeconds: { type: "integer", minimum: 1, maximum: 600, description: "Defaults to 120." },
      }, ["command"])),
      execute: async ({ command, timeoutSeconds }, { abortSignal }): Promise<CommandResult> =>
        host.run(root, command, timeoutSeconds ?? 120, abortSignal),
      toModelOutput: ({ output }) => ({ type: "text", value: commandSummary(output as CommandResult) }),
    }),
    update_plan: tool({
      description: "Show the user your plan for a multi-step task as a checklist, and update it as steps finish. Send the whole list each time.",
      inputSchema: jsonSchema<{ steps: PlanStep[] }>(object({
        steps: { type: "array", minItems: 1, maxItems: 20, items: object({
          title: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["pending", "in_progress", "completed"] },
        }, ["title", "status"]) },
      }, ["steps"])),
      execute: async (input) => ({ steps: readPlan(input) }),
    }),
  };
}

function changeSummary(change: FileChange) {
  return `${change.created ? "Created" : "Updated"} ${change.path} (+${change.added} −${change.removed}).`;
}

function commandSummary(result: CommandResult) {
  const status = result.cancelled ? "stopped by the user" : result.timedOut ? "timed out" : `exit code ${result.exitCode}`;
  return [`Command ${status}.`, result.stdout && `stdout:\n${clip(result.stdout)}`, result.stderr && `stderr:\n${clip(result.stderr)}`,
    result.truncated ? "(Output was longer than the captured limit.)" : ""].filter(Boolean).join("\n");
}

/** The tools offered at all: 仅计划 offers only reading and the plan. */
export function activeAgentTools(mode: PermissionMode): AgentToolName[] {
  return mode === "plan" ? READ_TOOLS : [...AGENT_TOOL_NAMES];
}

/** Which calls wait for the user, which go ahead, by permission mode. */
export function agentToolApproval(mode: PermissionMode): ToolApprovalConfiguration<ToolSet, never> {
  const edits = mode === "acceptEdits" || mode === "full" ? "approved" : mode === "plan" ? "denied" : "user-approval";
  const commands = mode === "full" ? "approved" : mode === "plan" ? "denied" : "user-approval";
  return {
    ...Object.fromEntries(READ_TOOLS.map((name) => [name, "not-applicable"])),
    ...Object.fromEntries(EDIT_TOOLS.map((name) => [name, edits])),
    run_command: commands,
  };
}
