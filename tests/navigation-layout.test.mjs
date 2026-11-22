import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-navigation-layout-"));
let normalizeNavigationLayout;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./navigation-layout-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  ({ normalizeNavigationLayout } = await import(pathToFileURL(join(output, "navigation/navigation-layout.js"))));
} finally {
  rmSync(output, { recursive: true, force: true });
}

test("导航布局只接受侧栏或底部悬浮栏，其余回到侧栏", () => {
  assert.equal(normalizeNavigationLayout("dock"), "dock");
  assert.equal(normalizeNavigationLayout("sidebar"), "sidebar");
  assert.equal(normalizeNavigationLayout(undefined), "sidebar");
  assert.equal(normalizeNavigationLayout("bottom"), "sidebar");
});
