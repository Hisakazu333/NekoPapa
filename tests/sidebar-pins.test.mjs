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
  pins = await import(pathToFileURL(join(output, "sidebar-pins.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; } };
};

test("“更多”只提供知识库和项目，默认都不固定；固定与取消固定在重载后保持并按面板顺序排列", () => {
  assert.deepEqual([...pins.sidebarDestinations], ["knowledge", "projects"]);
  const storage = memory();
  assert.deepEqual(pins.readSidebarPins(storage), []);
  let next = pins.toggleSidebarPin([], "projects");
  next = pins.toggleSidebarPin(next, "knowledge");
  assert.deepEqual(next, ["knowledge", "projects"]);
  assert.equal(pins.saveSidebarPins(storage, next), true);
  assert.deepEqual(pins.readSidebarPins(storage), ["knowledge", "projects"]);
  next = pins.toggleSidebarPin(next, "knowledge");
  pins.saveSidebarPins(storage, next);
  assert.deepEqual(pins.readSidebarPins(storage), ["projects"]);
});

test("取消全部固定后保持为空", () => {
  const storage = memory();
  pins.saveSidebarPins(storage, ["projects"]);
  pins.saveSidebarPins(storage, []);
  assert.deepEqual(pins.readSidebarPins(storage), []);
});

test("损坏或未知数据回退默认值并丢弃未知目标（含早期的 learning / skills），写入失败返回 false", () => {
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: "{oops" })), []);
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: '{"pins":"projects"}' })), []);
  assert.deepEqual(pins.readSidebarPins(memory({ [pins.SIDEBAR_PINS_KEY]: '{"pins":["projects","learning","skills","knowledge"]}' })), ["knowledge", "projects"]);
  assert.deepEqual(pins.readSidebarPins({ getItem: () => { throw new Error("blocked"); } }), []);
  assert.equal(pins.saveSidebarPins({ setItem: () => { throw new Error("quota"); } }, ["projects"]), false);
});
