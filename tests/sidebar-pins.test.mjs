import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-sidebar-pins-"));
let pins;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./sidebar-pins-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  pins = await import(pathToFileURL(join(output, "navigation/sidebar-pins.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; } };
};

test("“更多”只提供知识库，默认不固定；固定与取消固定在重载后保持", () => {
  assert.deepEqual([...pins.sidebarDestinations], ["space", "knowledge", "cabin"]);
  const storage = memory();
  assert.deepEqual(pins.readSidebarPins(storage), []);
  let next = pins.toggleSidebarPin([], "knowledge");
  assert.deepEqual(next, ["knowledge"]);
  assert.equal(pins.saveSidebarPins(storage, next), true);
  assert.deepEqual(pins.readSidebarPins(storage), ["knowledge"]);
  next = pins.toggleSidebarPin(next, "knowledge");
  pins.saveSidebarPins(storage, next);
  assert.deepEqual(pins.readSidebarPins(storage), []);
});

test("项目由侧栏“项目”分区承担：早期保存的 projects 固定在读取时丢弃，不再生成重复入口", () => {
  const storage = memory({ [pins.SIDEBAR_PINS_KEY]: '{"version":1,"pins":["knowledge","projects"]}' });
  assert.deepEqual(pins.readSidebarPins(storage), ["knowledge"]);
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: '{"version":1,"pins":["projects"]}' })), []);
  pins.saveSidebarPins(storage, pins.readSidebarPins(storage));
  assert.equal(JSON.parse(storage.data[pins.SIDEBAR_PINS_KEY]).pins.includes("projects"), false);
});

test("损坏或未知数据回退默认值并丢弃未知目标（含早期的 learning / skills / projects），写入失败返回 false", () => {
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: "{oops" })), []);
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: '{"pins":"knowledge"}' })), []);
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: '{"pins":["projects","learning","skills","knowledge"]}' })), ["knowledge"]);
  assert.deepEqual(pins.readSidebarPins({ getItem: () => { throw new Error("blocked"); } }), []);
  assert.equal(pins.saveSidebarPins({ setItem: () => { throw new Error("quota"); } }, ["knowledge"]), false);
});
