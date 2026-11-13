import { jsonSchema, tool, type JSONSchema7, type ToolApprovalConfiguration, type ToolSet } from "ai";
import type { PermissionMode } from "../settings/permission-modes";
import type { AgentAllowances } from "./agent-request";
import type { AgentHost, CommandResult, FileChange, Replacement } from "./agent-host";
import { globMatcher, searchPathSource } from "./glob";
import { readEdits } from "./change-preview";
import { readPlan, type PlanStep } from "./agent-plan";
import { appendCommandOutput, endCommandOutput } from "./command-output";

/**
 * The tools the chat Agent may call in one project folder, and which of them
 * need the user's approval under each permission mode (设置 → 权限规则 and the
 * composer's 权限 menu). Tool names are part of saved chat history: each call
 * is stored as a `tool-<name>` part and rendered by agent-tool-card.tsx.
 */

export const AGENT_TOOL_NAMES = ["list_files", "find_files", "read_file", "search_files", "write_file", "edit_file", "run_command", "update_plan"] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

const READ_TOOLS: AgentToolName[] = ["list_files", "find_files", "read_file", "search_files", "update_plan"];
const EDIT_TOOLS: AgentToolName[] = ["write_file", "edit_file"];

/** Lines of a file sent to the model in one read; the model asks for the next range. */
export const READ_LINES = 2000;
/** Characters of a file sent to the model in one read, so one minified file cannot fill the context. */
export const MAX_READ_CHARS = 80_000;
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
function readRange(lines: readonly string[], start: number, count = READ_LINES): { text: string; end: number; note?: string } {
  const kept: string[] = [];
  let size = 0;
  let overChars = false;
  let partialLine = false;
  for (const line of lines.slice(start - 1, start - 1 + count)) {
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
      description: `Read a text file of the project, up to ${READ_LINES} lines or ${MAX_READ_CHARS} characters at a time, always in whole lines. Pass startLine (and lineCount) to read a part; the note says when a limit stopped it early and where to continue.`,
      inputSchema: jsonSchema<{ path: string; startLine?: number; lineCount?: number }>(object({
        path: { type: "string", description: "File relative to the project root." },
        startLine: { type: "integer", minimum: 1, description: "First line to return (1-based)." },
        lineCount: { type: "integer", minimum: 1, maximum: READ_LINES, description: `How many lines to return; defaults to ${READ_LINES}.` },
      }, ["path"])),
      execute: async ({ path, startLine, lineCount }): Promise<ReadOutput> => {
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
        const range = readRange(lines, start, Math.min(READ_LINES, Math.max(1, Math.floor(lineCount ?? READ_LINES))));
        return { path, startLine: start, endLine: range.end, totalLines: lines.length, text: range.text, note: range.note };
      },
    }),
    find_files: tool({
      description: "Find files by name pattern (glob): * within a folder name, ** across folders, ? one character, {a,b} either. A pattern without / matches at any depth (\"*.test.ts\"); with / it is from the project root (\"src/**/*.tsx\"). Skips .git, node_modules and build output.",
      inputSchema: jsonSchema<{ pattern: string }>(object({ pattern: { type: "string", minLength: 1 } }, ["pattern"])),
      execute: async ({ pattern }) => findFiles(await host.files(root), pattern),
    }),
    search_files: tool({
      description: "Search the contents of the project's files (and their paths). Plain text by default, case-insensitive; set regex for a regular expression (Rust/JavaScript syntax), caseSensitive to match case, include for a file pattern (glob, like find_files) and path for a folder. Skips .git, node_modules and build output. Up to 100 hits.",
      inputSchema: jsonSchema<{ query: string; regex?: boolean; caseSensitive?: boolean; include?: string; path?: string }>(object({
        query: { type: "string", minLength: 1 },
        regex: { type: "boolean", description: "Treat query as a regular expression." },
        caseSensitive: { type: "boolean" },
        include: { type: "string", description: "Only files matching this glob, e.g. \"*.ts\" or \"src/**/*.{ts,tsx}\"." },
        path: { type: "string", description: "Only files under this folder." },
      }, ["query"])),
      execute: async ({ query, regex, caseSensitive, include, path }) =>
        host.search(root, { text: query, regex: regex === true, caseSensitive: caseSensitive === true, pathPattern: searchPathSource(include, path) }, 100),
    }),
    write_file: tool({
      description: "Create a file or replace its whole contents. Prefer edit_file for changes to an existing file.",
      inputSchema: jsonSchema<{ path: string; content: string }>(object({ path: { type: "string" }, content: { type: "string" } }, ["path", "content"])),
      execute: async ({ path, content }): Promise<FileChange> => host.write(root, path, content),
      toModelOutput: ({ output }) => ({ type: "text", value: changeSummary(output as FileChange) }),
    }),
    edit_file: tool({
      description: "Change an existing file by exact replacements, applied in order and written once (one undo). Each oldText must occur exactly once unless replaceAll is set; include enough surrounding text to make it unique. Read the file first. Several edits to one file belong in one call; if any edit does not apply, nothing is written.",
      inputSchema: jsonSchema<{ path: string; edits: Replacement[] }>(object({
        path: { type: "string" },
        edits: { type: "array", minItems: 1, maxItems: 50, items: object({
          oldText: { type: "string", minLength: 1 },
          newText: { type: "string" },
          replaceAll: { type: "boolean", description: "Replace every occurrence instead of exactly one." },
        }, ["oldText", "newText"]) },
      }, ["path", "edits"])),
      execute: async (input): Promise<FileChange> => host.edit(root, input.path, readEdits(input)),
      toModelOutput: ({ output }) => ({ type: "text", value: changeSummary(output as FileChange) }),
    }),
    run_command: tool({
      description: "Run a shell command in the project folder (no input; output is captured). Use for tests, builds, git and other CLI tools.",
      inputSchema: jsonSchema<{ command: string; timeoutSeconds?: number }>(object({
        command: { type: "string", minLength: 1 },
        timeoutSeconds: { type: "integer", minimum: 1, maximum: 600, description: "Defaults to 120." },
      }, ["command"])),
      execute: async ({ command, timeoutSeconds }, { abortSignal, toolCallId }): Promise<CommandResult> => {
        try {
          return await host.run(root, command, timeoutSeconds ?? 120, abortSignal, (text) => appendCommandOutput(toolCallId, text));
        } finally { endCommandOutput(toolCallId); }
      },
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

const MAX_FOUND = 200;

/** find_files: matching paths in index order, at most MAX_FOUND. */
export function findFiles(index: { paths: string[]; truncated: boolean }, pattern: string) {
  const matches = globMatcher(pattern);
  const found = index.paths.filter(matches);
  return {
    paths: found.slice(0, MAX_FOUND), total: found.length, truncated: found.length > MAX_FOUND || index.truncated,
    ...(index.truncated ? { note: "项目文件超过 20000 个，只查找了前 20000 个。" } : {}),
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

/**
 * Which calls wait for the user, which go ahead: by permission mode, then by
 * what the user allowed for this chat from an approval card (an exact
 * command, or all file changes). 仅计划 refuses changes whatever was allowed.
 */
export function agentToolApproval(mode: PermissionMode, allow: AgentAllowances = { commands: [], edits: false }): ToolApprovalConfiguration<ToolSet, never> {
  const edits = mode === "acceptEdits" || mode === "full" || (allow.edits && mode !== "plan") ? "approved" : mode === "plan" ? "denied" : "user-approval";
  const commands = mode === "full" ? "approved" : mode === "plan" ? "denied" : "user-approval";
  const allowed = new Set(allow.commands);
  return {
    ...Object.fromEntries(READ_TOOLS.map((name) => [name, "not-applicable"])),
    ...Object.fromEntries(EDIT_TOOLS.map((name) => [name, edits])),
    run_command: commands === "user-approval" && allowed.size > 0
      ? (input: unknown) => allowed.has(String((input as { command?: unknown } | null)?.command ?? "")) ? "approved" : "user-approval"
      : commands,
  };
}
