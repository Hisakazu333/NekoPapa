import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// How a running Agent reply reads in the transcript: live command output,
// the status line, grouped looks with reasoning in place, the change summary
// and the step cap. The handler runs against a stand-in model server.
const output = mkdtempSync(join(tmpdir(), "nekopapa-agent-run-view-"));
let handler, segments, labels, activity, changes, limit, live;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./agent-run-view-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (file.includes("node_modules") || !file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [handler, segments, labels, activity, changes, limit, live] = await Promise.all([
    load("app/api/chat/chat-handler.js"), load("app/agent/message-segments.js"), load("app/agent/tool-labels.js"), load("app/agent/run-activity.js"),
    load("app/agent/run-changes.js"), load("app/agent/step-limit.js"), load("app/agent/command-output.js"),
  ]);
} finally { rmSync(output, { recursive: true, force: true }); }

const ROOT = "/projects/demo";
const post = (body) => new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const userMessages = [{ id: "u1", role: "user", parts: [{ type: "text", text: "跑一下测试" }] }];
const done = (name, input, output, id = `${name}-${JSON.stringify(input)}`) => ({ type: `tool-${name}`, toolCallId: id, state: "output-available", input, output });

/** A model that asks for `call` on every request until `stopAfter` tool answers, then replies in text. */
async function toolModel(t, call, stopAfter = Infinity) {
  const seen = [];
  const server = createServer(async (incoming, response) => {
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    const body = JSON.parse(raw);
    seen.push(body);
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: `c${seen.length}`, object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    const answers = body.messages.filter((message) => message.role === "tool").length;
    if (answers < stopAfter) {
      response.write(chunk({ role: "assistant", tool_calls: [{ index: 0, id: `call_${seen.length}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.input) } }] }));
      response.write(chunk({}, "tool_calls"));
    } else {
      response.write(chunk({ role: "assistant", content: "完成" }));
      response.write(chunk({}, "stop"));
    }
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { profile: { provider: "compatible", endpoint: `http://127.0.0.1:${server.address().port}/v1`, model: "m", credential: "" }, seen };
}

function host(run) {
  return {
    list: async () => ({ entries: [], truncated: false }),
    read: async (root, path) => ({ path, size: 4, text: "one\n", binary: false, tooLarge: false }),
    search: async () => ({ hits: [], truncated: false }),
    write: async () => { throw new Error("unused"); },
    edit: async () => { throw new Error("unused"); },
    run: run ?? (async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false, cancelled: false, truncated: false, durationMs: 1 })),
  };
}
const runtime = (agent) => ({ env: () => undefined, credential: () => undefined, desktop: true, agent });
const finishMetadata = (stream) => [...stream.matchAll(/"type":"finish"[^\n]*?"messageMetadata":(\{[^\n]*\})\}/g)].map((match) => JSON.parse(match[1]));

test("命令运行中逐段收到输出；调用结束后实时输出清空，由保存的结果接管", async (t) => {
  const { profile } = await toolModel(t, { name: "run_command", input: { command: "npm test" } }, 1);
  let during;
  const agent = host(async (root, command, timeout, signal, onOutput) => {
    onOutput("第一行\n");
    onOutput("第二行\n");
    during = live.readCommandOutput("call_1");
    return { exitCode: 0, stdout: "第一行\n第二行\n", stderr: "", timedOut: false, cancelled: false, truncated: false, durationMs: 3 };
  });
  const { POST } = handler.createChatHandlers(runtime(agent));
  const text = await (await POST(post({ messages: userMessages, profile, workspace: { root: ROOT, name: "demo", permission: "full" } }))).text();
  assert.match(text, /"type":"tool-output-available"/);
  assert.equal(during, "第一行\n第二行\n");
  assert.equal(live.readCommandOutput("call_1"), "");
});

test("实时输出只保留末尾 64 KB，并按帧通知订阅者", async () => {
  let told = 0;
  const stop = live.subscribeCommandOutput("big", () => { told += 1; });
  live.appendCommandOutput("big", "a".repeat(70 * 1024));
  live.appendCommandOutput("big", "尾");
  assert.equal(live.readCommandOutput("big").length, 64 * 1024);
  assert.ok(live.readCommandOutput("big").endsWith("a尾"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(told, 1);
  live.endCommandOutput("big");
  stop();
  assert.equal(live.readCommandOutput("big"), "");
});

test("达到 30 步上限仍在调用工具时，回复标记 stepLimit；正常结束为 false", async (t) => {
  const looping = await toolModel(t, { name: "read_file", input: { path: "a.txt" } });
  const { POST } = handler.createChatHandlers(runtime(host()));
  const body = (profile) => post({ messages: userMessages, profile, workspace: { root: ROOT, name: "demo", permission: "ask" } });
  const cut = await (await POST(body(looping.profile))).text();
  assert.equal(looping.seen.length, limit.MAX_AGENT_STEPS);
  assert.equal(finishMetadata(cut).at(-1)?.stepLimit, true);
  const finishing = await toolModel(t, { name: "read_file", input: { path: "a.txt" } }, 2);
  const whole = await (await POST(body(finishing.profile))).text();
  assert.equal(finishMetadata(whole).at(-1)?.stepLimit, false);
  assert.equal(limit.readStepLimit({ stepLimit: true }), true);
  assert.equal(limit.readStepLimit({ stepLimit: "yes" }), false);
  assert.equal(limit.readStepLimit(undefined), false);
});

test("连续的读取、查看与搜索合为一组，组内保留之间的思考；单次读取不成组", () => {
  const parts = [
    { type: "step-start" }, { type: "reasoning", text: "先找入口。", state: "done" },
    done("search_files", { query: "main" }, { hits: [], truncated: false }),
    { type: "step-start" }, { type: "reasoning", text: "看看 main.ts。", state: "done" }, { type: "text", text: "\n" },
    done("read_file", { path: "src/main.ts" }, {}), done("read_file", { path: "src/main.ts" }, {}, "r2"),
    { type: "step-start" }, { type: "text", text: "改一下。" },
    done("run_command", { command: "npm test" }, {}),
    done("read_file", { path: "b.ts" }, {}),
  ];
  const result = segments.messageSegments(parts);
  assert.deepEqual(result.map((segment) => segment.kind), ["reasoning", "group", "text", "tool", "tool"]);
  assert.deepEqual(result[1].items.map((item) => item.kind), ["tool", "reasoning", "tool", "tool"]);
  assert.equal(result[1].items[1].text, "看看 main.ts。");
  const calls = result[1].items.filter((item) => item.kind === "tool").map((item) => ({ name: item.name, input: item.part.input }));
  assert.equal(labels.lookSummary(calls), "读取了 1 个文件，搜索了 1 次");
  assert.equal(labels.lookSummary([{ name: "list_files", input: {} }, { name: "list_files", input: { path: "src" } }]), "查看了 2 个文件夹");
});

test("运行状态行：等待、思考、当前工具与步数，回复中为“正在回复”", () => {
  const user = { id: "u", role: "user", parts: [] };
  const reply = (parts) => [user, { id: "a", role: "assistant", parts }];
  assert.equal(activity.runActivity([user], false), undefined);
  assert.equal(activity.runActivity([user], true), "正在等待回复");
  assert.equal(activity.runActivity(reply([{ type: "step-start" }]), true), "正在思考");
  const running = { type: "tool-run_command", toolCallId: "c", state: "input-available", input: { command: "npm test" } };
  const steps = [{ type: "step-start" }, done("read_file", { path: "a" }, {}), { type: "step-start" }, done("read_file", { path: "b" }, {}), { type: "step-start" }];
  assert.equal(activity.runActivity(reply([...steps, running]), true), "正在运行 npm test · 第 3 步");
  assert.equal(activity.runActivity(reply([...steps, { ...running, state: "input-streaming", input: undefined }]), true), "正在准备工具调用 · 第 3 步");
  assert.equal(activity.runActivity(reply([{ type: "step-start" }, { type: "text", text: "好", state: "streaming" }]), true), "正在回复");
  assert.equal(activity.runActivity(reply([{ type: "step-start" }, { type: "reasoning", text: "嗯", state: "streaming" }]), true), "正在思考");
});

test("更改汇总按文件合并行数，快照按从新到旧排列以便全部撤销", () => {
  const change = (path, added, removed, snapshot, created = false) => ({ path, created, added, removed, diff: "", snapshot });
  const parts = [
    done("write_file", { path: "a.ts" }, change("a.ts", 10, 0, "s1", true), "w1"),
    done("read_file", { path: "a.ts" }, {}),
    done("edit_file", { path: "a.ts" }, change("a.ts", 2, 1, "s2"), "e1"),
    done("edit_file", { path: "b.ts" }, change("b.ts", 1, 3, "s3"), "e2"),
    { type: "tool-edit_file", toolCallId: "e3", state: "output-error", input: { path: "c.ts" }, errorText: "x" },
  ];
  const result = changes.runChanges(parts);
  assert.equal(result.count, 3);
  assert.deepEqual(result.snapshots, ["s3", "s2", "s1"]);
  assert.deepEqual(result.files, [{ path: "a.ts", created: true, added: 12, removed: 1 }, { path: "b.ts", created: false, added: 1, removed: 3 }]);
});
