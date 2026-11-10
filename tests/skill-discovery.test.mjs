import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-skill-discovery-"));
let api;
let discovery;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--project", fileURLToPath(new URL("./skill-discovery-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  api = await import(pathToFileURL(join(output, "scripts/skill-discovery-api.js")));
  discovery = await import(pathToFileURL(join(output, "src/app/skill-discovery.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

test("从 SKILL.md 的 front matter 读取名称与说明，支持引号和折叠块", () => {
  assert.deepEqual(discovery.parseSkillManifest("---\nname: \"review\"\ndescription: 审查代码改动\n---\n# Body"), { name: "review", description: "审查代码改动" });
  assert.deepEqual(discovery.parseSkillManifest("---\nname: pdf\ndescription: >\n  Read and\n  fill PDFs.\nlicense: MIT\n---"), { name: "pdf", description: "Read and fill PDFs." });
  assert.deepEqual(discovery.parseSkillManifest("# No front matter\nname: x"), {});
});

test("没有名称时用文件夹名；已保存的目录（含 ~ 写法）标为已添加", () => {
  const scan = discovery.readSkillScan({ home: "/Users/me", truncated: false, skills: [
    { source: "claude", dir: "/Users/me/.claude/skills/review", manifest: "---\ndescription: d\n---" },
    { source: "nope", dir: "/x", manifest: "" },
  ] });
  const found = discovery.foundSkills(scan);
  assert.deepEqual(found, [{ source: "claude", dir: "/Users/me/.claude/skills/review", name: "review", description: "d" }]);
  const saved = discovery.savedSkillDirs(["~/.claude/skills/review/", "/elsewhere"], "/Users/me");
  assert.ok(saved.has(found[0].dir));
  assert.equal(discovery.displaySkillPath(found[0].dir, "/Users/me"), "~/.claude/skills/review");
  assert.throws(() => discovery.readSkillScan(null));
});

test("开发服务器扫描只列出带 SKILL.md 的直接子文件夹，并只读开头 4 KB", async () => {
  const home = mkdtempSync(join(tmpdir(), "nekopapa-skill-home-"));
  try {
    mkdirSync(join(home, ".claude/skills/review"), { recursive: true });
    writeFileSync(join(home, ".claude/skills/review/SKILL.md"), "---\nname: review\n---\n");
    mkdirSync(join(home, ".claude/skills/empty"), { recursive: true });
    writeFileSync(join(home, ".claude/skills/README.md"), "not a skill");
    mkdirSync(join(home, ".agents/skills/deploy"), { recursive: true });
    writeFileSync(join(home, ".agents/skills/deploy/SKILL.md"), "x".repeat(10000));
    const scan = await api.scanSkills(home);
    assert.deepEqual(scan.skills.map((skill) => [skill.source, skill.dir.slice(home.length)]), [["claude", "/.claude/skills/review"], ["agents", "/.agents/skills/deploy"]]);
    assert.equal(scan.skills[1].manifest.length, 4096);
    assert.equal(scan.truncated, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
