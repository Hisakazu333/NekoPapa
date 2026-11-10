import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compiles the production project model (shared tsconfig with project-folders.test.mjs).
const output = mkdtempSync(join(tmpdir(), "nekopapa-projects-"));
let model;
let folders;
try {
  execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "--project", fileURLToPath(new URL("./project-folders-tsconfig.json", import.meta.url)), "--outDir", output]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(output).filter((name) => name.endsWith(".js"))) {
    writeFileSync(file, readFileSync(file, "utf8").replace(/(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g, (_, a, path, b) => `${a}${path.endsWith(".js") ? path : `${path}.js`}${b}`));
  }
  writeFileSync(join(output, "package.json"), '{"type":"module"}');
  model = await import(pathToFileURL(join(output, "app/projects/projects.js")));
  folders = await import(pathToFileURL(join(output, "app/projects/project-folders.js")));
} finally {
  rmSync(output, { recursive: true, force: true });
}

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; } };
};
const ids = () => { let n = 0; return () => `proj_${++n}`; };

test("首次读取把旧最近文件夹各建为一个项目；保存后重载恢复，损坏与无效条目被丢弃，写入失败返回 false", () => {
  const storage = memory({ [folders.PROJECT_FOLDERS_KEY]: JSON.stringify({ folders: ["/Users/me/vibl", "/Users/me/boardui"] }) });
  const first = model.readProjects(storage, ids());
  assert.deepEqual(first, {
    projects: [
      { id: "proj_1", name: "vibl", folders: ["/Users/me/vibl"], pinned: false },
      { id: "proj_2", name: "boardui", folders: ["/Users/me/boardui"], pinned: false },
    ],
    legacyAdopted: false,
  });
  assert.equal(model.saveProjects(storage, first), true);
  assert.deepEqual(model.readProjects(storage, () => "proj_other"), first);

  assert.deepEqual(model.readProjects(memory({ [model.PROJECTS_KEY]: "{broken" })), { projects: [], legacyAdopted: false });
  const mixed = JSON.stringify({ projects: [
    { id: "proj_a", name: " A ", folders: ["/a/", "/a", "", 3], pinned: true },
    { id: "proj_a", name: "dup", folders: ["/x"] },
    { id: "bad id", name: "B", folders: ["/b"] },
    { id: "proj_c", name: "", folders: ["/c"] },
    { id: "proj_d", name: "D", folders: [] },
  ], legacyAdopted: true });
  assert.deepEqual(model.readProjects(memory({ [model.PROJECTS_KEY]: mixed })), {
    projects: [{ id: "proj_a", name: "A", folders: ["/a"], pinned: true }], legacyAdopted: true,
  });
  assert.equal(model.saveProjects({ setItem: () => { throw new Error("quota"); } }, first), false);
});

test("添加文件夹新建项目放在最前；已属于某项目的文件夹返回该项目而不重复", () => {
  let list = { projects: [], legacyAdopted: true };
  const make = ids();
  ({ list } = model.addFolderProject(list, "/p/vibl/", make));
  const again = model.addFolderProject(list, "/p/vibl", make);
  assert.equal(again.list, list);
  assert.equal(again.project.id, "proj_1");
  ({ list } = model.addFolderProject(list, "/p/board", make));
  assert.deepEqual(list.projects.map((project) => [project.id, project.name, project.folders]), [["proj_2", "board", ["/p/board"]], ["proj_1", "vibl", ["/p/vibl"]]]);
  assert.equal(model.addFolderProject(list, "  ").project, undefined);
});

test("编辑项目：改名、多个文件夹与主要文件夹顺序；拒绝空名称、无文件夹、超过上限和其他项目已有的文件夹", () => {
  const list = { projects: [
    { id: "proj_a", name: "A", folders: ["/a"], pinned: false },
    { id: "proj_b", name: "B", folders: ["/b"], pinned: false },
  ], legacyAdopted: true };
  const saved = model.updateProject(list, "proj_a", { name: " Nekobuddy ", folders: ["/a2", "/a", "/a2/"] });
  assert.equal(saved.error, undefined);
  assert.deepEqual(saved.list.projects[0], { id: "proj_a", name: "Nekobuddy", folders: ["/a2", "/a"], pinned: false });
  assert.equal(model.updateProject(list, "proj_a", { name: "  ", folders: ["/a"] }).error, "请输入项目名称。");
  assert.match(model.updateProject(list, "proj_a", { name: "x".repeat(81), folders: ["/a"] }).error, /最多 80/);
  assert.equal(model.updateProject(list, "proj_a", { name: "A", folders: [] }).error, "项目至少需要一个文件夹。");
  assert.match(model.updateProject(list, "proj_a", { name: "A", folders: Array.from({ length: 11 }, (_, i) => `/f${i}`) }).error, /最多 10/);
  assert.equal(model.updateProject(list, "proj_a", { name: "A", folders: ["/a", "/b"] }).error, "有文件夹已属于项目“B”。");
  assert.equal(model.updateProject(list, "proj_gone", { name: "A", folders: ["/z"] }).error, "这个项目已被移除。");
  assert.equal(model.updateProject(list, "proj_a", { name: "A", folders: ["/z"] }).list.projects[1], list.projects[1]);
});

test("置顶切换与移除只影响目标项目；对话的项目值按 ID 或旧文件夹路径解析，已移除的 ID 不再解析", () => {
  const list = { projects: [{ id: "proj_a", name: "A", folders: ["/a", "/a-api"], pinned: false }, { id: "proj_b", name: "B", folders: ["/b"], pinned: false }], legacyAdopted: true };
  const pinned = model.toggleProjectPinned(list, "proj_b");
  assert.deepEqual(pinned.projects.map((project) => project.pinned), [false, true]);
  assert.equal(model.toggleProjectPinned(pinned, "proj_b").projects[1].pinned, false);
  assert.equal(model.resolveProject(list.projects, "proj_a")?.name, "A");
  assert.equal(model.resolveProject(list.projects, "/a-api/")?.name, "A");
  assert.equal(model.resolveProject(list.projects, undefined), undefined);
  const removed = model.removeProject(list, "proj_a");
  assert.deepEqual(removed.projects.map((project) => project.id), ["proj_b"]);
  assert.equal(model.resolveProject(removed.projects, "proj_a"), undefined);
  assert.equal(model.resolveProject(removed.projects, "/a"), undefined);
});

test("旧对话的文件夹路径一次性迁移为项目；项目 ID、已收录的文件夹和无效值不重复创建", () => {
  const list = { projects: [{ id: "proj_a", name: "A", folders: ["/a"], pinned: false }], legacyAdopted: false };
  const adopted = model.adoptLegacyFolders(list, ["/a", "/legacy/x", "/legacy/x/", "proj_gone", "  "], ids());
  assert.deepEqual(adopted, {
    projects: [list.projects[0], { id: "proj_1", name: "x", folders: ["/legacy/x"], pinned: false }],
    legacyAdopted: true,
  });
});
