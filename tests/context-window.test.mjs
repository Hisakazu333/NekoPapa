import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { standInModel } from "./helpers/stand-in-model.mjs";

// How full the context window is and keeping it from overflowing: the
// meter reads the last model call (not the run's sum), the compressor and
// the meter share one window, a reported reading raises the estimate, and a
// long tool run is summarized between steps. The handler runs against a
// stand-in model that reports usage.
const output = mkdtempSync(join(tmpdir(), "nekopapa-context-window-"));
let handler, usage, thread, run;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./context-window-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (file.includes("node_modules") || !file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [handler, usage, thread, run] = await Promise.all([
    load("app/api/chat/chat-handler.js"), load("app/usage/context-usage.js"), load("app/usage/thread-usage.js"), load("app/chat/run-compaction.js"),
  ]);
} finally { rmSync(output, { recursive: true, force: true }); }

const post = (body) => new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const user = (id, text) => ({ id, role: "user", parts: [{ type: "text", text }] });
const reply = (id, metadata) => ({ id, role: "assistant", parts: [{ type: "text", text: `回复 ${id}` }], ...(metadata ? { metadata } : {}) });
const runtime = (agent) => ({ env: () => undefined, credential: () => undefined, desktop: true, agent });
const agentHost = {
  list: async () => ({ entries: [{ name: "a.ts", kind: "file" }], truncated: false }),
  files: async () => ({ paths: [], truncated: false }),
  read: async () => { throw new Error("unused"); },
  search: async () => { throw new Error("unused"); },
  write: async () => { throw new Error("unused"); },
  edit: async () => { throw new Error("unused"); },
  run: async () => { throw new Error("unused"); },
};
/** The metadata patches a streamed reply carried, in order. */
const metadataOf = (text) => text.split("\n").filter((line) => line.startsWith("data: {")).map((line) => JSON.parse(line.slice(6)))
  .filter((chunk) => chunk.messageMetadata).map((chunk) => chunk.messageMetadata);

test("占用读最后一次模型调用：新记录优先，旧回复退回轨迹的最后一步，普通回复用自身用量", () => {
  assert.equal(usage.stepContext({}), undefined);
  assert.deepEqual(usage.stepContext({ inputTokens: 900, outputTokens: 100, outputTokenDetails: { reasoningTokens: 40 } }), { tokens: 1000, input: 900, output: 100, reasoning: 40 });
  assert.deepEqual(usage.contextPatch({ inputTokens: 10, outputTokens: 2 }, 64000, true), { context: { tokens: 12, input: 10, output: 2, window: 64000, estimated: true } });
  assert.equal(usage.contextPatch(undefined, 64000, false), undefined);
  assert.deepEqual(usage.readReplyContext({ context: { tokens: 12, window: "x", estimated: true } }), { tokens: 12 }, "没有窗口就不算估算");

  // A run of three calls: its usage is their sum; the window holds the last one.
  const trace = { steps: { "a-1": { startedAt: 1, inputTokens: 1000, outputTokens: 50 }, "a-3": { startedAt: 3, inputTokens: 3000, outputTokens: 80 }, "a-2": { startedAt: 2, inputTokens: 2000, outputTokens: 60 } } };
  const old = reply("a1", { usage: { inputTokens: 6000, outputTokens: 190, totalTokens: 6190 }, contextWindow: 8000, trace });
  assert.deepEqual(usage.latestReplyContext([old]), { tokens: 3080, input: 3000, output: 80, window: 8000 });
  const plain = reply("a2", { usage: { inputTokens: 300, outputTokens: 20, totalTokens: 320 } });
  assert.deepEqual(usage.latestReplyContext([old, user("u", "x"), plain]), { tokens: 320, input: 300, output: 20 });
  const fresh = reply("a3", { ...old.metadata, context: { tokens: 3080, input: 3000, output: 80, window: 64000, estimated: true } });
  assert.deepEqual(thread.threadUsage([fresh]).context, { tokens: 3080, input: 3000, output: 80, window: 64000, estimated: true });
  assert.equal(thread.threadUsage([fresh]).totalTokens, 6190, "累计仍按回复用量相加");
});

test("每步之后写入占用；没填窗口时按默认窗口并标为估算", async (t) => {
  const { profile } = await standInModel(t, () => ({ text: "好", usage: { prompt: 500, completion: 7 } }));
  const handlers = handler.createChatHandlers(runtime());
  const text = await (await handlers.POST(post({ messages: [user("u1", "你好")], profile }))).text();
  const patch = metadataOf(text).find((each) => each.context);
  assert.deepEqual(patch.context, { tokens: 507, input: 500, output: 7, window: 64000, estimated: true });

  const filled = await (await handlers.POST(post({ messages: [user("u1", "你好")], profile: { ...profile, contextWindow: 128000 } }))).text();
  assert.deepEqual(metadataOf(filled).find((each) => each.context).context, { tokens: 507, input: 500, output: 7, window: 128000 });
});

test("估算不到但上次报告已接近上限时，请求前就压缩", async (t) => {
  const { profile, seen } = await standInModel(t, (body) => body.stream ? { text: "继续" } : { text: "摘要：前两轮在讨论 A。" });
  const handlers = handler.createChatHandlers(runtime());
  const messages = [user("u1", "一"), reply("a1"), user("u2", "二"), reply("a2"), user("u3", "三"),
    reply("a3", { context: { tokens: 15500, window: 20000 } }), user("u4", "四")];
  const withReading = await (await handlers.POST(post({ messages, profile: { ...profile, contextWindow: 20000 } }))).text();
  assert.equal(seen.filter((body) => !body.stream).length, 1, "报告的 15500 超过 75%，先做总结");
  assert.ok(metadataOf(withReading).some((each) => each.compaction?.through === "a2"), "保留最近两轮，摘要覆盖到 a2");

  seen.length = 0;
  const unreported = messages.map((message) => message.id === "a3" ? reply("a3") : message);
  await (await handlers.POST(post({ messages: unreported, profile: { ...profile, contextWindow: 20000 } }))).text();
  assert.equal(seen.filter((body) => !body.stream).length, 0, "只有估算时这段对话很短，不压缩");
});

test("一次长运行在步骤之间总结较早的步骤，保留用户原话与最近三步", async (t) => {
  let calls = 0;
  const { profile, seen } = await standInModel(t, (body) => {
    if (!body.stream) return { text: "摘要：已列出目录五次。" };
    calls += 1;
    if (calls <= 5) return { tool: { name: "list_files", input: { path: "." } }, usage: { prompt: calls === 5 ? 19000 : 1000, completion: 10 } };
    return { text: "完成", usage: { prompt: 3000, completion: 5 } };
  });
  const handlers = handler.createChatHandlers(runtime(agentHost));
  const text = await (await handlers.POST(post({ messages: [user("u1", "请把目录看清楚")], profile: { ...profile, contextWindow: 20000 },
    workspace: { root: "/projects/demo", name: "demo", permission: "full" } }))).text();

  const summaries = seen.filter((body) => !body.stream);
  assert.equal(summaries.length, 1, "第 5 步报告 19000 后总结一次");
  const after = seen.filter((body) => body.stream).at(-1).messages;
  const first = after.find((message) => message.role !== "system");
  assert.match(first.content, /^The earlier part of this task was summarized/);
  assert.match(first.content, /摘要：已列出目录五次。/);
  assert.match(first.content, /The user's latest message, verbatim:\n请把目录看清楚/);
  assert.equal(after.filter((message) => message.role === "assistant").length, 3, "保留最近三步");
  const patches = metadataOf(text);
  const made = patches.map((each) => each.runCompactions).find(Boolean);
  assert.deepEqual(Object.values(made).map(({ step, messages }) => [step, messages]), [[6, 5]]);
  assert.deepEqual(patches.filter((each) => each.context).at(-1).context, { tokens: 3005, input: 3000, output: 5, window: 20000 }, "总结后占用随之下降");
  assert.deepEqual(run.readRunCompactions({ runCompactions: { ...made, bad: { step: 0 } } }).map((each) => each.step), [6]);
});
