import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-composer-"));
let draft, model;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-composer-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  // Node needs the .js on relative imports that tsc leaves bare.
  for (const name of readdirSync(output, { recursive: true })) {
    const path = join(output, String(name));
    if (path.endsWith(".js")) writeFileSync(path, readFileSync(path, "utf8").replace(/(from\s+)(["'])(\.{1,2}\/[^"']+?)(?<!\.js)\2/g, "$1$2$3.js$2"));
  }
  draft = await import(pathToFileURL(join(output, "chat/chat-composer-draft.js")));
  model = await import(pathToFileURL(join(output, "models/composer-model.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const file = (name, size = 10, modified = 100, path = "") => ({ name, size, lastModified: modified, webkitRelativePath: path });

test("each chat starts with separate draft state and explicit asking policy", () => {
  const first = draft.createComposerDraft();
  first.attachments.push(file("one"));
  first.permission = "full";
  const second = draft.createComposerDraft();
  assert.equal(second.permission, "ask");
  assert.equal(second.mode, "chat");
  assert.deepEqual(second.attachments, []);
  assert.equal(draft.composerDraftBlockReason(second), undefined);
});

test("workbench defaults to automatic routing while contact draft defaults remain chat and state is isolated", () => {
  const workspace = draft.createComposerDraft("workspace");
  const custom = draft.createComposerDraft("custom");
  const official = draft.createComposerDraft("official");
  assert.equal(workspace.mode, "auto");
  assert.equal(custom.mode, "chat");
  assert.equal(official.mode, "chat");
  assert.equal(draft.createComposerDraft().mode, "chat");
  workspace.attachments.push(file("only-workbench.txt"));
  workspace.permission = "full";
  workspace.mode = "study";
  for (const contactDraft of [custom, official]) {
    assert.equal(contactDraft.mode, "chat");
    assert.equal(contactDraft.permission, "ask");
    assert.deepEqual(contactDraft.attachments, []);
  }
  const freshWorkspace = draft.createComposerDraft("workspace");
  assert.equal(freshWorkspace.mode, "auto");
  assert.equal(freshWorkspace.permission, "ask");
  assert.deepEqual(freshWorkspace.attachments, []);
});

test("new drafts take the permission mode from 设置 → 权限规则; unknown or retired values fall back to asking", () => {
  assert.deepEqual(draft.composerPermissions.map((entry) => entry.id), ["ask", "acceptEdits", "plan", "full"]);
  assert.equal(draft.createComposerDraft("workspace", "plan").permission, "plan");
  assert.equal(draft.createComposerDraft("workspace", "full").permission, "full");
  for (const retired of ["read", "auto", undefined, "constructor"]) assert.equal(draft.createComposerDraft("workspace", retired).permission, "ask");
  assert.equal(draft.selectComposerMode(draft.createComposerDraft("custom"), "study").mode, "study");
});

test("file selection retains actual file and stable existing identities, without upload or data URLs", () => {
  const source = file("notes.md", 20, 10, "course/notes.md");
  const first = draft.addComposerFiles([], [source]);
  assert.equal(first.attachments[0].file, source);
  assert.equal(first.attachments[0].path, "course/notes.md");
  const again = draft.addComposerFiles(first.attachments, [source, file("notes.md", 21, 11, "course/notes.md")]);
  assert.equal(again.attachments.length, 2);
  assert.equal(again.attachments[0].id, first.attachments[0].id);
  assert.equal(first.attachments.length, 1);
});

test("invalid paths, per-file limit, count and total budget reject files while preserving accepted selections", () => {
  const max = draft.COMPOSER_FILE_MAX_BYTES;
  const result = draft.addComposerFiles([], [file("bad", 1, 1, "../bad"), file("large", max + 1), file("one", max), file("two", max), file("three", max)]);
  assert.equal(result.attachments.length, 2);
  assert.equal(result.errors.length, 3);
  const count = draft.addComposerFiles([], Array.from({ length: 11 }, (_, index) => file(`file-${index}`)));
  assert.equal(count.attachments.length, 10);
  assert.match(count.errors.join(""), /10 个/);
});

test("attachment and output selection cannot silently send a plain message that loses the user's selected context", () => {
  const state = draft.createComposerDraft();
  state.attachments = draft.addComposerFiles([], [file("notes.pdf")]).attachments;
  assert.match(draft.composerDraftBlockReason(state), /附件发送尚未接入/);
  state.attachments = [];
  for (const artifact of draft.composerArtifacts) {
    state.artifact = artifact.id;
    assert.match(draft.composerDraftBlockReason(state), /文件生成尚未接入/);
  }
  state.artifact = null;
  assert.equal(draft.composerDraftBlockReason(state), undefined);
});

test("goals validate trimming and bounds; planning text preserves body and never claims execution", () => {
  assert.deepEqual(draft.validateComposerGoal("  理解递归  "), { goal: "理解递归", error: undefined });
  assert.ok(draft.validateComposerGoal("x".repeat(1001)).error);
  const state = { ...draft.createComposerDraft(), goal: "理解递归", planning: true };
  const body = "解释这段代码";
  const text = draft.buildComposerText(body, state);
  assert.ok(text.startsWith(body));
  assert.match(text, /本次目标：理解递归/);
  assert.match(text, /暂不执行/);
  assert.equal(body, "解释这段代码");
});

test("official contacts only expose chat and study; selecting study cannot fall through to general chat", () => {
  assert.deepEqual(draft.modesForContact(true).map((entry) => entry.id), ["chat", "study"]);
  assert.deepEqual(draft.modesForContact(false).map((entry) => entry.id), ["chat", "study", "professional"]);
  const state = { ...draft.createComposerDraft(), mode: "study" };
  assert.match(draft.composerDraftBlockReason(state), /学习服务接入/);
  state.mode = "chat";
  assert.equal(draft.composerDraftBlockReason(state), undefined);
});

test("the workbench only routes automatically while contacts keep their allowed modes", () => {
  assert.deepEqual(draft.modesForWorkspace().map((entry) => entry.id), ["auto"]);
  assert.match(draft.modesForWorkspace()[0].description, /接入前按聊天回复/);
  assert.equal(draft.composerDraftBlockReason(draft.createComposerDraft("workspace")), undefined);
  assert.equal(draft.composerModesForContext("workspace"), draft.modesForWorkspace());
  assert.equal(draft.composerModesForContext("custom"), draft.modesForContact(false));
  assert.equal(draft.composerModesForContext("official"), draft.modesForContact(true));
  assert.deepEqual(draft.composerModesForContext("official").map((entry) => entry.label), ["聊天", "学习"]);
});

test("unconnected execution modes block ordinary chat without modifying message intent or selected files", () => {
  const selected = draft.addComposerFiles([], [file("project.ts")]).attachments;
  const state = { ...draft.createComposerDraft(), attachments: selected, goal: "修复项目", planning: true, permission: "plan" };
  for (const [mode, service] of [["auto", /附件发送尚未接入/], ["study", /学习服务接入/]]) {
    state.mode = mode;
    const before = structuredClone({ ...state, attachments: state.attachments.map(({ file, ...metadata }) => metadata) });
    assert.match(draft.composerDraftBlockReason(state), service);
    for (const context of ["workspace", "custom", "official"]) draft.composerModesForContext(context);
    assert.deepEqual({ ...state, attachments: state.attachments.map(({ file, ...metadata }) => metadata) }, before);
    assert.equal(state.attachments, selected);
  }
  state.mode = "chat";
  assert.match(draft.composerDraftBlockReason(state), /附件发送尚未接入/);
  state.attachments = [];
  assert.equal(draft.composerDraftBlockReason(state), undefined);
  state.mode = "professional";
  assert.equal(draft.composerDraftBlockReason(state), undefined);
});

test("automatic task routing and automatic tool permission remain independent choices", () => {
  const state = draft.createComposerDraft();
  assert.equal(state.mode, "chat");
  assert.equal(state.permission, "ask");
  state.permission = "full";
  assert.equal(state.mode, "chat");
  assert.equal(draft.composerDraftBlockReason(state), undefined);
  // Until study and Agent exist, Auto answers as chat, so it sends like chat does.
  state.mode = "auto";
  assert.equal(state.permission, "full");
  assert.equal(draft.composerDraftBlockReason(state), undefined);
  state.permission = "plan";
  assert.equal(state.mode, "auto");
  assert.equal(draft.composerDraftBlockReason(state), undefined);
  state.mode = "chat";
  assert.equal(state.permission, "plan");
  assert.equal(draft.composerDraftBlockReason(state), undefined);
});

test("model options derive from actual configuration identity and runtime, without exposing endpoint or credential reference", () => {
  const records = [{ id: "own-1", values: { name: "我的课程模型", model: "course-model", provider: "compatible", endpoint: "https://private.example", environment: "SECRET_NAME" } }];
  const options = model.composerModels(records, { model: "runtime-model", provider: "当前提供方" });
  assert.deepEqual(options.map((entry) => entry.id), ["runtime", "own-1"]);
  assert.equal(options[1].runtime, false);
  assert.ok(!JSON.stringify(options).includes("private.example"));
  assert.ok(!JSON.stringify(options).includes("SECRET_NAME"));
  assert.deepEqual(model.composerModels([], {}), []);
});

test("model search supports names, identifiers and provider groups, with empty and no-result cases", () => {
  const options = model.composerModels([{ id: "own", values: { name: "课程辅导", model: "course-model", provider: "anthropic" } }], { model: "runtime", provider: "本地" });
  assert.equal(model.filterComposerModels(options, "课程")[0].id, "own");
  assert.equal(model.filterComposerModels(options, "COURSE")[0].id, "own");
  assert.equal(model.filterComposerModels(options, "", "本地")[0].id, "runtime");
  assert.deepEqual(model.filterComposerModels(options, "missing"), []);
});

test("a saved model profile answers; an invalid or removed one blocks instead of falling back to the runtime", () => {
  const records = [
    { id: "own", values: { name: "同名模型", model: "runtime", provider: "compatible", endpoint: "http://127.0.0.1:11434/v1", environment: "" } },
    { id: "bad", values: { name: "坏配置", model: "m", provider: "compatible", endpoint: "not a url", environment: "" } },
  ];
  const options = model.composerModels(records, { model: "runtime" });
  assert.equal(model.composerModelBlockReason("runtime", options, records), undefined);
  assert.equal(model.composerModelBlockReason("own", options, records), undefined);
  assert.match(model.composerModelBlockReason("bad", options, records), /服务地址或模型标识无效/);
  assert.match(model.composerModelBlockReason("removed", options, records), /已移除/);
  assert.equal(model.composerModelBlockReason(undefined, options, records), undefined);
});


test("a connection contributes each configured model without duplicating the API profile", () => {
  const records = [{ id: "shared", values: { name: "共享连接", model: "first", additionalModels: "second\nthird",
    provider: "compatible", endpoint: "https://provider.example/v1", keySource: "keychain" } }];
  const options = model.composerModels(records, {});
  assert.deepEqual(options.map(({ model, connectionId }) => [model, connectionId]),
    [["first", "shared"], ["second", "shared"], ["third", "shared"]]);
  assert.equal(model.composerModelBlockReason(options[1].id, options, records), undefined);
  const remaining = [{ ...records[0], values: { ...records[0].values, additionalModels: "third" } }];
  assert.match(model.composerModelBlockReason(options[1].id, model.composerModels(remaining, {}), remaining), /已移除/);
});

test("the model picker groups saved profiles by the vendor whose address they use, else by interface type", () => {
  const options = model.composerModels([
    { id: "glm", values: { name: "智谱", model: "glm-4.6", provider: "compatible", endpoint: "https://open.bigmodel.cn/api/paas/v4/" } },
    { id: "ds", values: { name: "DeepSeek", model: "deepseek-chat", provider: "compatible", endpoint: "https://api.deepseek.com/v1" } },
    { id: "own", values: { name: "自建", model: "m", provider: "compatible", endpoint: "https://llm.example/v1" } },
  ], {});
  assert.deepEqual(options.map((entry) => [entry.provider, entry.vendor]), [["智谱 GLM", "zhipu"], ["DeepSeek", "deepseek"], ["OpenAI 兼容接口", undefined]]);
  assert.deepEqual(model.filterComposerModels(options, "", "智谱 GLM").map((entry) => entry.id), ["glm"]);
  assert.deepEqual(model.filterComposerModels(options, "deepseek").map((entry) => entry.id), ["ds"]);
});
