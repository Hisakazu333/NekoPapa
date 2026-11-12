import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 轨迹: the timing a reply records while it streams, and the rows, timeline
// and totals the view builds from a chat's saved messages.
const output = mkdtempSync(join(tmpdir(), "nekopapa-trajectory-"));
let recorder, trajectory;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./agent-trajectory-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (!file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [recorder, trajectory] = await Promise.all([load("app/agent/trace-recorder.js"), load("app/agent/trajectory.js")]);
} finally { rmSync(output, { recursive: true, force: true }); }

// The client merges each metadata patch into the reply: objects merge, everything else is replaced.
const merge = (target, patch) => {
  const result = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" ? merge(result[key], value) : value;
  }
  return result;
};
const record = (parts, times, metadata = {}) => {
  let index = 0;
  const trace = recorder.createTraceRecorder(() => times[index++]);
  for (const part of parts) { const patch = trace(part); if (patch) metadata = merge(metadata, patch); }
  return metadata;
};

const T = 1_700_000_000_000;
const streamed = [
  { type: "start" },
  { type: "start-step" },
  { type: "tool-call", toolCallId: "call-1" },
  { type: "tool-result", toolCallId: "call-1" },
  { type: "finish-step", usage: { inputTokens: 1200, outputTokens: 40 }, finishReason: "tool-calls" },
  { type: "start-step" },
  { type: "finish-step", usage: { inputTokens: 1300, outputTokens: 90 }, finishReason: "stop" },
];
// One `now()` for the request id, then one per part.
const times = [T, T, T + 100, T + 900, T + 1500, T + 1510, T + 1600, T + 3600];

test("the recorder keeps each step's start, finish and tokens, and each tool call's time and outcome", () => {
  const { trace } = record(streamed, times);
  const steps = Object.values(trace.steps);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0], { startedAt: T + 100, finishedAt: T + 1510, inputTokens: 1200, outputTokens: 40, finishReason: "tool-calls" });
  assert.deepEqual(steps[1], { startedAt: T + 1600, finishedAt: T + 3600, inputTokens: 1300, outputTokens: 90, finishReason: "stop" });
  assert.deepEqual(trace.tools["call-1"], { step: Object.keys(trace.steps)[0], calledAt: T + 900, finishedAt: T + 1500, outcome: "done" });
  assert.deepEqual(recorder.readReplyTrace({ trace }), trace);
});

test("a reply continued after an approval adds its steps without overwriting the first request's", () => {
  const first = record(streamed.slice(0, 3), [T, T, T + 100, T + 900]);
  const second = record([{ type: "tool-output-denied", toolCallId: "call-1" }, { type: "start-step" }, { type: "finish-step", usage: {} }],
    [T + 60_000, T + 60_010, T + 60_020, T + 61_000], first);
  assert.equal(Object.keys(second.trace.steps).length, 2);
  assert.equal(second.trace.tools["call-1"].outcome, "denied");
  assert.equal(second.trace.tools["call-1"].calledAt, T + 900);
});

test("a saved trace drops malformed entries and replies saved before tracing have none", () => {
  assert.equal(recorder.readReplyTrace(undefined), undefined);
  assert.equal(recorder.readReplyTrace({ usage: {} }), undefined);
  const read = recorder.readReplyTrace({ trace: {
    steps: { ok: { startedAt: T, finishedAt: T - 5, inputTokens: -1 }, bad: { startedAt: "soon" } },
    tools: { a: { step: "ok", calledAt: T, outcome: "maybe" }, b: { calledAt: T } },
  } });
  assert.deepEqual(read, { steps: { ok: { startedAt: T } }, tools: { a: { step: "ok", calledAt: T } } });
});

const user = (id, text) => ({ id, role: "user", parts: [{ type: "text", text }] });
const reply = (metadata) => ({
  id: "a1", role: "assistant", metadata, parts: [
    { type: "step-start" },
    { type: "reasoning", text: "先看看文件" },
    { type: "tool-search_files", toolCallId: "call-1", state: "output-available", input: { query: "TODO" }, output: { hits: [{}, {}, {}], truncated: false } },
    { type: "step-start" },
    { type: "text", text: "找到了 3 处 TODO。" },
  ],
});

test("a chat becomes rows in order with turns, tool summaries and timing from the trace", () => {
  const messages = [user("u1", "找一下  TODO\n在哪"), reply(record(streamed, times))];
  const { rows, segments, stats } = trajectory.buildTrajectory(messages, { u1: T });
  assert.deepEqual(rows.map((row) => [row.kind, row.turn]), [["user", 1], ["reasoning", 1], ["tool", 1], ["assistant", 1]]);
  assert.equal(rows[0].summary, "找一下 TODO 在哪");
  assert.equal(rows[2].name, "search_files");
  assert.equal(rows[2].summary, '{ "query": "TODO" } → 3 处结果');
  assert.equal(rows[2].durationMs, 600);
  // Model time in the first step ends where it called the tool.
  assert.equal(rows[1].durationMs, 800);
  assert.equal(rows[3].durationMs, 2000);
  assert.deepEqual(stats, { turns: 1, steps: 2, toolCalls: 1, inputTokens: 2500, outputTokens: 130, modelMs: 2800, toolMs: 600, timedReplies: 1, replies: 1 });
  assert.deepEqual(segments.map((segment) => segment.lane), ["input", "model", "tool", "model"]);
});

test("a reply saved before tracing keeps its rows without times or timeline", () => {
  const { rows, segments, stats } = trajectory.buildTrajectory([user("u1", "hi"), reply(undefined)]);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((row) => row.durationMs === undefined && row.at === undefined));
  assert.deepEqual(segments, []);
  assert.equal(stats.timedReplies, 0);
  assert.equal(stats.replies, 1);
});

test("search matches text, tool names and details, within the chosen kinds", () => {
  const { rows } = trajectory.buildTrajectory([user("u1", "hi"), reply(undefined)]);
  assert.deepEqual(trajectory.filterRows(rows, "SEARCH_files").map((row) => row.kind), ["tool"]);
  assert.deepEqual(trajectory.filterRows(rows, "todo").map((row) => row.kind), ["tool", "assistant"]);
  assert.deepEqual(trajectory.filterRows(rows, "todo", new Set(["assistant"])).map((row) => row.kind), ["assistant"]);
  assert.equal(trajectory.filterRows(rows, "  ").length, 4);
});

test("the timeline shortens long waits between turns and durations read in Chinese units", () => {
  const placed = trajectory.placeSegments([
    { lane: "model", start: 0, end: 1000, rowId: "a" },
    { lane: "model", start: 3_600_000, end: 3_601_000, rowId: "b" },
  ], 5000);
  // 1 s of work, a 1-hour wait counted as 5 s, then 1 s of work.
  assert.deepEqual(placed.map(({ left, width }) => [left, width].map((n) => Math.round(n * 7000))), [[0, 1000], [6000, 1000]]);
  assert.equal(trajectory.formatDuration(850), "850 毫秒");
  assert.equal(trajectory.formatDuration(1250), "1.3 秒");
  assert.equal(trajectory.formatDuration(125_000), "2 分 05 秒");
});
