import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile the dev-server mirror, the shared parsers and the tool contract; add `.js` to relative imports.
const output = mkdtempSync(join(tmpdir(), "nekopapa-project-workspace-"));
let api;
let workspace;
let tools;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./project-workspace-tsconfig.json", import.meta.url)), "--outDir", output]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(output).filter((name) => name.endsWith(".js"))) {
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, path, b) => `${a}${path.endsWith(".js") ? path : `${path}.js`}${b}`));
  }
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  api = await import(pathToFileURL(join(output, "scripts/project-workspace-api.js")));
  workspace = await import(pathToFileURL(join(output, "src/app/project-workspace.js")));
  tools = await import(pathToFileURL(join(output, "src/app/chat-tools.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
const git = (root, ...args) => execFileSync("git", ["-C", root, "-c", "user.name=NekoPapa Test", "-c", "user.email=test@example.invalid", "-c", "init.defaultBranch=main", ...args], { env: gitEnv, encoding: "utf8" });

/** A throwaway repository: one commit, then a modified, a deleted, a staged-new and an untracked file. */
function repository(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "nekopapa-workspace-fixture-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  write("src/app.ts", "one\ntwo\nthree\n");
  write("gone.txt", "bye\n");
  write("Zeta.md", "# z\n");
  git(root, "init", "-q");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "init");
  write("src/app.ts", "one\nTWO\nthree\nfour\n");
  rmSync(join(root, "gone.txt"));
  write("staged.ts", "export {};\n");
  git(root, "add", "staged.ts");
  write("notes/new file.md", "hello\nworld\n");
  write("image.bin", "\u0000\u0001");
  return root;
}

test("文件列表先列文件夹、按名称排序、跳过 .git，并逐层读取子文件夹", async (t) => {
  const root = repository(t);
  const top = await api.listProject(root, "");
  assert.deepEqual(top.entries.map((entry) => [entry.name, entry.kind]), [
    ["notes", "dir"], ["src", "dir"], ["image.bin", "file"], ["staged.ts", "file"], ["Zeta.md", "file"],
  ]);
  assert.equal(top.truncated, false);
  const src = await api.listProject(root, "src");
  assert.deepEqual(src.entries, [{ name: "app.ts", path: "src/app.ts", kind: "file", size: 19 }]);
  assert.deepEqual(workspace.readListing(JSON.parse(JSON.stringify(src))), src);
});

test("只读预览：文本返回内容，二进制只标记，越界路径与指向外部的链接被拒绝", async (t) => {
  const root = repository(t);
  const text = await api.readProject(root, "src/app.ts");
  assert.equal(text.text, "one\nTWO\nthree\nfour\n");
  assert.deepEqual(workspace.readProjectFile(text), text);
  const binary = await api.readProject(root, "image.bin");
  assert.equal(binary.binary, true);
  assert.equal(binary.text, undefined);
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "nekopapa-outside-")));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, "secret.txt"), "secret");
  symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));
  await assert.rejects(api.readProject(root, "link.txt"), /项目文件夹之外/);
  await assert.rejects(api.readProject(root, "../secret.txt"), /路径无效/);
  await assert.rejects(api.readProject(root, "/etc/hosts"), /路径无效/);
  await assert.rejects(api.listProject("relative/root", ""), /完整路径/);
  await assert.rejects(api.readProject(root, "src"), /不是文件/);
});

test("Git 状态读出分支与每类更改，差异按行编号，未跟踪文件显示为全部新增", async (t) => {
  const root = repository(t);
  const result = await api.gitStatus(root);
  assert.equal(result.repo, true);
  const status = workspace.parseGitStatus(result.output);
  assert.equal(status.branch, "main");
  assert.equal(status.detached, false);
  const byPath = Object.fromEntries(status.changes.map((change) => [change.path, change]));
  assert.equal(byPath["src/app.ts"].kind, "modified");
  assert.equal(byPath["src/app.ts"].unstaged, true);
  assert.equal(byPath["gone.txt"].kind, "deleted");
  assert.equal(byPath["staged.ts"].kind, "added");
  assert.equal(byPath["staged.ts"].staged, true);
  assert.equal(byPath["notes/new file.md"].kind, "untracked");

  const diff = workspace.parseUnifiedDiff((await api.gitDiff(root, "src/app.ts")).output);
  assert.equal(diff.added, 2);
  assert.equal(diff.removed, 1);
  assert.deepEqual(diff.lines.filter((line) => line.kind !== "hunk"), [
    { kind: "ctx", text: "one", old: 1, new: 1 },
    { kind: "del", text: "two", old: 2 },
    { kind: "add", text: "TWO", new: 2 },
    { kind: "ctx", text: "three", old: 3, new: 3 },
    { kind: "add", text: "four", new: 4 },
  ]);
  assert.deepEqual(workspace.untrackedDiff("hello\nworld\n").lines, [{ kind: "add", text: "hello", new: 1 }, { kind: "add", text: "world", new: 2 }]);
  await assert.rejects(api.gitDiff(root, "../x"), /路径无效/);
});

test("不是 Git 仓库的文件夹报告 repo:false；没有提交的仓库仍能读出分支与暂存差异", async (t) => {
  const plain = realpathSync(mkdtempSync(join(tmpdir(), "nekopapa-plain-")));
  t.after(() => rmSync(plain, { recursive: true, force: true }));
  assert.deepEqual(await api.gitStatus(plain), { repo: false, output: "" });
  writeFileSync(join(plain, "a.txt"), "a\n");
  git(plain, "init", "-q");
  git(plain, "add", "a.txt");
  const status = workspace.parseGitStatus((await api.gitStatus(plain)).output);
  assert.equal(status.branch, "main");
  assert.deepEqual(status.changes.map((change) => [change.path, change.kind, change.staged]), [["a.txt", "added", true]]);
  assert.equal(workspace.parseUnifiedDiff((await api.gitDiff(plain, "a.txt")).output).added, 1);
});

test("状态解析处理上游领先落后、分离 HEAD、重命名与冲突", () => {
  const tracked = workspace.parseGitStatus("## main...origin/main [ahead 2, behind 1]\0R  new.ts\0old.ts\0UU both.ts\0 M a b.ts\0");
  assert.deepEqual({ branch: tracked.branch, upstream: tracked.upstream, ahead: tracked.ahead, behind: tracked.behind },
    { branch: "main", upstream: "origin/main", ahead: 2, behind: 1 });
  assert.deepEqual(tracked.changes, [
    { path: "new.ts", from: "old.ts", kind: "renamed", staged: true, unstaged: false },
    { path: "both.ts", kind: "conflicted", staged: true, unstaged: true },
    { path: "a b.ts", kind: "modified", staged: false, unstaged: true },
  ]);
  assert.equal(workspace.parseGitStatus("## HEAD (no branch)\0").detached, true);
  assert.equal(workspace.parseGitStatus("## No commits yet on dev\0").branch, "dev");
  assert.equal(workspace.parseUnifiedDiff("diff --git a/x b/x\nBinary files a/x and b/x differ\n").binary, true);
  assert.throws(() => workspace.readGitOutput({ repo: "yes", output: "" }), /格式无效/);
});

test("开发服务器接口只接受 JSON POST，越界请求返回可显示的错误", async (t) => {
  const root = repository(t);
  const middleware = api.createProjectWorkspaceMiddleware();
  const server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const url = (route) => `http://127.0.0.1:${server.address().port}/api/project-workspace/${route}`;
  const post = (route, body) => fetch(url(route), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const listed = await post("list", { root, dir: "src" });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).entries[0].path, "src/app.ts");
  const status = await post("git-status", { root });
  assert.equal((await status.json()).repo, true);
  const refused = await post("read", { root, path: "../../etc/passwd" });
  assert.equal(refused.status, 400);
  assert.deepEqual(await refused.json(), { error: "路径无效。" });
  assert.equal((await fetch(url("list"))).status, 405);
  assert.equal((await fetch(url("list"), { method: "POST", body: "{}" })).status, 415);
  assert.equal((await fetch(url("unknown"), { method: "POST" })).status, 404);
});

test("标题栏工具的快捷键按平台区分，目录没有快捷键，带 Alt 或重复按键不触发", () => {
  const key = (overrides) => ({ key: "j", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, ...overrides });
  assert.equal(tools.chatToolForShortcut(key({ metaKey: true }), "MacIntel"), "terminal");
  assert.equal(tools.chatToolForShortcut(key({ key: "D", metaKey: true, shiftKey: true }), "MacIntel"), "changes");
  assert.equal(tools.chatToolForShortcut(key({ key: "F", ctrlKey: true, shiftKey: true }), "Win32"), "files");
  assert.equal(tools.chatToolForShortcut(key({ ctrlKey: true }), "MacIntel"), undefined);
  assert.equal(tools.chatToolForShortcut(key({ metaKey: true, altKey: true }), "MacIntel"), undefined);
  assert.equal(tools.chatToolForShortcut(key({ metaKey: true, repeat: true }), "MacIntel"), undefined);
  assert.equal(tools.chatToolForShortcut(key({ key: "d", metaKey: true }), "MacIntel"), undefined);
  assert.equal(tools.chatToolShortcut("terminal", "MacIntel"), "⌘J");
  assert.equal(tools.chatToolShortcut("changes", "Linux x86_64"), "Ctrl+Shift+D");
  assert.equal(tools.chatToolShortcut("outline", "MacIntel"), undefined);
});

test("目录只列用户消息，按首个非空行命名并依次编号", () => {
  assert.deepEqual(tools.chatOutline([
    { id: "a", role: "user", text: "\n  第一个问题\n细节" },
    { id: "b", role: "assistant", text: "回答" },
    { id: "c", role: "user", text: "" },
  ]), [{ id: "a", index: 1, title: "第一个问题" }, { id: "c", index: 2, title: "（没有文字的消息）" }]);
});
