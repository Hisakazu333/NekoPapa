import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-appearance-themes-"));
let themes;
let preferences;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./appearance-themes-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  themes = await import(pathToFileURL(join(output, "appearance/appearance-themes.js")));
  preferences = await import(pathToFileURL(join(output, "appearance/appearance-preferences.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const root = () => {
  const props = new Map();
  return { props, dataset: {}, style: { setProperty: (name, value) => props.set(name, value), removeProperty: (name) => props.delete(name) } };
};

test("默认主题不改中性色阶；预设按当前模式取背景、前景与强调色", () => {
  assert.equal(themes.resolveThemeColors({ theme: "default" }, "dark"), undefined);
  assert.deepEqual(themes.resolveThemeColors({ theme: "nord" }, "dark"), { background: "#2e3440", foreground: "#eceff4", accent: "#88c0d0" });
  assert.deepEqual(themes.resolveThemeColors({ theme: "nord" }, "light"), { background: "#eceff4", foreground: "#2e3440", accent: "#5e81ac" });
  // Dracula has no light variant: light mode keeps the default ramp.
  assert.equal(themes.resolveThemeColors({ theme: "dracula" }, "light"), undefined);
  assert.equal(themes.normalizeThemeId("unknown"), "default");
});

test("自定义颜色按模式覆盖预设，不完整或无效的 HEX 视为跟随主题", () => {
  assert.deepEqual(themes.resolveThemeColors({ theme: "dracula", backgroundDark: "#101010" }, "dark"),
    { background: "#101010", foreground: "#f8f8f2", accent: "#bd93f9" });
  assert.deepEqual(themes.resolveThemeColors({ theme: "default", backgroundLight: "#FFFFFF", foregroundLight: "#222222" }, "light"),
    { background: "#ffffff", foreground: "#222222", accent: "" });
  assert.equal(themes.resolveThemeColors({ theme: "default", backgroundLight: "#fff", foregroundLight: "#222222" }, "light"), undefined);
  assert.equal(themes.resolveThemeColors({ theme: "default", backgroundDark: "#000000" }, "dark"), undefined);
  assert.equal(themes.normalizeThemeColor("#12"), "");
});

test("色阶从较亮一端排到较暗一端：深色主题的前景是 50，背景是 950", () => {
  const ramp = Object.fromEntries(themes.neutralRamp({ background: "#282a36", foreground: "#f8f8f2" }));
  assert.equal(ramp["--color-neutral-50"], "#f8f8f2");
  assert.equal(ramp["--color-neutral-950"], "#282a36");
  assert.equal(ramp["--color-neutral-800"], "color-mix(in oklab, #282a36 85%, #f8f8f2)");
  const light = Object.fromEntries(themes.neutralRamp({ background: "#fbf1c7", foreground: "#3c3836" }));
  assert.equal(light["--color-neutral-50"], "#fbf1c7");
  assert.equal(light["--color-neutral-950"], "#3c3836");
  assert.equal(Object.keys(ramp).length, themes.NEUTRAL_STEPS.length);
});

test("应用与清除色阶只改中性色变量，并标记当前主题", () => {
  const target = root();
  themes.applyThemeColors(target, themes.resolveThemeColors({ theme: "gruvbox" }, "dark"), "gruvbox");
  assert.equal(target.dataset.colorTheme, "gruvbox");
  assert.equal(target.props.size, themes.NEUTRAL_STEPS.length);
  assert.ok([...target.props.keys()].every((name) => name.startsWith("--color-neutral-")));
  themes.applyThemeColors(target, undefined, "default");
  assert.equal(target.props.size, 0);
  assert.equal(target.dataset.colorTheme, undefined);
});

test("强调色“跟随主题”使用主题强调色，默认主题回到 NekoPapa 粉色", () => {
  const target = root();
  assert.equal(preferences.applyAppearanceAccent(target, "theme", "#88c0d0"), "#88c0d0");
  assert.equal(target.dataset.accent, "custom");
  assert.equal(preferences.applyAppearanceAccent(target, "theme", ""), "pink");
  assert.equal(target.dataset.accent, "pink");
  assert.equal(preferences.normalizeAppearanceAccent("theme"), "theme");
});

test("所有预设的正文对比度至少 4.5:1", () => {
  for (const theme of themes.APPEARANCE_THEMES) for (const mode of ["light", "dark"]) {
    const colors = theme[mode];
    if (colors) assert.ok(themes.contrastRatio(colors.background, colors.foreground) >= 4.5, `${theme.id} ${mode}`);
  }
});

test("预设编号不重复；浅色版本的背景浅于前景，深色版本相反", () => {
  const ids = new Set();
  for (const theme of themes.APPEARANCE_THEMES) {
    assert.ok(!ids.has(theme.id), theme.id);
    ids.add(theme.id);
    for (const mode of ["light", "dark"]) {
      const colors = theme[mode];
      if (!colors) continue;
      const lighter = themes.luminance(colors.background) >= themes.luminance(colors.foreground);
      assert.equal(lighter, mode === "light", `${theme.id} ${mode} 背景应${mode === "light" ? "浅" : "深"}于前景`);
    }
  }
});

test("浅色主题用主题背景替换主表面的白色，深色主题与默认主题不替换", () => {
  const target = root();
  themes.applyThemeColors(target, themes.resolveThemeColors({ theme: "rose-pine" }, "light"), "rose-pine");
  assert.equal(target.props.get("--color-white"), "#faf4ed");
  themes.applyThemeColors(target, themes.resolveThemeColors({ theme: "rose-pine" }, "dark"), "rose-pine");
  assert.equal(target.props.has("--color-white"), false);
  themes.applyThemeColors(target, themes.resolveThemeColors({ theme: "rose-pine" }, "light"), "rose-pine");
  themes.applyThemeColors(target, undefined, "default");
  assert.equal(target.props.size, 0);
});
