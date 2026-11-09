import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compile the dev-server check and the shared contract, then add `.js` to the emitted relative imports.
const output = mkdtempSync(join(tmpdir(), "nekopapa-project-folder-api-"));
let api;
let info;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./project-folder-api-tsconfig.json", import.meta.url)), "--outDir", output]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(output).filter((name) => name.endsWith(".js"))) {
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, path, b) => `${a}${path.endsWith(".js") ? path : `${path}.js`}${b}`));
  }
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  api = await import(pathToFileURL(join(output, "scripts/project-folder-api.js")));
  info = await import(pathToFileURL(join(output, "src/app/project-folder-info.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "nekopapa-folder-fixture-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  write("repo/.git/HEAD", "ref: refs/heads/feature/login\n");
  write("repo/src/index.ts", "");
  write("repo/.git/worktrees/fix/HEAD", "0123456789abcdef0123456789abcdef01234567\n");
  write("fix/.git", `gitdir: ${join(root, "repo/.git/worktrees/fix")}\n`);
  write("plain/readme.md", "");
  return root;
}

test("只把真实存在的文件夹判为可用：展开 ~、解析为完整路径，并读出分支、分离提交与工作树", async (t) => {
  const root = fixture(t);
  assert.deepEqual(await api.inspectProjectFolder("~/repo/src/", root), {
    ok: true, folder: { path: join(root, "repo/src"), name: "src", git: { branch: "feature/login", worktree: false } },
  });
  assert.deepEqual(await api.inspectProjectFolder(join(root, "fix"), root), {
    ok: true, folder: { path: join(root, "fix"), name: "fix", git: { commit: "0123456", worktree: true } },
  });
  assert.deepEqual(await api.inspectProjectFolder(join(root, "plain"), root), { ok: true, folder: { path: join(root, "plain"), name: "plain" } });
});

test("名称、相对路径、不存在的路径和文件都给出原因，不当作可用文件夹", async (t) => {
  const root = fixture(t);
  const reason = async (input) => (await api.inspectProjectFolder(input, root)).reason;
  assert.equal(await reason("NekoBuddy"), "invalid");
  assert.equal(await reason("  "), "invalid");
  assert.equal(await reason(42), "invalid");
  assert.equal(await reason(join(root, "missing")), "not_found");
  assert.equal(await reason(join(root, "plain/readme.md")), "not_directory");
  assert.equal((await api.inspectProjectFolder(join(root, "missing"), root)).message, "找不到这个文件夹。");
});

test("接口只接受 JSON POST；结果经契约校验，畸形数据读为暂时无法检查", async (t) => {
  const root = fixture(t);
  const middleware = api.createProjectFolderMiddleware(root);
  const server = createServer((request, response) => middleware(request, response, () => { response.writeHead(404); response.end(); }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/project-folder`;

  const ok = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "~/repo" }) });
  assert.equal(ok.status, 200);
  assert.deepEqual(info.readProjectFolderCheck(await ok.json()), { ok: true, folder: { path: join(root, "repo"), name: "repo", git: { branch: "feature/login", worktree: false } } });
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await fetch(url, { method: "POST", body: JSON.stringify({ path: "~/repo" }) })).status, 415);
  assert.equal((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);

  assert.equal(info.readProjectFolderCheck(null).reason, "unavailable");
  assert.equal(info.readProjectFolderCheck({ ok: true, folder: { name: "x" } }).reason, "unavailable");
  assert.equal(info.readProjectFolderCheck({ ok: false, reason: "made-up" }).reason, "unavailable");
  assert.equal(info.readProjectFolderCheck({ ok: false, reason: "denied" }).message, "没有权限读取这个文件夹。");
  assert.deepEqual(info.parseGitHead("ref: refs/heads/main"), { branch: "main" });
  assert.deepEqual(info.parseGitHead("garbage"), {});
});
