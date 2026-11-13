import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Batches 2 and 3 of the coding flow: stronger tools (globs, regex search,
// multi-edit, longer reads), approvals allowed for the chat, steering a
// running Agent, the composer's queue and @ mentions, and keeping long chats
// inside the context window. The handler runs against a stand-in model.
const output = mkdtempSync(join(tmpdir(), "nekopapa-agent-control-"));
let handler, tools, request, glob, queue, segments, preview, steering, mention, budget, compaction;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./agent-control-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (file.includes("node_modules") || !file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [handler, tools, request, glob, queue, segments, preview, steering, mention, budget, compaction] = await Promise.all([
    load("app/api/chat/chat-handler.js"), load("app/agent/agent-tools.js"), load("app/agent/agent-request.js"), load("app/agent/glob.js"),
    load("app/agent/message-queue.js"), load("app/agent/message-segments.js"), load("app/agent/change-preview.js"), load("app/agent/run-steering.js"),
    load("app/projects/file-mention.js"), load("app/chat/context-budget.js"), load("app/chat/context-compaction.js"),
  ]);
} finally { rmSync(output, { recursive: true, force: true }); }

const ROOT = "/projects/demo";
const workspace = (permission) => ({ root: ROOT, name: "demo", permission });
const post = (body) => new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const user = (id, text) => ({ id, role: "user", parts: [{ type: "text", text }] });
const ok = { exitCode: 0, stdout: "ok", stderr: "", timedOut: false, cancelled: false, truncated: false, durationMs: 1 };

/** A stand-in model: `reply(body, index)` returns { tool: { name, input } } or { text }. */
async function model(t, reply) {
  const seen = [];
  const server = createServer(async (incoming, response) => {
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    const body = JSON.parse(raw);
    seen.push(body);
    const answer = await reply(body, seen.length - 1);
    // generateText (the summary) asks without streaming.
    if (!body.stream) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: `c${seen.length}`, object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content: answer.text ?? "" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id: `c${seen.length}`, object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
    if (answer.tool) {
      response.write(chunk({ role: "assistant", tool_calls: [{ index: 0, id: `call_${seen.length}`, type: "function", function: { name: answer.tool.name, arguments: JSON.stringify(answer.tool.input) } }] }));
      response.write(chunk({}, "tool_calls"));
    } else {
      response.write(chunk({ role: "assistant", content: answer.text }));
      response.write(chunk({}, "stop"));
    }
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { profile: { provider: "compatible", endpoint: `http://127.0.0.1:${server.address().port}/v1`, model: "m", credential: "" }, seen };
}

function host(overrides = {}) {
  const calls = [];
  return {
    calls,
    host: {
      list: async () => ({ entries: [], truncated: false }),
      files: async () => ({ paths: ["README.md", "src/app.ts", "src/app.test.ts", "src/lib/util.tsx", "docs/a.md"], truncated: false }),
      read: async (root, path) => ({ path, size: 9, text: "1\n2\n3\n4\n5", binary: false, tooLarge: false }),
      search: async (root, query, limit) => { calls.push(["search", query, limit]); return { hits: [], truncated: false }; },
      write: async () => { throw new Error("unused"); },
      edit: async (root, path, edits) => { calls.push(["edit", path, edits]); return { path, created: false, added: 1, removed: 1, diff: "", snapshot: "1-0" }; },
      run: async (root, command) => { calls.push(["run", command]); return ok; },
      ...overrides,
    },
  };
}
const runtime = (agent) => ({ env: () => undefined, credential: () => undefined, desktop: true, agent });

test("glob：* 不跨文件夹、** 跨文件夹、无斜杠匹配任意深度、{a,b} 与 [ab]", () => {
  const match = (pattern, path) => glob.globMatcher(pattern)(path);
  assert.equal(match("*.ts", "src/app.ts"), true);
  assert.equal(match("src/*.ts", "src/lib/util.ts"), false);
  assert.equal(match("src/**/*.ts", "src/lib/util.ts"), true);
  assert.equal(match("src/**/*.ts", "src/app.ts"), true);
  assert.equal(match("*.{ts,tsx}", "src/lib/util.tsx"), true);
  assert.equal(match("app.[tj]s", "src/app.ts"), true);
  assert.equal(match("a?.md", "docs/ab.md"), true);
  assert.equal(match("*.md", "docs/a.mdx"), false);
  assert.equal(match("a+b(1).md", "a+b(1).md"), true, "正则字符按原样匹配");
  assert.equal(glob.searchPathSource(undefined, "src/lib/"), "^src/lib/");
  assert.equal(new RegExp(glob.searchPathSource("*.ts", "src")).test("src/a/b.ts"), true);
  assert.equal(new RegExp(glob.searchPathSource("*.ts", "src")).test("docs/b.ts"), false);
  assert.equal(glob.searchPathSource("", ""), undefined);
});

test("find_files 按模式列出文件；search_files 把正则、大小写和范围交给宿主", async () => {
  const { host: agentHost, calls } = host();
  const set = tools.createAgentTools(agentHost, ROOT);
  const found = await set.find_files.execute({ pattern: "*.test.ts" }, {});
  assert.deepEqual(found, { paths: ["src/app.test.ts"], total: 1, truncated: false });
  await set.search_files.execute({ query: "use\\w+", regex: true, include: "*.tsx", path: "src" }, {});
  assert.equal(calls[0][1].text, "use\\w+");
  assert.equal(calls[0][1].regex, true);
  assert.equal(calls[0][1].caseSensitive, false);
  assert.equal(new RegExp(calls[0][1].pathPattern).test("src/lib/util.tsx"), true);
  assert.equal(calls[0][2], 100);
  const part = await set.read_file.execute({ path: "a.txt", startLine: 2, lineCount: 2 }, {});
  assert.deepEqual([part.text, part.startLine, part.endLine], ["2\n3", 2, 3]);
  assert.equal(tools.READ_LINES, 2000);
});

test("edit_file 一次提交多处替换；旧格式的单处修改仍能读出", async () => {
  const { host: agentHost, calls } = host();
  const edits = [{ oldText: "a", newText: "b" }, { oldText: "x", newText: "y", replaceAll: true }];
  await tools.createAgentTools(agentHost, ROOT).edit_file.execute({ path: "a.ts", edits }, {});
  assert.deepEqual(calls[0], ["edit", "a.ts", [{ oldText: "a", newText: "b", replaceAll: false }, { oldText: "x", newText: "y", replaceAll: true }]]);
  assert.deepEqual(preview.readEdits({ path: "a.ts", oldText: "o", newText: "n" }), [{ oldText: "o", newText: "n", replaceAll: false }]);
  const lines = preview.editsPreview(edits);
  assert.deepEqual(lines.filter((line) => line.kind === "hunk").map((line) => line.text), ["第 1 处", "第 2 处（全部出现处）"]);
});

test("本对话总是允许：只放行完全相同的命令；文件修改可整体放行；仅计划仍然拒绝", async () => {
  const allow = request.readAgentAllowances({ commands: ["npm test", 5, ""], edits: true });
  assert.deepEqual(allow, { commands: ["npm test"], edits: true });
  const ask = tools.agentToolApproval("ask", allow);
  assert.equal(ask.run_command({ command: "npm test" }), "approved");
  assert.equal(ask.run_command({ command: "npm test --watch" }), "user-approval");
  assert.equal(ask.edit_file, "approved");
  assert.equal(tools.agentToolApproval("plan", allow).edit_file, "denied");
  assert.equal(tools.agentToolApproval("plan", allow).run_command, "denied");
  assert.equal(tools.agentToolApproval("ask").run_command, "user-approval");
  assert.deepEqual(request.readAgentAllowances("x"), { commands: [], edits: false });
});

test("请求带上允许的命令时，相同命令直接运行，不再请求确认", async (t) => {
  const { profile } = await model(t, (body) => body.messages.some((m) => m.role === "tool") ? { text: "完成" } : { tool: { name: "run_command", input: { command: "npm test" } } });
  const { host: agentHost, calls } = host();
  const { POST } = handler.createChatHandlers(runtime(agentHost));
  const allowed = await (await POST(post({ messages: [user("u1", "跑测试")], profile, workspace: workspace("ask"), allow: { commands: ["npm test"], edits: false } }))).text();
  // The SDK records an automatic approval; nobody is asked.
  assert.match(allowed, /"type":"tool-approval-request"[^\n]*"isAutomatic":true/);
  assert.deepEqual(calls, [["run", "npm test"]]);
  const asked = await (await POST(post({ messages: [user("u1", "跑测试")], profile, workspace: workspace("ask") }))).text();
  assert.match(asked, /"type":"tool-approval-request"/);
  assert.doesNotMatch(asked, /"isAutomatic":true/);
  assert.deepEqual(calls, [["run", "npm test"]], "未允许的命令等待确认，不运行");
});

test("运行中插话：在下一步交给模型，回复里留下插话，运行结束后不再可插", async (t) => {
  const { profile, seen } = await model(t, (body, index) => index === 0 ? { tool: { name: "run_command", input: { command: "npm test" } } } : { text: "好的，改用 pnpm" });
  let outcome;
  const { host: agentHost } = host({
    run: async () => { outcome = steering.steerRun("run-a", "改用 pnpm", "s1"); return ok; },
  });
  const { POST } = handler.createChatHandlers(runtime(agentHost));
  const text = await (await POST(post({ messages: [user("u1", "跑测试")], profile, workspace: workspace("full"), runId: "run-a" }))).text();
  assert.equal((await outcome).type, "delivered");
  assert.match(text, /"type":"steering-message"/);
  const second = seen[1].messages;
  assert.equal(second.at(-1).role, "user");
  assert.match(JSON.stringify(second.at(-1).content), /改用 pnpm/);
  assert.equal(steering.canSteerRun("run-a"), false);
  assert.equal(steering.steerRun("run-a", "晚了", "s2"), undefined);
  // The saved reply shows it in place and sends it back as a user message next time.
  const parts = [{ type: "step-start" }, { type: "tool-run_command", toolCallId: "c", state: "output-available", input: { command: "npm test" }, output: ok },
    { type: "steering-message", id: "s1", parts: [{ type: "text", text: "改用 pnpm" }] }, { type: "step-start" }, { type: "text", text: "好的" }];
  assert.deepEqual(segments.messageSegments(parts).map((segment) => segment.kind), ["tool", "steer", "text"]);
  assert.equal(segments.hasOrderedParts([{ type: "steering-message", id: "x", parts: [] }]), true);
});

test("排队消息合并为一条发送；带网页标注的不能插话", () => {
  const plain = { id: "1", text: "先跑测试", message: { text: "先跑测试" }, state: "queued" };
  const marked = { id: "2", text: "看这个按钮", message: { parts: [{ type: "text", text: "看这个按钮" }, { type: "data-page-elements", data: { elements: [] } }] }, state: "queued" };
  assert.equal(queue.mergeQueuedMessages([plain]), plain.message);
  assert.deepEqual(queue.mergeQueuedMessages([plain, marked]), { parts: [{ type: "text", text: "先跑测试\n\n看这个按钮" }, { type: "data-page-elements", data: { elements: [] } }] });
  assert.equal(queue.canSteerMessage(plain), true);
  assert.equal(queue.canSteerMessage(marked), false);
});

test("@ 引用：光标所在的 @ 词、文件排序与插入", () => {
  assert.deepEqual(mention.mentionQuery("看 @src/ap", 9), { start: 2, query: "src/ap" });
  assert.equal(mention.mentionQuery("mail@x.com", 10), undefined, "词中间的 @ 不算");
  assert.deepEqual(mention.mentionQuery("@", 1), { start: 0, query: "" });
  const paths = ["src/lib/app-config.ts", "src/app.ts", "docs/apple.md", "README.md", "src/a/p/p.ts"];
  assert.deepEqual(mention.rankMentions(paths, "app"), ["src/app.ts", "docs/apple.md", "src/lib/app-config.ts", "src/a/p/p.ts"]);
  assert.deepEqual(mention.rankMentions(paths, "", 2), ["README.md", "src/app.ts"]);
  const query = mention.mentionQuery("看 @ap 的", 5);
  assert.deepEqual(mention.insertMention("看 @ap 的", query, 5, "src/app.ts"), { text: "看 @src/app.ts 的", caret: 14 });
  assert.equal(mention.insertMention("@a", mention.mentionQuery("@a", 2), 2, "my docs/a.md").text, '@"my docs/a.md" ');
});

test("上下文预算：中文按字、英文约四字符一个 Token；超出时从最早的大块工具结果开始省略", () => {
  assert.equal(budget.textTokens("你好"), 2);
  assert.equal(budget.textTokens("abcdefgh"), 2);
  const big = "x".repeat(4000);
  const exchange = (id) => [
    { role: "assistant", content: [{ type: "tool-call", toolCallId: id, toolName: "write_file", input: { path: `${id}.ts`, content: big } }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: id, toolName: "write_file", output: { type: "text", value: big } }] },
  ];
  const messages = [{ role: "user", content: "改" }, ...exchange("a"), ...exchange("b"), ...exchange("c")];
  assert.equal(budget.pruneToolTraffic(messages, 1e6), messages, "预算内原样返回");
  const pruned = budget.pruneToolTraffic(messages, 3000, 1);
  assert.deepEqual(pruned[1].content[0].input, { path: "a.ts", omitted: "Earlier input removed to save context." });
  assert.match(pruned[2].content[0].output.value, /removed to save context/);
  assert.equal(pruned[6].content[0].output.value, big, "最近的工具结果保留");
  assert.equal(messages[2].content[0].output.value, big, "不改动原数组");
  assert.ok(budget.estimateTokens(pruned) < budget.estimateTokens(messages));
});

test("压缩记录：读取、按最近两轮切分，并从保存的摘要之后继续", () => {
  const reply = (id, metadata) => ({ id, role: "assistant", parts: [{ type: "text", text: "答" }], metadata });
  const messages = [user("u1", "一"), reply("a1"), user("u2", "二"), reply("a2"), user("u3", "三"), reply("a3", { compaction: { through: "a1", summary: "早先：一", messages: 2 } }), user("u4", "四")];
  assert.equal(compaction.recentStart(messages), 4);
  const applied = compaction.applyCompaction(messages);
  assert.equal(applied.summary, "早先：一");
  assert.deepEqual(applied.rest.map((m) => m.id), ["u2", "a2", "u3", "a3", "u4"]);
  assert.equal(compaction.readCompaction({ compaction: { through: "x", summary: " " } }), undefined);
  assert.deepEqual(compaction.applyCompaction([user("u1", "一")]).rest.map((m) => m.id), ["u1"]);
});

test("长对话超过窗口 75% 时先生成摘要，再只带最近两轮作答，并把摘要存进回复", async (t) => {
  const { profile, seen } = await model(t, (body) => body.messages[0]?.content?.includes?.("compress the earlier part") ? { text: "摘要：用户要做 A，已完成 B。" } : { text: "继续" });
  const long = "很长的内容。".repeat(800);
  const history = [user("u1", long), { id: "a1", role: "assistant", parts: [{ type: "text", text: long }] }, user("u2", long), { id: "a2", role: "assistant", parts: [{ type: "text", text: "好" }] }, user("u3", "接着做")];
  const { POST } = handler.createChatHandlers(runtime(undefined));
  const text = await (await POST(post({ messages: history, profile: { ...profile, contextWindow: 8000 } }))).text();
  assert.equal(seen.length, 2, "一次摘要请求加一次回复");
  assert.match(JSON.stringify(seen[0].messages), /Conversation to summarize/);
  const replyMessages = seen[1].messages.filter((m) => m.role !== "system");
  assert.deepEqual(replyMessages.map((m) => m.role), ["user", "assistant", "user"]);
  assert.match(seen[1].messages[0].content, /摘要：用户要做 A/);
  assert.match(text, /"compaction":\{"through":"a1","summary":"摘要：用户要做 A，已完成 B。","messages":2\}/);
  // Short chats are sent as they are.
  const short = await model(t, () => ({ text: "嗨" }));
  await (await POST(post({ messages: [user("u1", "你好")], profile: short.profile }))).text();
  assert.equal(short.seen.length, 1);
});
