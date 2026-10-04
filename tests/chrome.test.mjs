import assert from "node:assert/strict";
import test from "node:test";
import { chromeModule } from "./helpers/production.mjs";
import { workspace, WorkspaceStore, storage } from "./helpers/workspace.mjs";
const { chromeContext, renderChrome, renderDetails, defaultPresentation } = chromeModule;

test("topbar context follows the active record through rename, move, archive and restore", () => {
  const store = workspace();
  store.open("today");
  store.rename("today", "新的名称");
  store.move("today", "project-neko");
  let context = chromeContext(store);
  assert.equal(context.item.id, "today");
  assert.equal(context.item.title, "新的名称");
  assert.equal(context.group.id, "project-neko");
  assert.equal(context.type, "普通对话");
  const archive = store.archiveItem("today");
  assert.notEqual(chromeContext(store).item.id, "today");
  store.restoreArchive(archive);
  store.open("today");
  assert.equal(chromeContext(store).item.title, "新的名称");
});

test("empty workbench exposes creation and a real tab count without synthetic runtime details", () => {
  const store = new WorkspaceStore(storage());
  const markup = renderChrome(store, defaultPresentation());
  assert.match(markup, /工作台操作/);
  assert.match(markup, /打开的标签页，1 个/);
  assert.equal(chromeContext(store).managed, false);
  assert.equal(chromeContext(store).status, undefined);
  const details = renderDetails(store, { detailsVisible: true, fullView: false });
  assert.match(details, /还没有内容/);
  assert.doesNotMatch(details, /后台进程|npm run dev|子智能体|\+4,359|运行中/);
});

test("the open tab count reflects closing and restoring while background status remains real", () => {
  const store = workspace();
  assert.equal(chromeContext(store).tabCount, 3);
  store.close("weekend");
  assert.equal(chromeContext(store).tabCount, 2);
  store.restoreClosed();
  assert.equal(chromeContext(store).tabCount, 3);
  store.recordSessionActivity("today", { status: "waiting", updatedAt: "2026-10-04T03:00:00Z" });
  store.open("today");
  assert.equal(chromeContext(store).status, "等待确认");
});

test("detail data escapes user names and follows favorites and pin state", () => {
  const store = workspace();
  store.open("today");
  store.rename("today", '<script>alert("x")</script>');
  store.favorite("today");
  store.pinSession("today");
  const markup = renderDetails(store, { detailsVisible: true, fullView: false });
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(markup, /已收藏/);
  assert.match(markup, /已置顶/);
  assert.match(markup, /白羽澪/);
});

test("full view hides detail presentation without mutating stored sidebar preferences", () => {
  const store = workspace();
  const state = structuredClone(store.state);
  const presentation = { detailsVisible: true, fullView: true };
  assert.match(renderChrome(store, presentation), /退出完整视图/);
  assert.match(renderDetails(store, presentation), /aria-label="内容详情" hidden/);
  assert.match(renderChrome(store, presentation), /aria-expanded="true" aria-controls="sidebar"/);
  assert.deepEqual(store.state, state);
});

test("expanding content is unavailable without an auxiliary view to expand away from", () => {
  const store = workspace();
  assert.match(renderChrome(store, defaultPresentation()), /data-action="toggle-full-view"[^>]+disabled/);
  assert.doesNotMatch(renderChrome(store, { detailsVisible: true, fullView: false }), /data-action="toggle-full-view"[^>]+disabled/);
});
