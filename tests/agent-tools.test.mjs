import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The chat Agent's tool loop through the real chat handler, against a stand-in
// OpenAI-compatible server and an in-memory host; plus the transcript helpers.
const output = mkdtempSync(join(tmpdir(), "nekopapa-agent-tools-"));
let handler, tools, plan, request, segments, labels, preview;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./agent-tools-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (file.includes("node_modules") || !file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [handler, tools, plan, request, segments, labels, preview] = await Promise.all([
    load("app/api/chat/chat-handler.js"), load("app/agent/agent-tools.js"), load("app/agent/agent-plan.js"),
    load("app/agent/agent-request.js"), load("app/agent/message-segments.js"), load("app/agent/tool-labels.js"), load("app/agent/change-preview.js"),
  ]);
} finally { rmSync(output, { recursive: true, force: true }); }

const ROOT = "/projects/demo";
const workspace = (permission) => ({ root: ROOT, name: "demo", permission });
const userMessages = [{ id: "u1", role: "user", parts: [{ type: "text", text: "看看 a.txt" }] }];
const post = (body) => new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** A host that records calls instead of touching a disk. */
function memoryHost() {
  const calls = [];
  const change = (path) => ({ path, created: false, added: 1, removed: 1, diff: "@@ -1,1 +1,1 @@\n-old\n+new\n", snapshot: "1-0" });
  return {
    calls,
    host: {
      list: async (root, dir) => { calls.push(["list", root, dir]); return { entries: [{ name: "a.txt", path: "a.txt", kind: "file", size: 4 }], truncated: false }; },
      read: async (root, path) => { calls.push(["read", root, path]); return { path, size: 8, text: "one\ntwo\n", binary: false, tooLarge: false }; },
      search: async (root, query) => { calls.push(["search", root, query]); return { hits: [], truncated: false }; },
      write: async (root, path, text) => { calls.push(["write", root, path, text]); return change(path); },
      edit: async (root, path) => { calls.push(["edit", root, path]); return change(path); },
      run: async (root, command) => { calls.push(["run", root, command]); return { exitCode: 0, stdout: "ok", stderr: "", timedOut: false, cancelled: false, truncated: false, durationMs: 5 }; },
    },
  };
}

/** A model that first asks for `call` (if given), then answers in text. */
async function scriptedModel(t, call) {
  const seen = [];
  const server = createServer(async (incoming, response) => {
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    const body = JSON.parse(raw);
    seen.push(body);
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: `c${seen.length}`, object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    const answered = body.messages.some((message) => message.role === "tool");
    if (call && !answered) {
      response.write(chunk({ role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: call.name, arguments: JSON.stringify(call.input) } }] }));
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

const runtime = (host) => ({ env: () => undefined, credential: () => undefined, desktop: true, agent: host });
const toolNames = (body) => (body.tools ?? []).map((entry) => entry.function.name).sort();

test("读取类工具直接执行，结果回到模型，再由模型作答", async (t) => {
  const { profile, seen } = await scriptedModel(t, { name: "read_file", input: { path: "a.txt" } });
  const { host, calls } = memoryHost();
  const { POST } = handler.createChatHandlers(runtime(host));
  const text = await (await POST(post({ messages: userMessages, profile, workspace: workspace("ask") }))).text();
  assert.deepEqual(calls, [["read", ROOT, "a.txt"]]);
  assert.match(text, /"type":"tool-output-available"/);
  assert.match(text, /完成/);
  assert.equal(seen.length, 2);
  const result = seen[1].messages.find((message) => message.role === "tool");
  assert.match(result.content, /one\\ntwo/);
  assert.match(seen[0].messages[0].content, /local project "demo"/);
  assert.deepEqual(toolNames(seen[0]), ["edit_file", "list_files", "read_file", "run_command", "search_files", "update_plan", "write_file"]);
});

test("每次询问：写文件先请求确认，未确认前不写入；确认后写入并继续", async (t) => {
  const call = { name: "write_file", input: { path: "a.txt", content: "new\n" } };
  const { profile, seen } = await scriptedModel(t, call);
  const { host, calls } = memoryHost();
  const { POST } = handler.createChatHandlers(runtime(host));
  const first = await (await POST(post({ messages: userMessages, profile, workspace: workspace("ask") }))).text();
  assert.match(first, /"type":"tool-approval-request"/);
  assert.deepEqual(calls, []);
  assert.equal(seen.length, 1);
  const approvalId = /"approvalId":"([^"]+)"/.exec(first)[1];

  const answered = [...userMessages, { id: "a1", role: "assistant", parts: [{ type: "step-start" },
    { type: "tool-write_file", toolCallId: "call_1", state: "approval-responded", input: call.input, approval: { id: approvalId, approved: true } }] }];
  const second = await (await POST(post({ messages: answered, profile, workspace: workspace("ask") }))).text();
  assert.deepEqual(calls, [["write", ROOT, "a.txt", "new\n"]]);
  assert.match(second, /"snapshot":"1-0"/);
  const result = seen.at(-1).messages.find((message) => message.role === "tool");
  assert.match(result.content, /Updated a\.txt \(\+1 −1\)/);
});

test("拒绝后不执行，模型得知被拒绝", async (t) => {
  const call = { name: "run_command", input: { command: "rm -rf build" } };
  const { profile, seen } = await scriptedModel(t, call);
  const { host, calls } = memoryHost();
  const { POST } = handler.createChatHandlers(runtime(host));
  const first = await (await POST(post({ messages: userMessages, profile, workspace: workspace("acceptEdits") }))).text();
  const approvalId = /"approvalId":"([^"]+)"/.exec(first)[1];
  const denied = [...userMessages, { id: "a1", role: "assistant", parts: [{ type: "step-start" },
    { type: "tool-run_command", toolCallId: "call_1", state: "approval-responded", input: call.input, approval: { id: approvalId, approved: false, reason: "用户拒绝了这次操作。" } }] }];
  await (await POST(post({ messages: denied, profile, workspace: workspace("acceptEdits") }))).text();
  assert.deepEqual(calls, []);
  const result = seen.at(-1).messages.find((message) => message.role === "tool");
  assert.equal(result.tool_call_id, "call_1");
  assert.match(result.content, /用户拒绝/);
});

test("完全访问直接写入；仅计划不提供修改和命令工具", async (t) => {
  const { profile, seen } = await scriptedModel(t, { name: "edit_file", input: { path: "a.txt", oldText: "old", newText: "new" } });
  const { host, calls } = memoryHost();
  const { POST } = handler.createChatHandlers(runtime(host));
  await (await POST(post({ messages: userMessages, profile, workspace: workspace("full") }))).text();
  assert.deepEqual(calls, [["edit", ROOT, "a.txt"]]);

  const planning = await scriptedModel(t);
  await (await POST(post({ messages: userMessages, profile: planning.profile, workspace: workspace("plan") }))).text();
  assert.deepEqual(toolNames(planning.seen[0]), ["list_files", "read_file", "search_files", "update_plan"]);
  assert.match(planning.seen[0].messages[0].content, /plan-only mode/);
  assert.equal(seen.length, 2);
});

test("没有本机能力的运行时不提供工具并如实说明；无效的项目字段被拒绝", async (t) => {
  const { profile, seen } = await scriptedModel(t);
  const { POST } = handler.createChatHandlers({ env: () => undefined, credential: () => undefined });
  await (await POST(post({ messages: userMessages, profile, workspace: workspace("ask") }))).text();
  assert.deepEqual(toolNames(seen[0]), []);
  assert.match(seen[0].messages[0].content, /no access to their computer/);
  for (const bad of [{ ...workspace("ask"), root: "relative/path" }, { ...workspace("ask"), permission: "root" }, { root: ROOT }]) {
    const response = await POST(post({ messages: userMessages, profile, workspace: bad }));
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  const withContact = await POST(post({ messages: userMessages, profile, workspace: workspace("ask"),
    contact: { kind: "custom", id: "c1", name: "小助手", prompt: "你好" } }));
  assert.equal(withContact.status, 400);
});

test("读取超出上限时按整行截断，并说明截断原因与续读位置", async () => {
  const files = {
    // 500 lines of 200 characters: the 60,000-character budget stops before line 400.
    "long.txt": Array.from({ length: 500 }, (_, index) => `${index + 1}:`.padEnd(200, "x")).join("\n"),
    // One minified line longer than the whole budget.
    "min.js": "a".repeat(tools.MAX_READ_CHARS + 10_000),
    "ok.txt": "one\ntwo\n",
  };
  const host = {
    read: async (root, path) => ({ path, size: files[path].length, text: files[path], binary: false, tooLarge: false }),
    list: async () => ({ entries: [], truncated: false }),
    search: async () => ({ hits: [], truncated: false }),
    write: async () => { throw new Error("读取测试不应写入"); },
    edit: async () => { throw new Error("读取测试不应写入"); },
    run: async () => { throw new Error("读取测试不应运行命令"); },
  };
  const read = tools.createAgentTools(host, ROOT).read_file.execute;

  const long = await read({ path: "long.txt" });
  const returned = long.text.split("\n");
  assert.equal(long.totalLines, 500);
  assert.ok(long.endLine < 500, "字符上限应先于 400 行触发");
  assert.equal(long.endLine, returned.length, "行号必须与返回的行数一致");
  assert.ok(long.text.length <= tools.MAX_READ_CHARS);
  assert.deepEqual(returned, files["long.txt"].split("\n").slice(0, returned.length), "每一行都必须是完整原文，不能有半行");
  assert.match(long.note, /最多 60000 字符/);
  assert.match(long.note, new RegExp(`startLine=${long.endLine + 1}`));

  const minified = await read({ path: "min.js" });
  assert.equal(minified.text.length, tools.MAX_READ_CHARS);
  assert.match(minified.note, /这一行不完整/, "单行超限必须明确告知内容不完整");

  const beyond = await read({ path: "ok.txt", startLine: 9 });
  assert.equal(beyond.text, "");
  assert.match(beyond.note, /只有 3 行/);

  const normal = await read({ path: "ok.txt" });
  assert.equal(normal.text, "one\ntwo\n");
  assert.equal(normal.note, undefined, "未触发上限时不加提示");
});

test("权限模式决定哪些调用需要确认", () => {
  assert.equal(tools.agentToolApproval("ask").write_file, "user-approval");
  assert.equal(tools.agentToolApproval("ask").read_file, "not-applicable");
  assert.equal(tools.agentToolApproval("acceptEdits").edit_file, "approved");
  assert.equal(tools.agentToolApproval("acceptEdits").run_command, "user-approval");
  assert.equal(tools.agentToolApproval("plan").run_command, "denied");
  assert.equal(tools.agentToolApproval("full").run_command, "approved");
  assert.deepEqual(request.agentWorkspaceBody(undefined, "ask"), {});
  assert.deepEqual(request.agentWorkspaceBody({ name: "demo", folders: [ROOT, "/other"] }, "plan"), { workspace: workspace("plan") });
  assert.equal(request.readAgentWorkspace({ root: "C:\\code\\demo", name: "demo", permission: "ask" })?.root, "C:\\code\\demo");
});

test("任务清单只接受有效步骤，并显示剩余步数", () => {
  const steps = plan.readPlan({ steps: [{ title: " 读代码 ", status: "completed" }, { title: "改代码", status: "in_progress" }, { title: "", status: "pending" }, { title: "x", status: "done" }] });
  assert.deepEqual(steps, [{ title: "读代码", status: "completed" }, { title: "改代码", status: "in_progress" }]);
  const progress = plan.planProgress(steps);
  assert.equal(progress.done, 1);
  assert.equal(progress.current?.title, "改代码");
  assert.equal(plan.planRemainingLabel(progress), "还剩 1 步");
  assert.equal(plan.planRemainingLabel(plan.planProgress([{ title: "a", status: "completed" }])), "已完成");
});

test("回复按发生顺序分段：文字、工具调用，清单只出现一次且为最新状态", () => {
  const planPart = (id, status) => ({ type: "tool-update_plan", toolCallId: id, state: "output-available", input: {}, output: { steps: [{ title: "改", status }] } });
  const parts = [
    { type: "step-start" }, { type: "text", text: "先看看。" }, planPart("p1", "in_progress"),
    { type: "tool-read_file", toolCallId: "r1", state: "output-available", input: { path: "a.txt" }, output: {} },
    { type: "text", text: "改好" }, { type: "text", text: "了。" }, planPart("p2", "completed"),
  ];
  const result = segments.messageSegments(parts);
  assert.deepEqual(result.map((segment) => segment.kind), ["text", "plan", "tool", "text"]);
  assert.deepEqual(result[1].steps, [{ title: "改", status: "completed" }]);
  assert.equal(result[3].text, "改好了。");
  assert.equal(segments.pendingApprovals([{ type: "tool-run_command", toolCallId: "c", state: "approval-requested", input: {}, approval: { id: "x" } }]).length, 1);
  assert.equal(segments.hasToolParts([{ type: "text", text: "hi" }]), false);
});

test("工具标题与改动预览", () => {
  assert.equal(labels.toolTitle("read_file", { path: "src/a.ts" }, true), "读取了 src/a.ts");
  assert.equal(labels.toolTitle("search_files", { query: "theme" }, false), "正在搜索 “theme”");
  assert.equal(labels.toolTitle("list_files", {}, true), "查看了 项目根目录");
  assert.equal(labels.toolTitle("mystery", {}, true), "mystery");
  assert.deepEqual(preview.editPreview("a\nb", "c\n"), [{ kind: "del", text: "a" }, { kind: "del", text: "b" }, { kind: "add", text: "c" }]);
  assert.deepEqual(preview.writePreview("x\ny\n"), [{ kind: "add", text: "x", new: 1 }, { kind: "add", text: "y", new: 2 }]);
  assert.equal(preview.lineCount(""), 0);
});
