import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-overlay-dismissal-"));
let overlayModule;
try {
  execFileSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project",
    fileURLToPath(new URL("./overlay-dismissal-tsconfig.json", import.meta.url)),
    "--outDir",
    output,
  ]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  overlayModule = await import(pathToFileURL(join(output, "utils/overlay-boundary.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const { isTargetWithinOverlay, registerOverlayRefs } = overlayModule;

function refContaining(target) {
  return { current: { contains: (candidate) => candidate === target } };
}

test("React 后代弹层的 portal 点击对所有祖先都算内部点击", () => {
  const parentDescendants = new Set();
  const childDescendants = new Set();
  const choiceTarget = {};
  const nestedPopoverRef = refContaining(choiceTarget);

  const unregisterNestedPopover = registerOverlayRefs(
    [nestedPopoverRef],
    [childDescendants, parentDescendants],
  );

  assert.equal(isTargetWithinOverlay(choiceTarget, [], childDescendants), true);
  assert.equal(isTargetWithinOverlay(choiceTarget, [], parentDescendants), true);

  unregisterNestedPopover();
  assert.equal(isTargetWithinOverlay(choiceTarget, [], childDescendants), false);
  assert.equal(isTargetWithinOverlay(choiceTarget, [], parentDescendants), false);
});

test("本层 trigger / popover 仍算内部，无关页面点击仍触发外部关闭", () => {
  const ownTarget = {};
  const unrelatedTarget = {};
  const ownRefs = [refContaining(ownTarget)];

  assert.equal(isTargetWithinOverlay(ownTarget, ownRefs, new Set()), true);
  assert.equal(isTargetWithinOverlay(unrelatedTarget, ownRefs, new Set()), false);
});
