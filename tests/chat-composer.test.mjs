import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-composer-"));
let draft, model;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-composer-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  draft = await import(pathToFileURL(join(output, "chat-composer-draft.js")));
  model = await import(pathToFileURL(join(output, "composer-model.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const file = (name, size = 10, modified = 100, path = "") => ({ name, size, lastModified: modified, webkitRelativePath: path });

test("each chat starts with separate draft state and explicit asking policy", () => {
  const first = draft.createComposerDraft();
  first.attachments.push(file("one"));
  first.permission = "auto";
  const second = draft.createComposerDraft();
  assert.equal(second.permission, "ask");
  assert.equal(second.mode, "chat");
  assert.deepEqual(second.attachments, []);
  assert.equal(draft.composerDraftBlockReason(second), undefined);
});

test("workbench defaults to Auto while contact draft defaults remain chat and state is isolated", () => {
  const workspace = draft.createComposerDraft("workspace");
  const custom = draft.createComposerDraft("custom");
  const official = draft.createComposerDraft("official");
  assert.equal(workspace.mode, "auto");
  assert.equal(custom.mode, "chat");
  assert.equal(official.mode, "chat");
  assert.equal(draft.createComposerDraft().mode, "chat");
  workspace.attachments.push(file("only-workbench.txt"));
  workspace.permission = "auto";
  workspace.mode = "agent";
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

test("workbench uses one Agent mode for general tasks and Coding while contacts keep their allowed modes", () => {
  assert.deepEqual(draft.modesForWorkspace().map((entry) => entry.id), ["auto", "chat", "study", "agent"]);
  const autoMode = draft.modesForWorkspace().find((entry) => entry.id === "auto");
  assert.equal(autoMode.label, "Auto");
  assert.equal(autoMode.description, "根据任务选择聊天、学习或 Agent");
  const agentMode = draft.modesForWorkspace().find((entry) => entry.id === "agent");
  assert.equal(agentMode.label, "Agent");
  assert.equal(agentMode.description, "处理通用任务与编程项目");
  assert.equal(draft.composerModesForContext("workspace"), draft.modesForWorkspace());
  assert.equal(draft.composerModesForContext("custom"), draft.modesForContact(false));
  assert.equal(draft.composerModesForContext("official"), draft.modesForContact(true));
  assert.deepEqual(draft.composerModesForContext("official").map((entry) => entry.label), ["聊天", "学习"]);
});

test("unconnected execution modes block ordinary chat without modifying message intent or selected files", () => {
  const selected = draft.addComposerFiles([], [file("project.ts")]).attachments;
  const state = { ...draft.createComposerDraft(), attachments: selected, goal: "修复项目", planning: true, permission: "read" };
  for (const [mode, service] of [["auto", /自动模式路由服务接入/], ["study", /学习服务接入/], ["agent", /通用任务与 Coding 执行服务接入/]]) {
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
  state.permission = "auto";
  assert.equal(state.mode, "chat");
  assert.equal(draft.composerDraftBlockReason(state), undefined);
  state.mode = "auto";
  assert.equal(state.permission, "auto");
  assert.match(draft.composerDraftBlockReason(state), /自动模式路由服务接入/);
  state.permission = "read";
  assert.equal(state.mode, "auto");
  assert.match(draft.composerDraftBlockReason(state), /自动模式路由服务接入/);
  state.mode = "chat";
  assert.equal(state.permission, "read");
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

test("pending or removed model selection blocks use of the unrelated current runtime", () => {
  const options = model.composerModels([{ id: "own", values: { name: "同名模型", model: "runtime", provider: "compatible" } }], { model: "runtime" });
  assert.equal(model.composerModelBlockReason("runtime", options), undefined);
  assert.match(model.composerModelBlockReason("own", options), /等待模型服务接入/);
  assert.match(model.composerModelBlockReason("removed", options), /已移除/);
  assert.equal(model.composerModelBlockReason(undefined, options), undefined);
});
