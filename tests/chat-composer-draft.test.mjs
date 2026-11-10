import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-composer-draft-"));
let domain;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./chat-composer-draft-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  // Node needs the .js on relative imports that tsc leaves bare.
  for (const name of readdirSync(output, { recursive: true })) {
    const path = join(output, String(name));
    if (path.endsWith(".js")) writeFileSync(path, readFileSync(path, "utf8").replace(/(from\s+)(["'])(\.{1,2}\/[^"']+?)(?<!\.js)\2/g, "$1$2$3.js$2"));
  }
  domain = await import(pathToFileURL(join(output, "app/chat-composer-draft.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { createComposerDraft, addComposerFiles, validateComposerGoal, composerDraftBlockReason,
  buildComposerText, composerArtifacts, COMPOSER_FILE_MAX_BYTES, COMPOSER_TOTAL_MAX_BYTES, COMPOSER_FILE_LIMIT } = domain;
const file = (name, size = 10, path = "", modified = 5) => {
  const value = new File(["content"], name, { type: "text/plain", lastModified: modified });
  Object.defineProperty(value, "size", { value: size });
  Object.defineProperty(value, "webkitRelativePath", { value: path });
  return value;
};

test("每个输入区拥有独立空草稿，修改文件、目标和产物不污染另一个会话", () => {
  const first = createComposerDraft();
  const second = createComposerDraft();
  first.attachments.push(...addComposerFiles([], [file("notes.txt")]).attachments);
  first.goal = "理解课程";
  first.planning = true;
  first.artifact = "document";
  assert.deepEqual(second, { attachments: [], pageElements: [], projectDirectory: "", goal: "", planning: false, artifact: null, mode: "chat", permission: "ask" });
});

test("添加文件保留原File内容、稳定ID和文件夹路径，移除时其他文件身份不变", async () => {
  const selected = file("notes.txt", 10, "course/notes.txt");
  const first = addComposerFiles([], [selected]);
  assert.deepEqual(first.errors, []);
  assert.equal(first.attachments[0].file, selected);
  assert.equal(await first.attachments[0].file.text(), "content");
  assert.equal(first.attachments[0].path, "course/notes.txt");
  assert.ok(first.attachments[0].id);
  const second = addComposerFiles(first.attachments, [file("other.txt")]);
  assert.equal(first.attachments.length, 1);
  assert.equal(second.attachments[0], first.attachments[0]);
  assert.equal(second.attachments[1].name, "other.txt");
});

test("同次或后续重复选择不会新增，相同名称的不同相对路径可以同时添加", () => {
  const original = file("chapter.txt", 10, "math/chapter.txt");
  const first = addComposerFiles([], [original, original, file("chapter.txt", 10, "code/chapter.txt")]);
  assert.equal(first.attachments.length, 2);
  assert.deepEqual(first.errors, []);
  const second = addComposerFiles(first.attachments, [file("chapter.txt", 10, "math/chapter.txt")]);
  assert.equal(second.attachments.length, 2);
  assert.deepEqual(second.errors, []);
  const afterRemoval = addComposerFiles(first.attachments.slice(1), [original]);
  assert.equal(afterRemoval.attachments.length, 2);
  assert.equal(afterRemoval.errors.length, 0);
});

test("超大文件和错误路径逐项拒绝，其他有效文件与已选附件保留", () => {
  const before = addComposerFiles([], [file("existing.md")]).attachments;
  const result = addComposerFiles(before, [file("large.zip", COMPOSER_FILE_MAX_BYTES + 1), file("evil.txt", 1, "../evil.txt"), file("absolute.txt", 1, "/absolute.txt"), file("fine.txt")]);
  assert.equal(result.attachments.length, 2);
  assert.equal(result.attachments[0], before[0]);
  assert.equal(result.attachments[1].name, "fine.txt");
  assert.deepEqual(result.errors, [
    "「large.zip」超过 10 MB。",
    "文件路径无效，请重新选择。",
  ]);
});

test("文件数量和总容量边界可接受，超出不丢弃之前选择且移除后可以再选", () => {
  const full = addComposerFiles([], Array.from({ length: COMPOSER_FILE_LIMIT }, (_, index) => file(`file-${index}.txt`))).attachments;
  const extra = addComposerFiles(full, [file("extra.txt")]);
  assert.equal(extra.attachments.length, COMPOSER_FILE_LIMIT);
  assert.match(extra.errors[0], /最多添加/);
  const retried = addComposerFiles(full.slice(1), [file("extra.txt")]);
  assert.equal(retried.errors.length, 0);
  const total = addComposerFiles([], [file("one", COMPOSER_FILE_MAX_BYTES), file("two", COMPOSER_FILE_MAX_BYTES), file("three", COMPOSER_TOTAL_MAX_BYTES - 2 * COMPOSER_FILE_MAX_BYTES)]);
  assert.equal(total.attachments.length, 3);
  assert.equal(total.errors.length, 0);
  const over = addComposerFiles(total.attachments, [file("one-byte", 1)]);
  assert.equal(over.attachments.length, 3);
  assert.match(over.errors[0], /25 MB/);
  assert.equal(addComposerFiles([], [file("empty.txt", 0)]).errors.length, 0);
});

test("目标保存规范空白，空值可清除，超长拒绝且不修改原草稿", () => {
  const draft = createComposerDraft();
  draft.goal = "原目标";
  assert.deepEqual(validateComposerGoal("  学会微积分  "), { goal: "学会微积分", error: undefined });
  assert.deepEqual(validateComposerGoal(" \n "), { goal: "", error: undefined });
  assert.equal(validateComposerGoal("字".repeat(1000)).error, undefined);
  const invalid = validateComposerGoal("字".repeat(1001));
  assert.equal(invalid.goal, undefined);
  assert.match(invalid.error, /1000/);
  assert.equal(draft.goal, "原目标");
});

test("附件未接执行服务时阻止静默丢弃，移除后恢复文字发送，文件内容不混进提示词", () => {
  const draft = createComposerDraft();
  draft.attachments = addComposerFiles([], [file("private.txt")]).attachments;
  assert.match(composerDraftBlockReason(draft), /附件发送尚未接入/);
  assert.equal(buildComposerText("我的问题", draft), "我的问题");
  assert.equal(draft.attachments.length, 1);
  draft.attachments = [];
  assert.equal(composerDraftBlockReason(draft), undefined);
});

test("目标和计划只构成当前消息意图，不执行工具也不改用户原文", () => {
  const draft = createComposerDraft();
  assert.equal(buildComposerText("  用户输入\n第二行  ", draft), "用户输入\n第二行");
  draft.goal = "梳理高数课程";
  draft.planning = true;
  const text = buildComposerText("请使用中文", draft);
  assert.ok(text.startsWith("请使用中文"));
  assert.match(text, /本次目标：梳理高数课程/);
  assert.match(text, /先给出分步计划.*暂不执行操作/);
  assert.equal(draft.goal, "梳理高数课程");
  assert.equal(draft.planning, true);
  assert.equal(validateComposerGoal("x".repeat(1001)).error !== undefined, true);
});

test("输出形式未接入时保留原消息草稿并阻止发送", () => {
  const draft = createComposerDraft();
  assert.equal(buildComposerText("", draft), "");
  for (const artifact of composerArtifacts) {
    draft.artifact = artifact.id;
    assert.match(composerDraftBlockReason(draft), /文件生成尚未接入/);
    assert.equal(buildComposerText("原始问题", draft), "原始问题");
  }
});

test("常规设置的默认模式只作用于工作台新草稿；联系人仍从聊天开始，不允许的模式回退到 Auto", () => {
  assert.equal(createComposerDraft("workspace").mode, "auto");
  assert.equal(createComposerDraft("workspace", "chat").mode, "chat");
  assert.equal(createComposerDraft("workspace", "study").mode, "study");
  assert.equal(createComposerDraft("workspace", "agent").mode, "agent");
  assert.equal(createComposerDraft("workspace", "professional").mode, "auto");
  assert.equal(createComposerDraft("workspace", "bogus").mode, "auto");
  assert.equal(createComposerDraft("custom", "agent").mode, "chat");
  assert.equal(createComposerDraft("official", "study").mode, "chat");
});
