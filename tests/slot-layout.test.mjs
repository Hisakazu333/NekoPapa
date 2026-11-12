import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The extension-slot registry and the user's layout of it (docs/plugin-slots.md, stage 1).
const output = mkdtempSync(join(tmpdir(), "nekopapa-slots-"));
let registry;
let layout;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./slot-layout-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const file = join(output, "app/plugins/slot-layout.js");
  writeFileSync(file, readFileSync(file, "utf8").replace('"./slot-registry"', '"./slot-registry.js"'));
  registry = await import(pathToFileURL(join(output, "app/plugins/slot-registry.js")));
  layout = await import(pathToFileURL(file));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const SLOT = "workPanel.view";
const ids = (entries) => entries.map((entry) => entry.id);
const core = (local) => `nekopapa.core/${local}`;
const memory = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, String(value)); } };
};
const failing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };

test("contribution ids are <plugin id>/<local id> and the built-in entries keep the panel's view ids", () => {
  for (const id of ["nekopapa.core/history", "acme-tools/open-code", "a.b-c/x1"]) assert.equal(registry.isContributionId(id), true, id);
  for (const id of ["history", "/history", "nekopapa.core/", "Nekopapa/x", "a/b/c", "a/b_c", "a b/c", 4, null, `a/${"x".repeat(200)}`]) {
    assert.equal(registry.isContributionId(id), false, String(id));
  }
  assert.throws(() => registry.contributionId("nekopapa.core", "Bad Id"));
  assert.deepEqual(registry.WORK_PANEL_VIEWS.map((entry) => entry.view), ["history", "code", "study", "outline"]);
  assert.deepEqual(registry.WORK_PANEL_VIEWS.filter((entry) => entry.required).map((entry) => entry.view), ["history", "outline"]);
  assert.ok(registry.WORK_PANEL_VIEWS.every((entry) => !entry.required || entry.requiredReason));
  const views = new Set(registry.WORK_PANEL_VIEWS.map((entry) => entry.view));
  assert.ok(registry.VIEW_COMMANDS.every((command) => views.has(command.opens) && registry.isContributionId(command.id)));
  assert.equal(new Set([...registry.WORK_PANEL_VIEWS, ...registry.VIEW_COMMANDS].map((entry) => entry.id)).size, 7);
});

test("with no saved layout every entry shows in the registry's order", () => {
  const { shown, hidden } = layout.arrangeSlot(registry.WORK_PANEL_VIEWS, undefined);
  assert.deepEqual(ids(shown), ids(registry.WORK_PANEL_VIEWS));
  assert.deepEqual(hidden, []);
});

test("hiding refuses required entries and showing puts an entry back in its place", () => {
  const [history, code, study] = registry.WORK_PANEL_VIEWS;
  const empty = {};
  assert.equal(layout.setSlotEntryHidden(empty, SLOT, history, true), empty);
  const hiddenCode = layout.setSlotEntryHidden(layout.setSlotEntryHidden({}, SLOT, code, true), SLOT, code, true);
  assert.deepEqual(hiddenCode[SLOT].hidden, [code.id]);
  const arranged = layout.arrangeSlot(registry.WORK_PANEL_VIEWS, hiddenCode[SLOT]);
  assert.deepEqual(ids(arranged.shown), [core("history"), core("study"), core("tools")]);
  assert.deepEqual(ids(arranged.hidden), [code.id]);
  const shownAgain = layout.setSlotEntryHidden(hiddenCode, SLOT, code, false);
  assert.deepEqual(ids(layout.arrangeSlot(registry.WORK_PANEL_VIEWS, shownAgain[SLOT]).shown), ids(registry.WORK_PANEL_VIEWS));
  // A stored layout that lists a required entry as hidden still shows it.
  const forced = layout.arrangeSlot(registry.WORK_PANEL_VIEWS, { order: [], hidden: [history.id, study.id] });
  assert.deepEqual(ids(forced.shown), [history.id, code.id, core("tools")]);
});

test("moving swaps neighbours among shown entries, stops at the ends and reset restores the default", () => {
  const entries = registry.WORK_PANEL_VIEWS;
  const moved = layout.moveSlotEntry({}, SLOT, entries, core("study"), -1);
  assert.deepEqual(ids(layout.arrangeSlot(entries, moved[SLOT]).shown), [core("history"), core("study"), core("code"), core("tools")]);
  assert.equal(layout.moveSlotEntry(moved, SLOT, entries, core("history"), -1), moved);
  assert.equal(layout.moveSlotEntry(moved, SLOT, entries, core("tools"), 1), moved);
  assert.equal(layout.moveSlotEntry(moved, SLOT, entries, "other.plugin/missing", 1), moved);
  // Hidden entries are skipped: with 资料 hidden, 代码 moves next to 工具.
  const hidden = layout.setSlotEntryHidden({}, SLOT, entries[2], true);
  const skip = layout.moveSlotEntry(hidden, SLOT, entries, core("code"), 1);
  assert.deepEqual(ids(layout.arrangeSlot(entries, skip[SLOT]).shown), [core("history"), core("tools"), core("code")]);
  assert.deepEqual(skip[SLOT].hidden, [core("study")]);
  const other = { "command.palette": { order: [core("open-code")], hidden: [] } };
  const reset = layout.resetSlot({ ...other, ...moved }, SLOT);
  assert.deepEqual(reset, other);
});

test("ids of entries that are not registered now are kept, so their place returns with them", () => {
  const entries = registry.WORK_PANEL_VIEWS;
  const saved = { [SLOT]: { order: ["acme.notes/board", core("code"), core("history")], hidden: ["acme.notes/old"] } };
  const arranged = layout.arrangeSlot(entries, saved[SLOT]);
  assert.deepEqual(ids(arranged.shown), [core("code"), core("history"), core("study"), core("tools")]);
  const moved = layout.moveSlotEntry(saved, SLOT, entries, core("tools"), -1);
  assert.deepEqual(moved[SLOT].order, ["acme.notes/board", core("code"), core("history"), core("tools"), core("study")]);
  assert.deepEqual(moved[SLOT].hidden, ["acme.notes/old"]);
  const withPlugin = [...entries, { id: "acme.notes/board", view: "study", label: "看板" }];
  assert.equal(ids(layout.arrangeSlot(withPlugin, moved[SLOT]).shown)[0], "acme.notes/board");
});

test("parsing accepts only well-formed layouts and drops duplicate ids", () => {
  const good = { [SLOT]: { order: [core("code"), core("code")], hidden: [] } };
  assert.deepEqual(layout.parseSlotLayout(JSON.stringify(good)), { [SLOT]: { order: [core("code")], hidden: [] } });
  assert.deepEqual(layout.parseSlotLayout("{}"), {});
  for (const text of ["", "{", "null", "[]", "3", '{"a":null}', '{"a":[]}', '{"a":{"order":[]}}', '{"a":{"order":["bad"],"hidden":[]}}', '{"a":{"order":[],"hidden":"x"}}']) {
    assert.equal(layout.parseSlotLayout(text), undefined, text);
  }
});

test("reading reports empty, ok, corrupt (with a backup of the old text) and unavailable storage", () => {
  assert.deepEqual(layout.readSlotLayout(memory()), { layout: {}, status: "empty" });
  const saved = { [SLOT]: { order: [core("study")], hidden: [core("code")] } };
  assert.deepEqual(layout.readSlotLayout(memory({ [layout.SLOT_LAYOUT_KEY]: JSON.stringify(saved) })), { layout: saved, status: "ok" });
  const broken = memory({ [layout.SLOT_LAYOUT_KEY]: "{not json" });
  assert.deepEqual(layout.readSlotLayout(broken), { layout: {}, status: "corrupt" });
  assert.equal(broken.data.get(layout.SLOT_LAYOUT_BACKUP_KEY), "{not json");
  assert.equal(broken.data.get(layout.SLOT_LAYOUT_KEY), "{not json");
  assert.deepEqual(layout.readSlotLayout(failing), { layout: {}, status: "unavailable" });
  assert.deepEqual(layout.readSlotLayout(undefined), { layout: {}, status: "unavailable" });
});

test("writing saves the layout under the stable key and reports a failed save", () => {
  const storage = memory();
  const saved = layout.setSlotEntryHidden({}, SLOT, registry.WORK_PANEL_VIEWS[1], true);
  assert.equal(layout.writeSlotLayout(storage, saved), true);
  assert.equal(layout.SLOT_LAYOUT_KEY, "nekopapa.slot-layout.v1");
  assert.deepEqual(layout.readSlotLayout(storage), { layout: saved, status: "ok" });
  assert.equal(layout.writeSlotLayout(failing, saved), false);
  assert.equal(layout.writeSlotLayout(undefined, saved), false);
});
