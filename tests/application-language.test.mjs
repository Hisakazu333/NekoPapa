import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-language-"));
let languageCopy;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./application-language-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), "{\"type\":\"module\"}");
  languageCopy = await import(pathToFileURL(join(output, "application-language-copy.js")));
} finally { rmSync(output, { recursive: true, force: true }); }

const { applicationLanguage, translateApplicationCopy } = languageCopy;

test("界面语言只接受中文和英文设置值，未知值回退简体中文", () => {
  assert.equal(applicationLanguage("en-US"), "en-US");
  assert.equal(applicationLanguage("zh-CN"), "zh-CN");
  for (const value of [undefined, null, "ja", "English", 4]) assert.equal(applicationLanguage(value), "zh-CN");
});

test("侧栏和设置导航支持双向切换，用户资料及聊天原文不被改写", () => {
  assert.equal(translateApplicationCopy("快速搜索", "en-US"), "Quick Search");
  assert.equal(translateApplicationCopy("Quick Search", "zh-CN"), "快速搜索");
  assert.equal(translateApplicationCopy("界面语言", "en-US"), "Interface language");
  assert.equal(translateApplicationCopy("切换界面语言", "en-US"), "Change interface language");
  assert.equal(translateApplicationCopy("切换界面语言", "zh-CN"), "切换界面语言");
  assert.equal(translateApplicationCopy("Settings sections", "zh-CN"), "设置分类");
  assert.equal(translateApplicationCopy("雪代凛音", "en-US"), "雪代凛音");
  assert.equal(translateApplicationCopy("先检查 TypeScript 编译输出", "en-US"), "先检查 TypeScript 编译输出");
});

test("常规设置不渲染语言选择，账号菜单偏好组提供界面语言选项", () => {
  const settingsPath = fileURLToPath(new URL("../src/components/application/settings/workspace-settings-info.tsx", import.meta.url));
  const accountMenuPath = fileURLToPath(new URL("../src/components/application/dashboard/dashboard-account-menu.tsx", import.meta.url));
  const settings = readFileSync(settingsPath, "utf8");
  const accountMenu = readFileSync(accountMenuPath, "utf8");
  const preferenceGroup = accountMenu.match(/<DropdownGroup\s+label="偏好"\s*>([\s\S]*?)<\/DropdownGroup>/)?.[1];

  assert.doesNotMatch(settings, /界面语言|简体中文|English/);
  assert.ok(preferenceGroup, "account menu has a Preferences group");
  assert.match(preferenceGroup, /<span>语言<\/span>/, "Preferences group labels the locale selector");
  assert.match(preferenceGroup, /<Select aria-label="界面语言" selectedKey=\{language\}/, "Preferences use the shared BoardUI Select");
  assert.match(preferenceGroup, /<SelectItem id="zh-CN" textValue="简体中文">[\s\S]*?flags\/cn\.svg[\s\S]*?简体中文[\s\S]*?<\/SelectItem>/, "Chinese option shows its flag asset");
  assert.match(preferenceGroup, /<SelectItem id="en-US" textValue="English">[\s\S]*?flags\/us\.svg[\s\S]*?English[\s\S]*?<\/SelectItem>/, "English option shows its flag asset");
});

test("设置数量的动态说明正确处理单复数", () => {
  assert.equal(translateApplicationCopy("已保存 1 份自定义 API 配置。", "en-US"), "1 custom API profile saved.");
  assert.equal(translateApplicationCopy("已保存 3 份自定义 API 配置。", "en-US"), "3 custom API profiles saved.");
  assert.equal(translateApplicationCopy("已保存 2 份设备配置。", "en-US"), "2 device profiles saved.");
});
