import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-dock-"));
let dock;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./dock-magnification-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  dock = await import(pathToFileURL(join(output, "dock-magnification.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

test("悬浮栏放大：指针正上方最大，越远越小，超出范围不放大", () => {
  assert.equal(dock.dockScale(0), dock.DOCK_MAX_SCALE);
  assert.equal(dock.dockScale(dock.DOCK_REACH), 1);
  assert.equal(dock.dockScale(500), 1);
  assert.equal(dock.dockScale(-30), dock.dockScale(30));
  const samples = [0, 20, 40, 60, 80, 100].map((distance) => dock.dockScale(distance));
  for (let index = 1; index < samples.length; index += 1) assert.ok(samples[index] < samples[index - 1]);
  assert.equal(dock.dockScale(Number.NaN), 1);
});

test("导航布局只接受侧栏或底部悬浮栏，其余回到侧栏", () => {
  assert.equal(dock.normalizeNavigationLayout("dock"), "dock");
  assert.equal(dock.normalizeNavigationLayout("sidebar"), "sidebar");
  assert.equal(dock.normalizeNavigationLayout(undefined), "sidebar");
  assert.equal(dock.normalizeNavigationLayout("bottom"), "sidebar");
});
