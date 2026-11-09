import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "nekopapa-project-folders-"));
let folders;
let groups;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./project-folders-tsconfig.json", import.meta.url)), "--outDir", output]);
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  folders = await import(pathToFileURL(join(output, "app/project-folders.js")));
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

test("项目文件夹列表按最近使用排序、去重并在重载后恢复；损坏数据读为空，写入失败返回 false", () => {
  const storage = memory();
  assert.deepEqual(folders.readProjectFolders(storage), []);
  let list = folders.rememberProjectFolder([], "/Users/me/vibl/");
  list = folders.rememberProjectFolder(list, "boardui");
  list = folders.rememberProjectFolder(list, "/Users/me/vibl");
  assert.deepEqual(list, ["/Users/me/vibl", "boardui"]);
  assert.equal(folders.saveProjectFolders(storage, list), true);
  assert.deepEqual(folders.readProjectFolders(storage), ["/Users/me/vibl", "boardui"]);
  assert.deepEqual(folders.forgetProjectFolder(list, "boardui"), ["/Users/me/vibl"]);

  assert.deepEqual(folders.readProjectFolders(memory({ [folders.PROJECT_FOLDERS_KEY]: "{broken" })), []);
  assert.deepEqual(folders.readProjectFolders(memory({ [folders.PROJECT_FOLDERS_KEY]: JSON.stringify({ folders: ["ok", "", 3, "ok", "x".repeat(2000)] }) })), ["ok"]);
  const many = Array.from({ length: 20 }, (_, index) => `p${index}`);
  assert.equal(folders.mergeProjectFolders(many).length, folders.PROJECT_FOLDER_LIMIT);
  assert.equal(folders.saveProjectFolders({ setItem: () => { throw new Error("quota"); } }, list), false);
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

test("最近对话按项目文件夹分组，文件夹按最新对话排序，未归入项目的对话单独列出，联系人和空对话不出现", () => {
  const result = groups.groupRecentThreads([
    thread("old-vibl", 10, { project: "/p/vibl" }),
    thread("loose", 30),
    thread("board", 40, { project: "/p/boardui" }),
    thread("new-vibl", 50, { project: "/p/vibl" }),
    thread("contact", 60, { contact: { id: "c", kind: "official", name: "C" } }),
    { ...thread("empty", 70, { project: "/p/vibl" }), messages: [] },
  ]);
  assert.deepEqual(result.projects.map((group) => [group.folder, group.threads.map((item) => item.id)]), [
    ["/p/vibl", ["new-vibl", "old-vibl"]],
    ["/p/boardui", ["board"]],
  ]);
  assert.deepEqual(result.loose.map((item) => item.id), ["loose"]);
  const limited = groups.groupRecentThreads([thread("a", 1), thread("c", 3), thread("b", 2, { project: "/p" }), thread("d", 4, { project: "/p" })], { perProject: 1, loose: 1 });
  assert.deepEqual(limited.projects.map((group) => [group.threads.map((item) => item.id), group.hidden]), [[["d"], 1]]);
  assert.deepEqual([limited.loose.map((item) => item.id), limited.hiddenLoose], [["c"], 1]);
});

test("添加后还没有对话的项目文件夹也列在侧栏，排在有对话的文件夹之后且不重复", () => {
  const result = groups.groupRecentThreads([thread("x", 5, { project: "/p/vibl" })], { folders: ["/p/new", "/p/vibl", "/p/other"] });
  assert.deepEqual(result.projects.map((group) => [group.folder, group.threads.length]), [["/p/vibl", 1], ["/p/new", 0], ["/p/other", 0]]);
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
