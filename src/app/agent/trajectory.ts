import type { ToolUIPart, UIMessage } from "ai";
import { isToolUIPart, toolName } from "./message-segments";
import { readReplyTrace, type ReplyTrace } from "./trace-recorder";

/**
 * 轨迹: one open chat read as the sequence of things that happened, built
 * only from what the chat saved: each user message, each model step's text
 * and reasoning, and each tool call with its input and result. Timing comes
 * from the reply's recorded trace (trace-recorder.ts); replies saved before
 * timing was recorded keep their rows without times.
 */

export type TrajectoryKind = "user" | "assistant" | "reasoning" | "tool";
export type ToolStatus = "running" | "awaiting" | "done" | "error" | "denied";

export interface TrajectoryRow {
  id: string;
  messageId: string;
  /** 1-based user turn the row belongs to (0 before the first user message). */
  turn: number;
  kind: TrajectoryKind;
  /** Tool name for tool rows. */
  name?: string;
  /** One line: the text, or a tool's input then `→` its result. */
  summary: string;
  /** Full text for the expanded row. */
  input?: string;
  output?: string;
  status?: ToolStatus;
  at?: number;
  durationMs?: number;
}

export type Lane = "input" | "model" | "tool";
export interface TimelineSegment { lane: Lane; start: number; end: number; rowId: string }

export interface Trajectory {
  rows: TrajectoryRow[];
  segments: TimelineSegment[];
  stats: { turns: number; steps: number; toolCalls: number; inputTokens: number; outputTokens: number; modelMs: number; toolMs: number; timedReplies: number; replies: number };
}

const DETAIL_LIMIT = 20_000;
const oneLine = (text: string, limit = 240) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
};
const clip = (text: string) => text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT)}\n…（已截断，共 ${text.length} 个字符）` : text;
const show = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2) ?? ""; } catch { return String(value); }
};

const STATUS: Record<ToolUIPart["state"], ToolStatus> = {
  "input-streaming": "running", "input-available": "running", "approval-requested": "awaiting", "approval-responded": "running",
  "output-available": "done", "output-error": "error", "output-denied": "denied",
};

/** A tool result as one short line: what a reader looks for first. */
function resultLine(name: string, part: ToolUIPart): string {
  if (part.state === "output-error") return `出错：${part.errorText ?? ""}`;
  if (part.state === "output-denied") return "已拒绝";
  if (part.state === "approval-requested") return "等待确认";
  if (part.state !== "output-available") return "进行中";
  const output = part.output as Record<string, unknown> | undefined;
  if (name === "run_command" && output) {
    const status = output.cancelled ? "已停止" : output.timedOut ? "超时" : `退出码 ${String(output.exitCode)}`;
    return `${status} ${oneLine(String(output.stdout || output.stderr || ""), 160)}`.trim();
  }
  if ((name === "write_file" || name === "edit_file") && output) return `+${String(output.added)} −${String(output.removed)}`;
  if (name === "read_file" && output) return `第 ${String(output.startLine)}–${String(output.endLine)} 行，共 ${String(output.totalLines)} 行`;
  if (name === "list_files" && output && Array.isArray(output.entries)) return `${output.entries.length} 项`;
  if (name === "search_files" && output && Array.isArray(output.hits)) return `${output.hits.length} 处结果${output.truncated ? "（已截断）" : ""}`;
  return oneLine(show(part.output), 160);
}

/** Steps of a reply in order: the parts after each `step-start`. */
function replySteps(parts: UIMessage["parts"]): UIMessage["parts"][] {
  const steps: UIMessage["parts"][] = [];
  for (const part of parts) {
    if (part.type === "step-start" || steps.length === 0) steps.push([]);
    if (part.type !== "step-start") steps[steps.length - 1].push(part);
  }
  return steps.filter((step) => step.length > 0 || steps.length === 1);
}

export function buildTrajectory(messages: readonly UIMessage[], messageAt: Readonly<Record<string, number | undefined>> = {}): Trajectory {
  const rows: TrajectoryRow[] = [];
  const segments: TimelineSegment[] = [];
  const stats: Trajectory["stats"] = { turns: 0, steps: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, modelMs: 0, toolMs: 0, timedReplies: 0, replies: 0 };
  let turn = 0;

  for (const message of messages) {
    if (message.role === "user") {
      turn += 1;
      stats.turns = turn;
      const text = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
      const at = messageAt[message.id];
      const id = `${message.id}:user`;
      rows.push({ id, messageId: message.id, turn, kind: "user", summary: oneLine(text), input: clip(text), ...(at ? { at } : {}) });
      if (at) segments.push({ lane: "input", start: at, end: at, rowId: id });
      continue;
    }
    if (message.role !== "assistant") continue;
    stats.replies += 1;
    const trace: ReplyTrace | undefined = readReplyTrace(message.metadata);
    if (trace && Object.keys(trace.steps).length > 0) stats.timedReplies += 1;
    const traced = trace ? Object.values(trace.steps).sort((a, b) => a.startedAt - b.startedAt) : [];
    const steps = replySteps(message.parts);
    stats.steps += steps.length;

    steps.forEach((parts, stepIndex) => {
      const step = traced[stepIndex];
      if (step) {
        stats.inputTokens += step.inputTokens ?? 0;
        stats.outputTokens += step.outputTokens ?? 0;
      }
      // The model's own time in a step ends where it handed off to a tool.
      const calls = parts.filter(isToolUIPart).map((part) => trace?.tools[part.toolCallId]?.calledAt).filter((time): time is number => time !== undefined);
      const modelEnd = step ? Math.min(step.finishedAt ?? Infinity, ...calls) : undefined;
      const modelMs = step && modelEnd !== undefined && Number.isFinite(modelEnd) ? modelEnd - step.startedAt : undefined;
      if (step && modelMs !== undefined) stats.modelMs += modelMs;
      let modelRowPlaced = false;
      let firstRow: string | undefined;

      parts.forEach((part, partIndex) => {
        const id = `${message.id}:${stepIndex}:${partIndex}`;
        const before = rows.length;
        const timing = !modelRowPlaced && step ? { at: step.startedAt, ...(modelMs !== undefined ? { durationMs: modelMs } : {}) } : {};
        if ((part.type === "text" || part.type === "reasoning") && part.text.trim()) {
          rows.push({ id, messageId: message.id, turn, kind: part.type === "text" ? "assistant" : "reasoning", summary: oneLine(part.text), output: clip(part.text), ...timing });
          if (!modelRowPlaced && step && modelMs !== undefined) segments.push({ lane: "model", start: step.startedAt, end: step.startedAt + modelMs, rowId: id });
          modelRowPlaced = true;
        } else if (isToolUIPart(part)) {
          const name = toolName(part);
          const timed = trace?.tools[part.toolCallId];
          const durationMs = timed?.finishedAt !== undefined ? timed.finishedAt - timed.calledAt : undefined;
          stats.toolCalls += 1;
          if (durationMs !== undefined) stats.toolMs += durationMs;
          const input = show(part.input);
          rows.push({
            id, messageId: message.id, turn, kind: "tool", name, status: STATUS[part.state],
            summary: `${oneLine(input, 120)} → ${resultLine(name, part)}`,
            input: clip(input), output: clip(part.state === "output-error" ? part.errorText ?? "" : show(part.output)),
            ...(timed ? { at: timed.calledAt } : {}), ...(durationMs !== undefined ? { durationMs } : {}),
          });
          if (timed) segments.push({ lane: "tool", start: timed.calledAt, end: timed.finishedAt ?? timed.calledAt, rowId: id });
        }
        if (rows.length > before) firstRow ??= id;
      });
      // A step that only called tools still spent model time deciding to.
      if (!modelRowPlaced && firstRow && step && modelMs !== undefined && modelMs > 0) {
        segments.push({ lane: "model", start: step.startedAt, end: step.startedAt + modelMs, rowId: firstRow });
      }
    });
  }
  return { rows, segments, stats };
}

/** Rows whose text, tool name or details contain `query` (case-insensitive). */
export function filterRows(rows: readonly TrajectoryRow[], query: string, kinds?: ReadonlySet<TrajectoryKind>): TrajectoryRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => (!kinds || kinds.has(row.kind))
    && (!needle || [row.summary, row.name, row.input, row.output].some((text) => text?.toLowerCase().includes(needle))));
}

/** "1.2 秒", "3 分 05 秒", "850 毫秒". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} 毫秒`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} 秒`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes} 分 ${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")} 秒`;
}

/**
 * Where each segment sits on the timeline, from 0 to 1. Waiting between
 * turns (the user reading, typing or away) is not work, so any gap longer
 * than `maxGapMs` counts as `maxGapMs`; the bar then shows the work itself.
 */
export function placeSegments(segments: readonly TimelineSegment[], maxGapMs = 5000): { segment: TimelineSegment; left: number; width: number }[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  // Busy intervals merged, then each real time maps onto the compressed axis.
  const spans: { start: number; end: number; offset: number }[] = [];
  let offset = 0;
  for (const { start, end } of sorted) {
    const last = spans[spans.length - 1];
    if (last && start <= last.end) { last.end = Math.max(last.end, end); continue; }
    if (last) offset += Math.min(start - last.end, maxGapMs) + (last.end - last.start);
    spans.push({ start, end, offset });
  }
  const lastSpan = spans[spans.length - 1];
  const total = Math.max(1, lastSpan.offset + (lastSpan.end - lastSpan.start));
  const at = (time: number) => {
    let span = spans[0];
    for (const candidate of spans) { if (candidate.start <= time) span = candidate; else break; }
    return (span.offset + Math.min(time, span.end) - span.start) / total;
  };
  return sorted.map((segment) => {
    const left = at(segment.start);
    return { segment, left, width: Math.max(0, at(segment.end) - left) };
  });
}
