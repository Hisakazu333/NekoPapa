import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-sidebar-layout-"));
let layout;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./sidebar-layout-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  layout = await import(pathToFileURL(join(output, "sidebar-layout.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { fitSidebarWidth, sidebarMaximumWidth, sidebarResizeState } = layout;

test("主侧栏默认280像素，展开宽度限制在可用空间且至少保留主区600像素", () => {
  assert.equal(fitSidebarWidth(null, sidebarMaximumWidth(1440)), 280);
  for (const container of [1024, 1187, 1440, 1920]) {
    const maximum = sidebarMaximumWidth(container);
    assert.ok(maximum <= 360);
    assert.ok(container - maximum >= 600);
    assert.equal(fitSidebarWidth(10000, maximum), maximum);
    assert.equal(fitSidebarWidth(-10000, maximum), 220);
  }
});

test("向左拖过阈值收为60像素轨道，从轨道拖回阈值可展开", () => {
  assert.deepEqual(sidebarResizeState(139, 360), { collapsed: true, width: 60 });
  assert.deepEqual(sidebarResizeState(140, 360), { collapsed: false, width: 220 });
  assert.deepEqual(sidebarResizeState(320, 360), { collapsed: false, width: 320 });
});

test("窗口缩放只限制显示，不必丢掉用户展开宽度", () => {
  const preferred = 350;
  assert.equal(fitSidebarWidth(preferred, sidebarMaximumWidth(900)), 300);
  assert.equal(fitSidebarWidth(preferred, sidebarMaximumWidth(1440)), 350);
  assert.equal(fitSidebarWidth(Number.NaN, sidebarMaximumWidth(1440)), 280);
  assert.equal(sidebarMaximumWidth(0), 360);
});
