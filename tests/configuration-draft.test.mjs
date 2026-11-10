import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-configuration-drafts-"));
let saveConfigurationDraft, ConfigurationStore, configurationDefaults;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./configuration-draft-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  for (const name of readdirSync(output).filter((name) => name.endsWith(".js"))) {
    const file = join(output, name);
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier}.js${quote}`));
  }
  ({ saveConfigurationDraft } = await import(pathToFileURL(join(output, "configuration-draft.js"))));
  ({ ConfigurationStore } = await import(pathToFileURL(join(output, "configuration-store.js"))));
  ({ configurationDefaults } = await import(pathToFileURL(join(output, "configuration-contract.js"))));
} finally { rmSync(output, { recursive: true, force: true }); }

const key = "nekopapa.settings.v1";
function memory(data = configurationDefaults()) {
  const entries = new Map([[key, JSON.stringify(data)]]);
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
}

test("所有通用分类可保存布尔和数值等原有字段，不改其他组与聊天存储", () => {
  const storage = memory();
  storage.entries.set("nekopapa:chat-threads:v1", "本机聊天原文");
  const store = new ConfigurationStore(storage);
  for (const group of Object.keys(store.data.groups).filter((group) => !["profile", "appearance"].includes(group))) {
    const base = store.data.groups[group];
    const result = saveConfigurationDraft(store, group, { ...base }, base);
    assert.equal(result.saved, true, group);
  }
  const before = store.data;
  const base = before.groups.worktrees;
  const result = saveConfigurationDraft(store, "worktrees", { ...base, cleanup: true, limit: "24" }, base);
  assert.equal(result.saved, true);
  assert.equal(store.data.groups.worktrees.cleanup, true);
  assert.equal(store.data.groups.worktrees.limit, 24);
  assert.equal(new ConfigurationStore(storage).data.groups.worktrees.limit, 24);
  for (const group of Object.keys(before.groups).filter((group) => group !== "worktrees")) assert.deepEqual(store.data.groups[group], before.groups[group]);
  assert.equal(storage.entries.get("nekopapa:chat-threads:v1"), "本机聊天原文");
});

test("空数值、越界、非整数、字符串布尔和无效枚举保留草稿且不写回", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  const before = storage.entries.get(key);
  for (const change of [{ limit: "" }, { limit: "101" }, { limit: "1.5" }, { cleanup: "false" }, { root: 123 }]) {
    const base = store.data.groups.worktrees;
    const result = saveConfigurationDraft(store, "worktrees", { ...base, ...change }, base);
    assert.equal(result.saved, false);
    assert.ok(Object.keys(result.errors).length);
    assert.equal(storage.entries.get(key), before);
  }
  const base = store.data.groups.review;
  assert.equal(saveConfigurationDraft(store, "review", { ...base, trigger: "unexpected" }, base).saved, false);
  assert.equal(storage.entries.get(key), before);
});

test("其他窗口编辑不同字段时合并用户草稿，未编辑字段沿用最新值", () => {
  const store = new ConfigurationStore(memory());
  const base = store.data.groups.coding;
  const external = store.data;
  external.groups.coding.instructions = "另一窗口的新指令";
  external.groups.coding.verifyChanges = false;
  assert.equal(store.reload(JSON.stringify(external)), true);
  const result = saveConfigurationDraft(store, "coding", { ...base, directory: "/project/current" }, base);
  assert.equal(result.saved, true);
  assert.equal(result.values.directory, "/project/current");
  assert.equal(result.values.instructions, "另一窗口的新指令");
  assert.equal(result.values.verifyChanges, false);
});

test("同一字段发生冲突时阻止保存，明确覆盖只替换用户编辑的字段", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  const base = store.data.groups.git;
  const external = store.data;
  external.groups.git.branchPrefix = "external/";
  external.groups.git.prInstructions = "保留另一窗口的说明";
  assert.equal(store.reload(JSON.stringify(external)), true);
  const before = storage.entries.get(key);
  const draft = { ...base, branchPrefix: "mine/" };
  const blocked = saveConfigurationDraft(store, "git", draft, base);
  assert.equal(blocked.saved, false);
  assert.deepEqual(blocked.conflicts, ["branchPrefix"]);
  assert.equal(storage.entries.get(key), before);
  assert.equal(store.data.groups.git.branchPrefix, "external/");
  const confirmed = saveConfigurationDraft(store, "git", draft, base, true);
  assert.equal(confirmed.saved, true);
  assert.equal(confirmed.values.branchPrefix, "mine/");
  assert.equal(confirmed.values.prInstructions, "保留另一窗口的说明");
});

test("格式等价的数值不会制造编辑冲突，同值的外部更新可直接保存", () => {
  const store = new ConfigurationStore(memory());
  const base = store.data.groups.worktrees;
  const external = store.data;
  external.groups.worktrees.limit = 20;
  external.groups.worktrees.cleanup = true;
  assert.equal(store.reload(JSON.stringify(external)), true);
  const result = saveConfigurationDraft(store, "worktrees", { ...base, limit: "15", cleanup: true }, base);
  assert.equal(result.saved, true);
  assert.equal(result.values.limit, 20);
  assert.equal(result.values.cleanup, true);
});

test("初始读取被阻止后先恢复原配置，恢复期间用户草稿不丢失", () => {
  const data = configurationDefaults();
  data.groups.coding.directory = "/existing/project";
  data.groups.coding.instructions = "需要保留的指令";
  const storage = memory(data);
  let blocked = true;
  const store = new ConfigurationStore({
    getItem: (name) => { if (blocked) throw new Error("blocked"); return storage.getItem(name); },
    setItem: storage.setItem,
  });
  const base = store.data.groups.coding;
  const draft = { ...base, executable: "/runtime/node" };
  assert.equal(saveConfigurationDraft(store, "coding", draft, base).saved, false);
  assert.deepEqual(JSON.parse(storage.entries.get(key)), data);
  blocked = false;
  const result = saveConfigurationDraft(store, "coding", draft, base);
  assert.equal(result.saved, true);
  assert.equal(result.values.directory, data.groups.coding.directory);
  assert.equal(result.values.instructions, data.groups.coding.instructions);
  assert.equal(result.values.executable, "/runtime/node");
});

test("写入失败不报告成功，重试提交保存内存配置与草稿", () => {
  const storage = memory();
  let fail = false;
  const store = new ConfigurationStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("full"); storage.setItem(name, value); } });
  const base = store.data.groups.worktrees;
  const draft = { ...base, limit: "33", cleanup: true };
  const before = storage.entries.get(key);
  fail = true;
  const rejected = saveConfigurationDraft(store, "worktrees", draft, base);
  assert.equal(rejected.saved, false);
  assert.ok(rejected.errors.form);
  assert.equal(store.data.groups.worktrees.limit, 33);
  assert.equal(storage.entries.get(key), before);
  fail = false;
  const retry = saveConfigurationDraft(store, "worktrees", draft, base);
  assert.equal(retry.saved, true);
  assert.equal(new ConfigurationStore(storage).data.groups.worktrees.limit, 33);
});

test("模型被删除后未编辑的旧引用不会复活，主动选择失效引用则显示校验错误", () => {
  const initial = configurationDefaults();
  initial.collections.models.push({ id: "saved-api", values: { name: "已保存模型", provider: "compatible", endpoint: "https://example.test", model: "saved-model", environment: "MODEL_API_KEY" } });
  initial.groups.coding.modelId = "saved-api";
  const store = new ConfigurationStore(memory(initial));
  const base = store.data.groups.coding;
  assert.equal(store.removeRecord("models", "saved-api"), true);
  const result = saveConfigurationDraft(store, "coding", { ...base, instructions: "新的编程偏好" }, base);
  assert.equal(result.saved, true);
  assert.equal(result.values.modelId, "");
  const current = store.data.groups.coding;
  const invalid = saveConfigurationDraft(store, "coding", { ...current, modelId: "saved-api" }, current);
  assert.equal(invalid.saved, false);
  assert.ok(invalid.errors.modelId);
  assert.equal(store.data.groups.coding.modelId, "");
});

test("自定义 HEX 强调色经外观草稿保存并重载，无效颜色返回字段错误且不写回", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  const base = store.data.groups.appearance;
  const saved = saveConfigurationDraft(store, "appearance", { ...base, accent: "#6A2CB8" }, base);
  assert.equal(saved.saved, true);
  assert.deepEqual(saved.errors, {});
  assert.equal(new ConfigurationStore(storage).data.groups.appearance.accent, "#6a2cb8");
  const before = storage.entries.get(key);
  for (const accent of ["#6a2cb", "teal", "#gggggg"]) {
    const current = store.data.groups.appearance;
    const result = saveConfigurationDraft(store, "appearance", { ...current, accent }, current);
    assert.equal(result.saved, false);
    assert.match(result.errors.accent, /HEX/);
    assert.equal(storage.entries.get(key), before);
  }
  const preset = saveConfigurationDraft(store, "appearance", { ...store.data.groups.appearance, accent: "blue" }, store.data.groups.appearance);
  assert.equal(preset.saved, true);
  assert.equal(store.data.groups.appearance.accent, "blue");
});
