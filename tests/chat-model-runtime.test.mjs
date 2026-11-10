import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 设置 → 模型与 API profiles answering chat, 测试连接, chat links and the split diff.
const output = mkdtempSync(join(tmpdir(), "nekopapa-chat-model-runtime-"));
let route, profiles, links, address, diffRows, vendors, blocks;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./chat-model-runtime-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  symlinkSync(fileURLToPath(new URL("../node_modules", import.meta.url)), join(output, "node_modules"), "dir");
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (file.includes("node_modules") || !file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  route = await import(pathToFileURL(join(output, "app/api/chat/route.js")));
  profiles = await import(pathToFileURL(join(output, "app/chat-model-profile.js")));
  links = await import(pathToFileURL(join(output, "app/message-links.js")));
  address = await import(pathToFileURL(join(output, "app/browser-address.js")));
  diffRows = await import(pathToFileURL(join(output, "app/diff-rows.js")));
  vendors = await import(pathToFileURL(join(output, "app/model-vendors.js")));
  blocks = await import(pathToFileURL(join(output, "app/message-blocks.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const messages = [{ id: "user-1", role: "user", parts: [{ type: "text", text: "你好" }] }];
const post = (path, body) => new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** A stand-in OpenAI-compatible server: lists one model and streams one reply. */
async function fakeServer(t, { status = 200, reasoning = "" } = {}) {
  const seen = [];
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    seen.push({ path: request.url, authorization: request.headers.authorization, body: raw ? JSON.parse(raw) : undefined });
    if (status !== 200) { response.writeHead(status, { "content-type": "application/json" }); response.end("{}"); return; }
    if (request.url === "/v1/models") { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ data: [{ id: "tiny-model" }, { id: "alpha-model" }, { id: "tiny-model" }] })); return; }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null, usage) => `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 0, model: "tiny-model", choices: [{ index: 0, delta, finish_reason: finish }], ...(usage ? { usage } : {}) })}\n\n`;
    if (reasoning) response.write(chunk({ role: "assistant", reasoning_content: reasoning }));
    response.write(chunk({ role: "assistant", content: "配置回复" }));
    response.write(chunk({}, "stop", { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }));
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { endpoint: `http://127.0.0.1:${server.address().port}/v1`, seen };
}

test("模型配置只接受完整的服务地址、模型和凭据变量名", () => {
  const valid = { provider: "compatible", endpoint: "http://127.0.0.1:11434/v1/", model: "llama3.2", credential: "" };
  assert.deepEqual(profiles.readChatModelProfile(valid), { ...valid, endpoint: "http://127.0.0.1:11434/v1" });
  for (const change of [{ provider: "openai" }, { endpoint: "ftp://x.test" }, { endpoint: "https://user:pw@x.test/v1" }, { endpoint: "https://x.test/v1?key=1" }, { model: "" }, { credential: "PATH" }, { credential: "HOME" }]) {
    assert.equal(profiles.readChatModelProfile({ ...valid, ...change }), undefined, JSON.stringify(change));
  }
  assert.equal(profiles.isCredentialName("MODEL_API_KEY"), true);
  const record = (values) => ({ id: "r1", values: { name: "本地", provider: "compatible", endpoint: "http://127.0.0.1:1234/v1", model: "m", environment: "", ...values } });
  assert.equal(profiles.chatModelProfile(record({})).profile?.model, "m");
  assert.equal(profiles.chatModelProfile(record({ contextWindow: 128000 })).profile?.contextWindow, 128000);
  for (const contextWindow of [0, -1, 1.5, "128000", 10000001]) {
    assert.equal(profiles.chatModelProfile(record({ contextWindow })).profile?.contextWindow, undefined);
  }
  assert.match(profiles.chatModelProfile(record({ environment: "MY_VAR" })).reason, /KEY、TOKEN 或 SECRET/);
  assert.match(profiles.chatModelProfile(record({ endpoint: "not a url" })).reason, /服务地址或模型标识无效/);
});

test("所选模型配置经运行时回复：密钥取自环境变量，个性化指令加入系统提示", async (t) => {
  const { endpoint, seen } = await fakeServer(t);
  process.env.NEKOPAPA_TEST_API_KEY = "test-value-from-env";
  t.after(() => { delete process.env.NEKOPAPA_TEST_API_KEY; });
  const profile = { provider: "compatible", endpoint, model: "tiny-model", credential: "NEKOPAPA_TEST_API_KEY", contextWindow: 128000 };
  const response = await route.POST(post("/api/chat", { messages, profile, instructions: "请叫我店长。" }));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.match(text, /配置回复/);
  assert.match(text, /"totalTokens":5/);
  assert.match(text, /"contextWindow":128000/);
  const call = seen.find((entry) => entry.path === "/v1/chat/completions");
  assert.equal(call.authorization, "Bearer test-value-from-env");
  assert.equal(call.body.model, "tiny-model");
  assert.equal(call.body.contextWindow, undefined);
  const system = call.body.messages.find((message) => message.role === "system").content;
  assert.match(system, /请叫我店长/);
  assert.match(system, /OpenAI 兼容接口 using tiny-model/);
});

test("模型配置的变量未设置时如实说明；格式错误的配置被拒绝", async () => {
  const profile = { provider: "compatible", endpoint: "http://127.0.0.1:9/v1", model: "m", credential: "NEKOPAPA_UNSET_API_KEY" };
  const missing = await route.POST(post("/api/chat", { messages, profile }));
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).message, /NEKOPAPA_UNSET_API_KEY/);
  const invalid = await route.POST(post("/api/chat", { messages, profile: { ...profile, credential: "PATH" } }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "invalid_profile");
});

test("测试连接读取模型列表，区分已连接、模型不存在和凭据被拒", async (t) => {
  const { endpoint } = await fakeServer(t);
  const check = async (body) => (await route.TEST(post("/api/model-test", body))).json();
  const ok = await check({ profile: { provider: "compatible", endpoint, model: "tiny-model", credential: "" } });
  assert.deepEqual([ok.ok, ok.listed], [true, true]);
  const wrongModel = await check({ profile: { provider: "compatible", endpoint, model: "other", credential: "" } });
  assert.deepEqual([wrongModel.ok, wrongModel.listed], [true, false]);
  assert.match(wrongModel.message, /没有 other/);
  const refused = await fakeServer(t, { status: 401 });
  const denied = await check({ profile: { provider: "compatible", endpoint: refused.endpoint, model: "m", credential: "" } });
  assert.equal(denied.ok, false);
  assert.match(denied.message, /HTTP 401/);
  const unreachable = await check({ profile: { provider: "compatible", endpoint: "http://127.0.0.1:9/v1", model: "m", credential: "" } });
  assert.equal(unreachable.ok, false);
  assert.equal((await route.TEST(post("/api/model-test", { profile: { provider: "x" } }))).status, 400);
});

test("获取模型列表不需要先填模型，返回服务自己的模型；没有列表时说明原因", async (t) => {
  const { endpoint, seen } = await fakeServer(t);
  const list = async (body) => (await route.TEST(post("/api/model-test", body))).json();
  const listed = await list({ list: true, profile: { provider: "compatible", endpoint, model: "", credential: "" } });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.models, ["alpha-model", "tiny-model"]);
  assert.equal(seen.at(-1).path, "/v1/models");
  // Without list mode an empty model is still refused.
  assert.equal((await route.TEST(post("/api/model-test", { profile: { provider: "compatible", endpoint, model: "", credential: "" } }))).status, 400);
  const missing = await fakeServer(t, { status: 404 });
  const none = await list({ list: true, profile: { provider: "compatible", endpoint: missing.endpoint, model: "", credential: "" } });
  assert.deepEqual([none.ok, none.models], [false, []]);
  assert.match(none.message, /没有提供模型列表（HTTP 404）.*手动填写模型标识/);
  const unset = await list({ list: true, profile: { provider: "compatible", endpoint, model: "", credential: "NEKOPAPA_TEST_UNSET_KEY" } });
  assert.equal(unset.ok, false);
  assert.match(unset.message, /export NEKOPAPA_TEST_UNSET_KEY=/);
  assert.match(unset.message, /重启开发服务器/);
  const keychain = await list({ list: true, profile: { provider: "compatible", endpoint, model: "", credential: "keychain:record-1" } });
  assert.equal(keychain.ok, false);
  assert.match(keychain.message, /浏览器预览读不到/);
});

test("服务商预设都是可用的模型配置，并能从服务地址认回", () => {
  const ids = new Set();
  for (const entry of vendors.MODEL_VENDORS) {
    assert.ok(!ids.has(entry.id), entry.id);
    ids.add(entry.id);
    const profile = profiles.readChatModelProfile({ provider: entry.provider, endpoint: entry.endpoint, model: "placeholder", credential: entry.env });
    assert.ok(profile, entry.id);
    assert.equal(profile.endpoint, entry.endpoint, entry.id);
    if (entry.region === "local") assert.equal(entry.env, "", entry.id);
    else assert.equal(profiles.isCredentialName(entry.env), true, entry.id);
    assert.equal(vendors.vendorForEndpoint(entry.endpoint), entry.id);
    assert.equal(vendors.vendorForEndpoint(`${entry.endpoint}/`), entry.id);
  }
  assert.equal(vendors.vendorForEndpoint("http://localhost:11434/v1"), "ollama");
  assert.equal(vendors.vendorForEndpoint("https://example.test/v1"), vendors.CUSTOM_VENDOR);
  assert.equal(vendors.vendorForEndpoint(""), vendors.CUSTOM_VENDOR);
});

test("聊天回复中的网址成为链接，按设置决定打开位置", () => {
  assert.deepEqual(links.splitMessageLinks("见 https://example.com/a?b=1。然后（http://localhost:5173/）"), [
    { text: "见 " }, { text: "https://example.com/a?b=1", url: "https://example.com/a?b=1" }, { text: "。然后（" },
    { text: "http://localhost:5173/", url: "http://localhost:5173/" }, { text: "）" },
  ]);
  assert.deepEqual(links.splitMessageLinks("没有链接"), [{ text: "没有链接" }]);
  assert.deepEqual(links.splitMessageLinks("结尾 https://x.test/p."), [{ text: "结尾 " }, { text: "https://x.test/p", url: "https://x.test/p" }, { text: "." }]);
  const settings = { webTarget: "system", localTarget: "internal" };
  assert.equal(links.messageLinkTarget("http://localhost:3000/", settings), "internal");
  assert.equal(links.messageLinkTarget("https://example.com/", settings), "system");
  assert.equal(links.messageLinkTarget("https://example.com/", undefined), "system");
});

test("地址栏默认只显示域名和路径，完整网址按设置显示", () => {
  assert.equal(address.displayBrowserAddress("https://example.com/docs/a/?q=1#top", false), "example.com/docs/a");
  assert.equal(address.displayBrowserAddress("https://example.com/", false), "example.com");
  assert.equal(address.displayBrowserAddress("https://example.com/docs?q=1"), "https://example.com/docs?q=1");
});

test("并排差异把删除行与随后的新增行配对", () => {
  const rows = diffRows.splitRows([
    { kind: "hunk", text: "@@ -1,3 +1,3 @@" },
    { kind: "ctx", text: "a", old: 1, new: 1 },
    { kind: "del", text: "b", old: 2 }, { kind: "del", text: "c", old: 3 },
    { kind: "add", text: "B", new: 2 },
    { kind: "add", text: "D", new: 3 },
    { kind: "add", text: "E", new: 4 },
  ]);
  assert.deepEqual(rows.map((row) => row.header ?? `${row.left?.text ?? "-"}|${row.right?.text ?? "-"}`), ["@@ -1,3 +1,3 @@", "a|a", "b|B", "c|D", "-|E"]);
});

test("推理模型的思考过程随回复流出，但历史中的思考不再发回服务", async (t) => {
  const { endpoint, seen } = await fakeServer(t, { reasoning: "先想一想" });
  const history = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "第一问" }] },
    { id: "a1", role: "assistant", parts: [{ type: "reasoning", text: "旧的思考" }, { type: "text", text: "旧回答" }] },
    { id: "u2", role: "user", parts: [{ type: "text", text: "第二问" }] },
  ];
  const response = await route.POST(post("/api/chat", { messages: history, profile: { provider: "compatible", endpoint, model: "tiny-model", credential: "" } }));
  const text = await response.text();
  assert.match(text, /"type":"reasoning-delta"/);
  assert.match(text, /先想一想/);
  const call = seen.find((entry) => entry.path === "/v1/chat/completions");
  assert.doesNotMatch(JSON.stringify(call.body.messages), /旧的思考/);
  assert.match(JSON.stringify(call.body.messages), /旧回答/);
});

test("回复中的代码围栏拆成代码块，生成中未闭合的也按代码显示", () => {
  const reply = "看这里：\n```tsx\nconst a = 1;\n```\n后面的话\n~~~\nplain\n~~~\n```py\nprint(1)";
  assert.deepEqual(blocks.splitMessageBlocks(reply), [
    { kind: "text", text: "看这里：" },
    { kind: "code", lang: "tsx", code: "const a = 1;", complete: true },
    { kind: "text", text: "后面的话" },
    { kind: "code", lang: "", code: "plain", complete: true },
    { kind: "code", lang: "py", code: "print(1)", complete: false },
  ]);
  assert.deepEqual(blocks.splitMessageBlocks("没有代码"), [{ kind: "text", text: "没有代码" }]);
  assert.deepEqual(blocks.splitMessageBlocks("````md\n```\ninner\n```\n````"), [{ kind: "code", lang: "md", code: "```\ninner\n```", complete: true }]);
});

test("密钥来源：钥匙串中的 API Key 只以记录编号引用，浏览器预览如实说明读不到", async () => {
  const record = (values) => ({ id: "rec-1", values: { name: "DeepSeek", provider: "compatible", endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat", environment: "DEEPSEEK_API_KEY", ...values } });
  assert.equal(profiles.chatModelProfile(record({ keySource: "keychain" })).profile.credential, "keychain:rec-1");
  assert.equal(profiles.chatModelProfile(record({ keySource: "none" })).profile.credential, "");
  // Records saved before 密钥来源 existed keep reading their variable.
  assert.equal(profiles.chatModelProfile(record({})).profile.credential, "DEEPSEEK_API_KEY");
  assert.equal(profiles.keychainId("keychain:rec-1"), "rec-1");
  for (const bad of ["keychain:", "keychain:../x", "keychain:a b", "rec-1"]) assert.equal(profiles.keychainId(bad), undefined, bad);
  assert.equal(profiles.readChatModelProfile({ provider: "compatible", endpoint: "https://x.test/v1", model: "m", credential: "keychain:../x" }), undefined);
  const response = await route.POST(post("/api/chat", { messages, profile: { provider: "compatible", endpoint: "http://127.0.0.1:9/v1", model: "m", credential: "keychain:rec-1" } }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /钥匙串.*浏览器预览读不到/);
});


test("selected model is sent with the connection's credential and its own known context", () => {
  const saved = { id: "shared", values: { provider: "compatible", endpoint: "https://provider.example/v1",
    model: "first", keySource: "keychain", additionalModels: "second", contextWindow: 128000 } };
  const first = profiles.chatModelProfile(saved).profile;
  const second = profiles.chatModelProfile(saved, "second").profile;
  assert.equal(first.contextWindow, 128000);
  assert.equal(second.model, "second");
  assert.equal(second.endpoint, first.endpoint);
  assert.equal(second.credential, first.credential);
  assert.equal(second.contextWindow, undefined);
  assert.match(profiles.chatModelProfile(saved, "removed").reason, /已从这份配置中移除/);
});
