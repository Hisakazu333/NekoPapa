import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-project-folders-"));
let folders;
let projects;
let groups;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./project-folders-tsconfig.json", import.meta.url)), "--outDir", output]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(output).filter((name) => name.endsWith(".js"))) {
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, path, b) => `${a}${path.endsWith(".js") ? path : `${path}.js`}${b}`));
  }
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  folders = await import(pathToFileURL(join(output, "app/project-folders.js")));
  projects = await import(pathToFileURL(join(output, "app/projects.js")));
  groups = await import(pathToFileURL(join(output, "components/application/dashboard/sidebar-recent-groups.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; } };
};
const message = (id) => ({ id, role: "user", parts: [{ type: "text", text: id }] });
const thread = (id, updatedAt, extra = {}) => ({ id, title: id, updatedAt, messages: [message(`${id}-m`)], messageAt: {}, ...extra });

test("旧版最近文件夹列表只读：去重、保留顺序，损坏数据读为空", () => {
  assert.deepEqual(folders.readProjectFolders(memory()), []);
  assert.deepEqual(folders.readProjectFolders(memory({ [folders.PROJECT_FOLDERS_KEY]: JSON.stringify({ folders: ["/Users/me/vibl/", "boardui", "/Users/me/vibl"] }) })), ["/Users/me/vibl", "boardui"]);
  assert.deepEqual(folders.readProjectFolders(memory({ [folders.PROJECT_FOLDERS_KEY]: "{broken" })), []);
  assert.deepEqual(folders.readProjectFolders(memory({ [folders.PROJECT_FOLDERS_KEY]: JSON.stringify({ folders: ["ok", "", 3, "ok", "x".repeat(2000)] }) })), ["ok"]);
  const many = Array.from({ length: 20 }, (_, index) => `p${index}`);
  assert.equal(folders.readProjectFolders(memory({ [folders.PROJECT_FOLDERS_KEY]: JSON.stringify({ folders: many }) })).length, folders.PROJECT_FOLDER_LIMIT);
});

test("文件夹名称取路径最后一段，空白和控制字符输入被拒绝", () => {
  assert.equal(folders.normalizeProjectFolder("  /Users/me/vibl/  "), "/Users/me/vibl");
  assert.equal(folders.normalizeProjectFolder("/"), "/");
  assert.equal(folders.normalizeProjectFolder("   "), undefined);
  assert.equal(folders.normalizeProjectFolder("a\nb"), undefined);
  assert.equal(folders.projectFolderName("/Users/me/vibl"), "vibl");
  assert.equal(folders.projectFolderName("C:\\code\\boardui"), "boardui");
  assert.equal(folders.projectFolderName("boardui"), "boardui");
});

const project = (id, folders, extra = {}) => ({ id: `proj_${id}`, name: id, folders, pinned: false, ...extra });

test("最近对话按项目分组（项目 ID 与旧文件夹路径都能归入），按最新对话排序，未归入或已移除项目的对话单独列出", () => {
  const list = [project("vibl", ["/p/vibl", "/p/vibl-api"]), project("board", ["/p/boardui"])];
  const result = groups.groupRecentThreads([
    thread("old-vibl", 10, { project: "/p/vibl" }),
    thread("api", 20, { project: "/p/vibl-api" }),
    thread("loose", 30),
    thread("board", 40, { project: "proj_board" }),
    thread("new-vibl", 50, { project: "proj_vibl" }),
    thread("removed", 55, { project: "proj_gone" }),
    thread("contact", 60, { contact: { id: "c", kind: "official", name: "C" } }),
    { ...thread("empty", 70, { project: "proj_vibl" }), messages: [] },
  ], { projects: list });
  assert.deepEqual(result.projects.map((group) => [group.project.id, group.threads.map((item) => item.id)]), [
    ["proj_vibl", ["new-vibl", "api", "old-vibl"]],
    ["proj_board", ["board"]],
  ]);
  assert.deepEqual(result.loose.map((item) => item.id), ["removed", "loose"]);
  const limited = groups.groupRecentThreads([thread("a", 1), thread("c", 3), thread("b", 2, { project: "proj_p" }), thread("d", 4, { project: "proj_p" })], { projects: [project("p", ["/p"])], perProject: 1, loose: 1 });
  assert.deepEqual(limited.projects.map((group) => [group.threads.map((item) => item.id), group.hidden]), [[["d"], 1]]);
  assert.deepEqual([limited.loose.map((item) => item.id), limited.hiddenLoose], [["c"], 1]);
});

test("置顶项目排最前；还没有对话的项目排在有对话的项目之后", () => {
  const list = [project("new", ["/p/new"]), project("vibl", ["/p/vibl"]), project("pin", ["/p/pin"], { pinned: true })];
  const result = groups.groupRecentThreads([thread("x", 5, { project: "proj_vibl" })], { projects: list });
  assert.deepEqual(result.projects.map((group) => [group.project.id, group.threads.length]), [["proj_pin", 0], ["proj_vibl", 1], ["proj_new", 0]]);
  assert.deepEqual(groups.groupRecentThreads([]).projects, []);
});

test("最近对话时间徽标显示现在、分钟、小时、天和周", () => {
  const now = 100 * 24 * 60 * 60_000;
  assert.equal(groups.recentAge(now - 10_000, now), "现在");
  assert.equal(groups.recentAge(now + 5_000, now), "现在");
  assert.equal(groups.recentAge(now - 34 * 60_000, now), "34m");
  assert.equal(groups.recentAge(now - 5 * 3_600_000, now), "5h");
  assert.equal(groups.recentAge(now - 2 * 86_400_000, now), "2d");
  assert.equal(groups.recentAge(now - 14 * 86_400_000, now), "2w");
  assert.match(groups.recentAge(now - 60 * 86_400_000, now), /^\d+\/\d+$/);
  assert.equal(groups.recentAge(0, now), "");
});
