import test from "node:test";
import assert from "node:assert/strict";
import { manifest } from "./ui-plugins-fixture.mjs";
import { compilePluginModules, memoryStorage } from "./ui-plugins-compile.mjs";

// Interface plugin settings pages, the values kept for them and the URL commands that read them (docs/plugin-slots.md).
const { check, records, contributions, settings } = await compilePluginModules();

const section = (overrides = {}) => ({
  id: "general", title: "常规", icon: "wrench", description: "Git 笔记的仓库与显示方式。",
  fields: [
    { key: "repo", type: "string", label: "仓库", placeholder: "owner/name", maxLength: 100 },
    { key: "compact", type: "boolean", label: "紧凑显示", default: true },
    { key: "limit", type: "number", label: "条数", min: 1, max: 50, default: 10 },
    { key: "branch", type: "select", label: "分支", options: [{ value: "main", label: "main" }, { value: "dev", label: "dev" }] },
  ],
  ...overrides,
});
const withSettings = (sections = [section()], commands = []) => manifest({
  contributes: { ...manifest().contributes, "settings.section": sections, "command.palette": [...manifest().contributes["command.palette"], ...commands] },
});
const ok = (value) => {
  const result = check.checkPluginManifest(JSON.stringify(value));
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"));
  return result.manifest;
};
const errors = (value) => {
  const result = check.checkPluginManifest(JSON.stringify(value));
  assert.equal(result.ok, false);
  return result.errors.join("\n");
};

test("a settings page becomes a contribution under the plugin with typed fields and defaults", () => {
  const checked = ok(withSettings(undefined, [{ id: "prefs", title: "Git 笔记设置", action: { openSettings: "settings.section/general" } }]));
  assert.deepEqual(checked.settings.map((entry) => [entry.id, entry.title, entry.icon]), [["acme.git-notes/general", "常规", "wrench"]]);
  assert.deepEqual(checked.settings[0].fields.map((field) => [field.key, field.type, field.default]),
    [["repo", "string", ""], ["compact", "boolean", true], ["limit", "number", 10], ["branch", "select", "main"]]);
  assert.deepEqual(checked.commands.at(-1).action, { openSettings: "acme.git-notes/general" });
  const list = records.addPlugin([], "/p", checked);
  const { settings: pages, commands } = contributions.pluginContributions(list);
  assert.deepEqual(pages.map((page) => [page.id, page.label, page.plugin.pluginName]), [["acme.git-notes/general", "常规", "Git 笔记"]]);
  assert.deepEqual(commands.at(-1).action, { openSettings: "acme.git-notes/general" });
  assert.deepEqual(contributions.pluginContributions(records.setPluginEnabled(list, checked.id, false)).settings, []);
  // Stored with the record and read back through the same check; records from before settings pages still read.
  const storage = memoryStorage();
  records.writePluginRecords(storage, list);
  assert.deepEqual(records.readPluginRecords(storage).records, list);
  const older = ok(manifest());
  const { settings: _none, ...stage2 } = older;
  storage.setItem(records.PLUGIN_RECORDS_KEY, JSON.stringify({ plugins: [{ ...records.addPlugin([], "/p", older)[0], manifest: stage2 }] }));
  assert.deepEqual(records.readPluginRecords(storage).records[0].manifest.settings, []);
});

test("settings fields: bad keys, secrets, types, bounds and duplicates are all listed", () => {
  const field = (extra) => withSettings([section({ fields: [{ key: "x", type: "string", label: "X", ...extra }] })]);
  assert.match(errors(field({ key: "Bad-Key" })), /key 以小写字母开头/);
  for (const key of ["apiKey", "password", "githubToken", "clientSecret"]) assert.match(errors(field({ key })), /不保存这类内容/);
  assert.match(errors(field({ key: "x", label: "访问 Token" })), /不保存这类内容/);
  assert.match(errors(field({ type: "secret" })), /type 只能是/);
  assert.match(errors(field({ maxLength: 5000 })), /maxLength 是 1 到 1000/);
  assert.match(errors(field({ type: "number", min: 5, max: 1 })), /min 不能大于 max/);
  assert.match(errors(field({ type: "number", min: 1, max: 5, default: 9 })), /default 必须是 min 与 max 之间/);
  assert.match(errors(field({ type: "select", options: [{ value: "a", label: "A" }] })), /options 需要 2 到 20/);
  assert.match(errors(field({ type: "select", options: [{ value: "a", label: "A" }, { value: "a", label: "B" }] })), /value 重复/);
  assert.match(errors(field({ type: "boolean", default: "yes" })), /true 或 false/);
  assert.match(errors(withSettings([section({ fields: [] })])), /fields 必须是非空数组/);
  assert.match(errors(withSettings([section(), section({ id: "more" })])), /设置 key “repo” 重复了/);
  assert.match(errors(withSettings([section(), section({ id: "b" }), section({ id: "c" })])), /最多 2 个设置页/);
  assert.match(errors(withSettings([section({ id: "notes" })])), /贡献 id “notes” 重复了/);
});

test("URL commands may read settings only in the path, query or fragment of a fixed https site", () => {
  const url = (openUrl, extra = []) => withSettings(undefined, [{ id: "wiki", title: "打开 Wiki", action: { openUrl } }, ...extra]);
  const checked = ok(url("https://github.com/{settings.repo}/tree/{settings.branch}?n={settings.limit}"));
  assert.equal(checked.commands.at(-1).action.openUrl, "https://github.com/{settings.repo}/tree/{settings.branch}?n={settings.limit}");
  assert.match(errors(url("https://{settings.repo}.example.com/")), /主机部分不能使用设置值/);
  assert.match(errors(url("{settings.repo}")), /只接受 https/);
  assert.match(errors(url("https://example.com/{settings.missing}")), /没有声明的设置“missing”/);
  assert.match(errors(url("https://example.com/{settings.compact}")), /不能读取开关设置/);
  assert.match(errors(url("https://example.com/{repo}")), /占位符只能写成/);
  assert.match(errors(withSettings(undefined, [{ id: "go", title: "Go", action: { openSettings: "nope" } }])), /设置页“nope”没有在 settings\.section 中声明/);
  // Fields reach the command so the host can fill it.
  const command = contributions.pluginContributions(records.addPlugin([], "/p", checked)).commands.at(-1);
  assert.deepEqual(command.action.fields.map((field) => field.key), ["repo", "compact", "limit", "branch"]);
});

test("filling a URL: values are encoded but keep '/', an empty value names the field, the site never changes", () => {
  const fields = ok(withSettings()).settings[0].fields;
  const template = "https://github.com/{settings.repo}/tree/{settings.branch}?n={settings.limit}";
  assert.deepEqual(settings.fillUrlTemplate(template, fields, undefined), { missing: "仓库", key: "repo" });
  assert.deepEqual(settings.fillUrlTemplate(template, fields, { repo: "  " }), { missing: "仓库", key: "repo" });
  assert.deepEqual(settings.fillUrlTemplate(template, fields, { repo: "acme/notes", branch: "dev" }), { url: "https://github.com/acme/notes/tree/dev?n=10" });
  assert.deepEqual(settings.fillUrlTemplate(template, fields, { repo: "a b?c#d@e" }), { url: "https://github.com/a%20b%3Fc%23d%40e/tree/main?n=10" });
  const filled = settings.fillUrlTemplate(template, fields, { repo: "//evil.example/x" });
  assert.equal(new URL(filled.url).host, "github.com");
  // A stored value that no longer fits its field reads as the default.
  assert.deepEqual(settings.fillUrlTemplate(template, fields, { repo: "r", branch: "gone", limit: 99 }), { url: "https://github.com/r/tree/main?n=10" });
});

test("values are checked against their fields, stored per plugin and backed up when unreadable", () => {
  const [repo, compact, limit, branch] = ok(withSettings()).settings[0].fields;
  assert.equal(settings.settingProblem(repo, "x".repeat(101)), "最多 100 个字符。");
  assert.equal(settings.settingProblem(compact, "true"), "需要开或关。");
  assert.equal(settings.settingProblem(limit, 0), "不能小于 1。");
  assert.equal(settings.settingProblem(limit, Number.NaN), "需要数字。");
  assert.equal(settings.settingProblem(branch, "feature"), "不是可选的值。");
  assert.equal(settings.settingProblem(limit, 20), undefined);
  assert.equal(settings.settingValue(compact, { compact: false }), false);
  assert.equal(settings.settingValue(compact, { constructor: true }), true);
  const storage = memoryStorage();
  assert.equal(settings.writePluginSettings(storage, { "acme.git-notes": { repo: "acme/notes", limit: 20 } }), true);
  assert.deepEqual({ ...settings.readPluginSettings(storage).values["acme.git-notes"] }, { repo: "acme/notes", limit: 20 });
  assert.equal(settings.readPluginSettings(storage).status, "ok");
  for (const text of ["{bad", JSON.stringify({ plugins: [] }), JSON.stringify({ plugins: { a: { x: { nested: true } } } })]) {
    const broken = memoryStorage({ [settings.PLUGIN_SETTINGS_KEY]: text });
    assert.deepEqual(settings.readPluginSettings(broken), { values: {}, status: "corrupt" }, text);
    assert.equal(broken.data.get(settings.PLUGIN_SETTINGS_BACKUP_KEY), text);
  }
  assert.equal(settings.readPluginSettings(memoryStorage()).status, "empty");
  const failing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
  assert.equal(settings.readPluginSettings(failing).status, "unavailable");
  assert.equal(settings.writePluginSettings(failing, {}), false);
});
