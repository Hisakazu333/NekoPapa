import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Compile the production helper with the project's existing TypeScript runtime.
const output = mkdtempSync(join(tmpdir(), "nekopapa-search-tests-"));
let compiled;
try {
  const config = join(output, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    extends: fileURLToPath(new URL("./tsconfig.json", import.meta.url)),
    compilerOptions: { types: [] },
    include: [fileURLToPath(new URL("../src/app/search.ts", import.meta.url))],
  }));
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", config, "--outDir", output]);
  compiled = readFileSync(join(output, "search.js"), "utf8");
} finally { rmSync(output, { recursive: true, force: true }); }
const { rankSearchEntries } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function entry(id, title, subtitle = "工作台", group = false) { return { id, title, subtitle, group }; }

test("an exact group remains reachable when more than 20 children match its name", () => {
  const children = Array.from({ length: 35 }, (_, index) => entry(`note-${index}`, `笔记 ${index}`, "工作与灵感"));
  const group = entry("ideas", "工作与灵感", "空间 · 定位分组", true);
  const entries = [...children, group];
  const result = rankSearchEntries(entries, "工作与灵感");
  assert.equal(result.length, 20);
  assert.equal(result[0], group);
  assert.deepEqual(entries, [...children, group]);
});

test("empty and whitespace-only queries retain original order", () => {
  const entries = [entry("note", "笔记"), entry("space", "空间", "分组", true), entry("chat", "对话")];
  assert.deepEqual(rankSearchEntries(entries, ""), entries);
  assert.deepEqual(rankSearchEntries(entries, "  \t  "), entries);
  assert.notEqual(rankSearchEntries(entries, ""), entries);
});

test("queries trim whitespace and match case-insensitively in titles and subtitles", () => {
  const entries = [entry("related", "Review", "NekoPapa"), entry("exact", "NEKOPAPA"), entry("prefix", "NekoPapa Notes"), entry("other", "Unrelated")];
  assert.deepEqual(rankSearchEntries(entries, "  nekopapa  ").map((entry) => entry.id), ["exact", "prefix", "related"]);
  assert.deepEqual(rankSearchEntries(entries, "missing"), []);
});

test("exact content titles outrank partial group titles and subtitle-only matches", () => {
  const entries = [entry("partial-group", "周末计划资料", "空间", true), entry("subtitle", "灵感", "周末计划"), entry("exact-content", "周末计划"), entry("partial-content", "我的周末计划")];
  assert.deepEqual(rankSearchEntries(entries, "周末计划").map((entry) => entry.id), ["exact-content", "partial-group", "partial-content", "subtitle"]);
});

test("groups win equal ranks while peers retain their input order", () => {
  const entries = [entry("note-a", "周末计划"), entry("group-a", "周末计划", "空间", true), entry("note-b", "周末计划"), entry("group-b", "周末计划", "项目", true)];
  assert.deepEqual(rankSearchEntries(entries, "周末计划").map((entry) => entry.id), ["group-a", "group-b", "note-a", "note-b"]);
});

test("result limits apply after ranking and never alter the source list", () => {
  const entries = [entry("partial", "计划资料"), entry("related", "笔记", "计划"), entry("exact", "计划")];
  assert.deepEqual(rankSearchEntries(entries, "计划", 1).map((entry) => entry.id), ["exact"]);
  assert.deepEqual(rankSearchEntries(entries, "计划", 0), []);
  assert.deepEqual(rankSearchEntries(entries, "计划", -1), []);
  assert.deepEqual(rankSearchEntries(entries, "", 2).map((entry) => entry.id), ["partial", "related"]);
  assert.deepEqual(entries.map((entry) => entry.id), ["partial", "related", "exact"]);
});
