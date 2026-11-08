import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-workspace-layout-"));
let layout;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./chat-workspace-layout-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  layout = await import(pathToFileURL(join(output, "chat-workspace-layout.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { fitPanelWidth, panelWidthLimits, workspaceUsesOverlay } = layout;

test("桌面分栏默认四成，拖动到边界仍保留主聊天360像素与面板280像素", () => {
  assert.equal(fitPanelWidth(1200, null), 480);
  for (const container of [660, 720, 900, 1200, 1800]) {
    const limits = panelWidthLimits(container);
    assert.equal(fitPanelWidth(container, -10000), 280);
    const largest = fitPanelWidth(container, 10000);
    assert.equal(largest, limits.max);
    assert.ok(container - largest - 20 >= 360);
  }
});

test("窄窗口与不足以容纳两栏的工作区切换为覆盖层，不挤压主聊天", () => {
  assert.equal(workspaceUsesOverlay(1200, 900), true);
  assert.equal(workspaceUsesOverlay(659, 1440), true);
  assert.equal(workspaceUsesOverlay(660, 1440), false);
  assert.equal(workspaceUsesOverlay(900, 901), false);
});

test("临时缩窄只限制呈现宽度，恢复空间后仍可使用原首选宽度", () => {
  const preferred = 600;
  assert.equal(fitPanelWidth(800, preferred), 420);
  assert.equal(fitPanelWidth(1400, preferred), 600);
  assert.equal(fitPanelWidth(1200, Number.NaN), 480);
});

test("联系人聊天与列表保留560像素，编辑区拖到最大也不会压扁两栏", () => {
  for (const container of [860, 900, 1000, 1400]) {
    const limits = panelWidthLimits(container, 560);
    const largest = fitPanelWidth(container, 10000, 560);
    assert.equal(largest, limits.max);
    assert.ok(container - largest - 20 >= 560);
    assert.equal(fitPanelWidth(container, -10000, 560), 280);
  }
  assert.equal(fitPanelWidth(1000, 600, 560), 420);
  assert.equal(fitPanelWidth(1400, 600, 560), 600);
});

test("联系人主区不足560加面板及分隔线时覆盖，工作台默认边界不变", () => {
  assert.equal(workspaceUsesOverlay(859, 1440, 560), true);
  assert.equal(workspaceUsesOverlay(860, 1440, 560), false);
  assert.equal(workspaceUsesOverlay(860, 900, 560), true);
  assert.equal(workspaceUsesOverlay(660, 1440), false);
  assert.equal(workspaceUsesOverlay(659, 1440), true);
  assert.equal(panelWidthLimits(1000).max, 620);
  assert.equal(panelWidthLimits(1000, 560).max, 420);
});
