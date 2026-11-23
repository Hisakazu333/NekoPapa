import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-account-setup-"));
let rules, agreement, privacy;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./account-setup-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  const legal = (name) => {
    const path = join(output, `app/legal/${name}.js`);
    writeFileSync(path, readFileSync(path, "utf8").replace('"./legal-document"', '"./legal-document.js"'));
    return pathToFileURL(path);
  };
  rules = await import(pathToFileURL(join(output, "app/account/account-setup-rules.js")));
  agreement = (await import(legal("desktop-user-agreement"))).DESKTOP_USER_AGREEMENT;
  privacy = (await import(legal("desktop-privacy-policy"))).DESKTOP_PRIVACY_POLICY;
} finally { rmSync(output, { recursive: true, force: true }); }

test("昵称与账号服务一致：去掉首尾空白后 1–32 个字符，不含控制字符", () => {
  assert.equal(rules.nicknameProblem("  小猫  "), undefined);
  assert.equal(rules.nicknameProblem("猫".repeat(32)), undefined);
  assert.match(rules.nicknameProblem("   "), /请输入/);
  assert.match(rules.nicknameProblem("猫".repeat(33)), /32/);
  assert.match(rules.nicknameProblem("小\u0007猫"), /控制字符/);
});

test("密码 6–32 个字符且不超过 72 字节，并要求两次一致", () => {
  assert.equal(rules.passwordProblem("secret-1", "secret-1"), undefined);
  assert.match(rules.passwordProblem("short", "short"), /6–32/);
  assert.match(rules.passwordProblem("a".repeat(33), "a".repeat(33)), /6–32/);
  const wide = "长".repeat(25);
  assert.match(rules.passwordProblem(wide, wide), /过长/);
  assert.match(rules.passwordProblem("secret-1", "secret-2"), /不一致/);
});

test("桌面端协议与隐私政策是待审核草案，结构完整且不可被修改", () => {
  for (const [document, kind] of [[agreement, "user-agreement"], [privacy, "privacy-policy"]]) {
    assert.equal(document.kind, kind);
    assert.equal(document.published, false, "发布前需要法务审核");
    assert.ok(document.sections.length >= 8);
    const titles = document.sections.map((part) => part.title);
    assert.equal(new Set(titles).size, titles.length, "章节标题唯一，用作列表 key");
    for (const part of document.sections) {
      assert.ok(part.blocks.length > 0, part.title);
      assert.ok(part.blocks.every((block) => block.text.trim()), part.title);
      assert.equal(new Set(part.blocks.map((block) => block.text)).size, part.blocks.length, part.title);
    }
    assert.ok(Object.isFrozen(document) && Object.isFrozen(document.sections));
    assert.match(JSON.stringify(document), /suyaochuan@foxmail\.com/);
  }
  assert.match(JSON.stringify(privacy), /钥匙串/);
});
