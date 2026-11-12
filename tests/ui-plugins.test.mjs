import test from "node:test";
import assert from "node:assert/strict";
import { manifest } from "./ui-plugins-fixture.mjs";
import { compilePluginModules, memoryStorage as memory } from "./ui-plugins-compile.mjs";

// Interface plugin manifests, the stored plugin list and what enabled plugins add (docs/plugin-slots.md, stage 2).
const { check, records, contributions } = await compilePluginModules();

const ok = (value) => {
  const result = check.checkPluginManifest(JSON.stringify(value));
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"));
  return result;
};
const errors = (value) => {
  const result = check.checkPluginManifest(typeof value === "string" ? value : JSON.stringify(value));
  assert.equal(result.ok, false);
  return result.errors.join("\n");
};

test("a valid manifest becomes contribution ids under the plugin and open-view targets get the full id", () => {
  const { manifest: checked, warnings } = ok(manifest());
  assert.equal(checked.id, "acme.git-notes");
  assert.deepEqual(checked.views.map((view) => view.id), ["acme.git-notes/notes"]);
  assert.deepEqual(checked.views[0].requires, ["runtime.coding"]);
  assert.deepEqual(checked.commands.map((command) => command.action), [{ openView: "acme.git-notes/notes" }, { openUrl: "https://example.com/docs" }]);
  assert.deepEqual(warnings, []);
});

test("identity, version and engine problems are all listed", () => {
  const text = errors(manifest({ manifestVersion: 2, id: "Acme", name: "", version: "1", engines: { nekopapa: "^0.1.0" } }));
  for (const part of ["manifestVersion", "id 只能", "name 必填", "semver", ">=x.y.z"]) assert.match(text, new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(errors(manifest({ id: "nekopapa.extra" })), /留给 NekoPapa/);
  assert.match(errors(manifest({ engines: { nekopapa: ">=9.0.0" } })), /需要 NekoPapa >=9\.0\.0/);
  assert.equal(check.engineAccepts(">=0.1.0", "0.1.0"), true);
  assert.equal(check.engineAccepts(">=0.0.9", "0.1.0"), true);
  assert.equal(check.engineAccepts(">=0.2.0", "0.1.0"), false);
  assert.match(errors("{nope"), /不是有效的 JSON/);
  assert.match(errors("[]"), /顶层必须是对象/);
});

test("permissions: open ones are kept, later ones warn, refused and unknown ones (prototype names too) fail", () => {
  const later = ok(manifest({ permissions: ["link.open", "chat.read"] }));
  assert.match(later.warnings.join(), /chat\.read.*暂未开放/);
  assert.deepEqual(check.grantablePermissions(later.manifest), ["link.open"]);
  assert.match(errors(manifest({ permissions: ["shell"] })), /不开放权限“shell”/);
  for (const name of ["files.write", "constructor", "toString"]) assert.match(errors(manifest({ permissions: [name] })), /未知权限/);
  assert.match(errors(manifest({ requires: ["constructor"] })), /未知条件/);
  assert.match(errors(manifest({ permissions: [] })), /link\.open/);
});

test("slots: later stages warn and are not applied, unknown slots and unsupported content fail", () => {
  const later = ok(manifest({ contributes: { ...manifest().contributes, "sidebar.destination": [{ id: "main" }], "conversation.view": [] } }));
  assert.equal(later.warnings.length, 2);
  assert.match(later.warnings.join(), /sidebar\.destination.*暂不支持/);
  assert.match(errors(manifest({ contributes: { "sidebar.everything": [] } })), /未知扩展位/);
  assert.match(errors(manifest({ contributes: { constructor: [] } })), /未知扩展位/);
  assert.match(errors(manifest({ contributes: { "workPanel.view": [{ id: "x", title: "X", content: { kind: "frame", src: "index.html" } }] } })), /沙箱视图/);
  assert.match(errors(manifest({ contributes: { "settings.section": [] } })), /没有当前可用的贡献/);
});

test("entries: ids, titles, icons, actions and cross references are checked", () => {
  const view = manifest().contributes["workPanel.view"][0];
  assert.match(errors(manifest({ contributes: { "workPanel.view": [view, { ...view }] } })), /重复/);
  assert.match(errors(manifest({ contributes: { "workPanel.view": [{ ...view, id: "Bad Id" }] } })), /只能包含小写字母、数字和“-”/);
  assert.match(errors(manifest({ contributes: { "workPanel.view": [{ ...view, title: "很长的标题".repeat(5) }] } })), /title 必填，最多 16/);
  assert.match(errors(manifest({ contributes: { "workPanel.view": [{ ...view, icon: "skull" }] } })), /不是可用的图标名/);
  assert.match(errors(manifest({ contributes: { "workPanel.view": [view, { ...view, id: "b" }, { ...view, id: "c" }, { ...view, id: "d" }] } })), /最多 3 个/);
  const command = (action) => manifest({ contributes: { "workPanel.view": [view], "command.palette": [{ id: "go", title: "Go", action }] } });
  assert.match(errors(command({ openView: "missing" })), /没有在 workPanel\.view 中声明/);
  assert.match(errors(command({ openUrl: "http://example.com" })), /只接受 https/);
  assert.match(errors(command({ openUrl: "javascript:alert(1)" })), /只接受 https/);
  assert.match(errors(command({ openSettings: "main" })), /设置页“main”没有在 settings\.section 中声明/);
  assert.match(errors(command({ openView: "notes", openUrl: "https://example.com" })), /恰好包含/);
  assert.match(errors(manifest({ permissions: [], contributes: { "command.palette": [{ id: "d", title: "D", action: { openUrl: "https://example.com" } }] } })), /link\.open/);
});

test("added plugins are stored, read back through the same check and can be toggled and removed", () => {
  const storage = memory();
  const { manifest: checked } = ok(manifest({ permissions: ["link.open", "chat.read"] }));
  let list = records.addPlugin([], "/plugins/notes", checked);
  assert.deepEqual(list[0].granted, ["link.open"]);
  assert.equal(records.writePluginRecords(storage, list), true);
  assert.deepEqual(records.readPluginRecords(storage), { records: list, status: "ok" });
  list = records.setPluginEnabled(list, checked.id, false);
  assert.equal(list[0].enabled, false);
  assert.deepEqual(records.removePlugin(list, checked.id), []);
  const replaced = records.addPlugin(list, "/plugins/notes-2", checked);
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].folder, "/plugins/notes-2");
});

test("unreadable or tampered records are backed up and the list starts empty", () => {
  const { manifest: checked } = ok(manifest());
  const good = { plugins: records.addPlugin([], "/p", checked) };
  const cases = ["{bad", JSON.stringify({ plugins: "x" }), JSON.stringify({ plugins: [{ ...good.plugins[0], id: "other.id" }] }),
    JSON.stringify({ plugins: [{ ...good.plugins[0], manifest: { ...checked, views: [{ ...checked.views[0], content: { kind: "frame" } }] } }] }),
    JSON.stringify({ plugins: [good.plugins[0], good.plugins[0]] })];
  for (const text of cases) {
    const storage = memory({ [records.PLUGIN_RECORDS_KEY]: text });
    assert.deepEqual(records.readPluginRecords(storage), { records: [], status: "corrupt" }, text);
    assert.equal(storage.data.get(records.PLUGIN_RECORDS_BACKUP_KEY), text);
  }
  assert.deepEqual(records.readPluginRecords(memory()), { records: [], status: "empty" });
  const failing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
  assert.deepEqual(records.readPluginRecords(failing), { records: [], status: "unavailable" });
  assert.equal(records.writePluginRecords(failing, []), false);
});

test("reading the folder again: problems turn the plugin off with a reason, a fix turns it back on, a user's choice stays", () => {
  const { manifest: checked } = ok(manifest());
  const list = records.addPlugin([], "/p", checked);
  const missing = records.refreshPlugin(list, checked.id, { error: "文件夹里没有 nekopapa-plugin.json。" });
  assert.equal(missing[0].enabled, false);
  assert.match(missing[0].problem, /读取清单失败/);
  const broken = records.refreshPlugin(list, checked.id, { check: check.checkPluginManifest("{") });
  assert.match(broken[0].problem, /清单有问题/);
  const renamed = records.refreshPlugin(list, checked.id, { check: check.checkPluginManifest(JSON.stringify(manifest({ id: "acme.other" }))) });
  assert.match(renamed[0].problem, /id 变成了/);
  const fixed = records.refreshPlugin(missing, checked.id, { check: check.checkPluginManifest(JSON.stringify(manifest({ version: "0.2.0" }))) });
  assert.equal(fixed[0].enabled, true);
  assert.equal(fixed[0].problem, undefined);
  assert.equal(fixed[0].manifest.version, "0.2.0");
  const userOff = records.setPluginEnabled(list, checked.id, false);
  assert.deepEqual(records.refreshPlugin(userOff, checked.id, { error: "gone" }), userOff);
  const stillOff = records.refreshPlugin(userOff, checked.id, { check: check.checkPluginManifest(JSON.stringify(manifest())) });
  assert.equal(stillOff[0].enabled, false);
  // New permissions need the user to confirm again.
  const narrow = records.addPlugin([], "/p", ok(manifest({ permissions: [], contributes: { "workPanel.view": manifest().contributes["workPanel.view"] } })).manifest);
  const wider = records.refreshPlugin(narrow, checked.id, { check: check.checkPluginManifest(JSON.stringify(manifest())) });
  assert.equal(wider[0].enabled, false);
  assert.match(wider[0].problem, /新的权限：link\.open/);
  assert.deepEqual(wider[0].manifest, narrow[0].manifest);
});

test("only enabled plugins contribute, and URL commands need the granted permission", () => {
  const { manifest: checked } = ok(manifest());
  const list = records.addPlugin([], "/p", checked);
  const { views, commands } = contributions.pluginContributions(list);
  assert.deepEqual(views.map((view) => [view.id, view.view, view.label, view.status]), [["acme.git-notes/notes", "acme.git-notes/notes", "笔记", "需要 Coding 执行层。"]]);
  assert.deepEqual(views[0].plugin, { pluginId: "acme.git-notes", pluginName: "Git 笔记", icon: "notebook-pen", requires: ["runtime.coding"] });
  assert.deepEqual(commands.map((command) => command.id), ["acme.git-notes/open-notes", "acme.git-notes/docs"]);
  assert.deepEqual(contributions.pluginContributions(records.setPluginEnabled(list, checked.id, false)), { views: [], commands: [], settings: [] });
  const ungranted = [{ ...list[0], granted: [] }];
  assert.deepEqual(contributions.pluginContributions(ungranted).commands.map((command) => command.id), ["acme.git-notes/open-notes"]);
});
