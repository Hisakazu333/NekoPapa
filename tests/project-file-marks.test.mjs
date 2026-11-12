import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// What the 文件 tree and the diff views read from a path and from Git status:
// the highlight language, the icon kind, the two sides of a diff, and marks.
const output = mkdtempSync(join(tmpdir(), "nekopapa-file-marks-"));
let language, marks, workspace;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./project-file-marks-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  for (const name of readdirSync(output, { recursive: true })) {
    const file = join(output, String(name));
    if (!file.endsWith(".js")) continue;
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+|import\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (_, prefix, quote, specifier) => `${prefix}${quote}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`));
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  [language, marks, workspace] = await Promise.all([load("app/projects/file-language.js"), load("app/projects/git-marks.js"), load("app/projects/project-workspace.js")]);
} finally { rmSync(output, { recursive: true, force: true }); }

test("a path names its highlight language, case-insensitively, with plain text for unknown names", () => {
  assert.equal(language.languageForPath("src/app/main.ts"), "typescript");
  assert.equal(language.languageForPath("src/View.TSX"), "tsx");
  assert.equal(language.languageForPath("src-tauri/src/lib.rs"), "rust");
  assert.equal(language.languageForPath("Dockerfile"), "docker");
  assert.equal(language.languageForPath(".env.local"), "dotenv");
  assert.equal(language.languageForPath("LICENSE"), "");
  assert.equal(language.languageForPath("notes.unknownext"), "");
});

test("a path picks the tree icon kind, with lock files and dotfiles before their extension", () => {
  assert.equal(language.fileKind("src/main.tsx"), "code");
  assert.equal(language.fileKind("package.json"), "data");
  assert.equal(language.fileKind("package-lock.json"), "lock");
  assert.equal(language.fileKind("src-tauri/Cargo.lock"), "lock");
  assert.equal(language.fileKind(".gitignore"), "config");
  assert.equal(language.fileKind("docs/README.md"), "text");
  assert.equal(language.fileKind("docs/images/workspace.jpg"), "image");
  assert.equal(language.fileKind("LICENSE"), "file");
});

test("a diff splits into its old and new texts, each line pointing at its row on the side it belongs to", () => {
  const { lines } = workspace.parseUnifiedDiff([
    "--- a/x.ts", "+++ b/x.ts", "@@ -1,3 +1,3 @@", " const a = 1;", "-const b = `old", "+const b = `new", " still template`;",
  ].join("\n"));
  const sides = language.diffSides(lines);
  assert.equal(sides.oldText, "const a = 1;\nconst b = `old\nstill template`;");
  assert.equal(sides.newText, "const a = 1;\nconst b = `new\nstill template`;");
  const at = (text) => lines.findIndex((line) => line.text === text);
  assert.deepEqual([sides.old[at("const b = `old")], sides.new[at("const b = `old")]], [1, -1]);
  assert.deepEqual([sides.old[at("const b = `new")], sides.new[at("const b = `new")]], [-1, 1]);
  assert.deepEqual([sides.old[at("still template`;")], sides.new[at("still template`;")]], [2, 2]);
  const hunk = lines.findIndex((line) => line.kind === "hunk");
  assert.ok(hunk >= 0);
  assert.deepEqual([sides.old[hunk], sides.new[hunk]], [-1, -1]);
  assert.equal(sides.old.length, lines.length);
});

test("Git status marks changed files and every folder above them; an untracked folder covers what is inside it", () => {
  const status = workspace.parseGitStatus(["## main", " M src/app/main.ts", "A  docs/new.md", "?? scratch/"].join("\0") + "\0");
  const result = marks.gitMarks(status);
  assert.equal(marks.fileMark(result, "src/app/main.ts"), "modified");
  assert.equal(marks.fileMark(result, "docs/new.md"), "added");
  assert.equal(marks.fileMark(result, "scratch/deep/a.txt"), "untracked");
  assert.equal(marks.fileMark(result, "src/app/other.ts"), undefined);
  assert.ok(marks.dirMarked(result, "src") && marks.dirMarked(result, "src/app") && marks.dirMarked(result, "docs"));
  assert.ok(marks.dirMarked(result, "scratch") && marks.dirMarked(result, "scratch/deep"));
  assert.ok(!marks.dirMarked(result, "src/components") && !marks.dirMarked(result, "scr"));
  assert.equal(marks.NO_MARKS.files.size, 0);
});
