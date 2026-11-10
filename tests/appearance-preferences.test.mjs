import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-appearance-preferences-"));
let appearance;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./appearance-preferences-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  appearance = await import(pathToFileURL(join(output, "appearance-preferences.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

test("normalizes supported appearance values and falls back to safe defaults", () => {
  assert.deepEqual(appearance.APPEARANCE_MODES, ["system", "light", "dark"]);
  assert.deepEqual(appearance.APPEARANCE_ACCENTS.map(({ id }) => id), ["pink", "green", "blue", "purple", "orange"]);
  assert.equal(appearance.normalizeAppearanceMode("dark"), "dark");
  assert.equal(appearance.normalizeAppearanceMode("unknown"), "system");
  assert.equal(appearance.normalizeAppearanceAccent("purple"), "purple");
  assert.equal(appearance.normalizeAppearanceAccent("#AABBCC"), "#aabbcc");
  assert.equal(appearance.normalizeAppearanceAccent("#xyzxyz"), "pink");
  assert.equal(appearance.normalizeAppearanceAccent(null), "pink");
});

test("resolves explicit and system-following themes", () => {
  assert.equal(appearance.resolveAppearanceTheme("system", true), "dark");
  assert.equal(appearance.resolveAppearanceTheme("system", false), "light");
  assert.equal(appearance.resolveAppearanceTheme("light", true), "light");
  assert.equal(appearance.resolveAppearanceTheme("dark", false), "dark");
  assert.equal(appearance.resolveAppearanceTheme("invalid", true), "dark");
});

test("applies a validated accent to the document root without changing the input", () => {
  const values = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value), removeProperty: (key) => values.delete(key) } };
  const selected = { accent: "orange" };
  assert.equal(appearance.applyAppearanceAccent(root, selected.accent), "orange");
  assert.equal(root.dataset.accent, "orange");
  assert.deepEqual(selected, { accent: "orange" });
  appearance.applyAppearanceAccent(root, "unsupported");
  assert.equal(root.dataset.accent, "pink");
  appearance.applyAppearanceAccent(root, "green");
  assert.equal(root.dataset.accent, "green");
  assert.equal(values.has("--color-accent-500"), false);
});

test("custom HEX accents generate and clear the eleven BoardUI accent tokens", () => {
  const values = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value), removeProperty: (key) => values.delete(key) } };
  assert.equal(appearance.applyAppearanceAccent(root, "#5c7a62"), "#5c7a62");
  assert.equal(root.dataset.accent, "custom");
  for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    assert.match(values.get(`--color-accent-${shade}`), /color-mix\(in oklab/);
  }
  appearance.applyAppearanceAccent(root, "orange");
  assert.equal(values.has("--color-accent-500"), false);
});

test("every non-default accent has a complete static Tailwind token ramp", () => {
  const css = readFileSync(new URL("../src/styles/appearance-accent.css", import.meta.url), "utf8");
  for (const accent of ["blue", "purple", "orange"]) {
    assert.ok(css.includes(`:root[data-accent=\"${accent}\"]`));
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      assert.ok(css.includes(`--color-accent-${shade}: var(--color-${accent}-${shade});`));
    }
  }
});
