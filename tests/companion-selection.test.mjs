import assert from "node:assert/strict";
import test from "node:test";
import { companionsModule, chromeModule } from "./helpers/production.mjs";
import { WorkspaceStore, storage, sampleState, workspace, assertConsistent } from "./helpers/workspace.mjs";
const { companionCatalog, conversationForCompanion } = companionsModule;

test("choosing a character changes only the preference and survives reload with the same open content", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  store.open("today");
  store.favorite("today");
  store.navigate("projects");
  store.toggleSection("home-recent");
  const before = structuredClone(store.state);
  const history = [...store.history];
  const historyIndex = store.historyIndex;
  assert.equal(store.selectCompanion("rinne"), true);
  assert.deepEqual(store.state, { ...before, selectedCompanionId: "rinne" });
  assert.deepEqual(store.history, history);
  assert.equal(store.historyIndex, historyIndex);
  assert.deepEqual(new WorkspaceStore(saved).state, store.state);
  assertConsistent(store);
});

test("all official characters can be selected without creating sessions or substituting placeholder artwork", () => {
  const store = new WorkspaceStore(storage());
  for (const companion of companionCatalog) {
    store.selectCompanion(companion.id);
    assert.equal(store.state.selectedCompanionId, companion.id);
    assert.equal(conversationForCompanion(store.state), undefined);
  }
  assert.equal(companionCatalog.length, 5);
  assert.equal(companionCatalog.filter((companion) => companion.avatar).length, 2);
  assert.deepEqual(store.state.items, []);
  assert.deepEqual(store.state.groups, []);
  assert.deepEqual(store.state.tabs, ["home"]);
});

test("an invalid or repeated character choice has no navigation, content, or storage side effect", () => {
  const saved = storage(sampleState());
  let writes = 0;
  const store = new WorkspaceStore({ getItem: saved.getItem, setItem: (key, value) => { writes++; saved.setItem(key, value); } });
  const before = structuredClone(store.state);
  for (const id of ["lumia", "missing", "", " rinne ", "home"]) assert.equal(store.selectCompanion(id), false);
  assert.deepEqual(store.state, before);
  assert.equal(writes, 0);
});

test("new ordinary sessions bind the selected character while existing, Coding, and page records retain their identity", () => {
  const store = workspace();
  const original = structuredClone(store.state.items);
  store.selectCompanion("rinne");
  const rinne = store.addItem("conversation", "新的交流", "daily");
  assert.equal(store.item(rinne).companionId, "rinne");
  store.selectCompanion("iori");
  const iori = store.addItemWithGroup("conversation", "茶会", "新空间");
  assert.equal(store.item(iori).companionId, "iori");
  const coding = store.addItem("coding", "工作", "project-neko");
  const page = store.addItem("page", "笔记", "ideas");
  assert.equal(store.item(coding).companionId, undefined);
  assert.equal(store.item(page).companionId, undefined);
  for (const item of original) assert.equal(store.item(item.id).companionId, item.companionId);
  assertConsistent(store);
});

test("continuation resolves the selected character's current or recently visited session and preserves IDs", () => {
  const store = workspace();
  const rinne = store.addItem("conversation", "凛音", "daily", "rinne");
  const mio = store.addItem("conversation", "澪", "daily", "lumia");
  store.selectCompanion("rinne");
  const before = structuredClone(store.state);
  assert.equal(conversationForCompanion(store.state), store.item(rinne));
  assert.deepEqual(store.state, before);
  store.open(rinne);
  assert.equal(conversationForCompanion(store.state).id, rinne);
  store.selectCompanion("lumia");
  assert.equal(conversationForCompanion(store.state).id, mio);
  store.open("today");
  assert.equal(conversationForCompanion(store.state).id, "today");
  store.selectCompanion("shiori");
  assert.equal(conversationForCompanion(store.state), undefined);
});

test("continuation excludes archived records, pages, and Coding even when their metadata refers to the same role", () => {
  const store = workspace();
  store.selectCompanion("rinne");
  store.item("project-session").companionId = "rinne";
  store.item("weekend").companionId = "rinne";
  const older = store.addItem("conversation", "较早交流", "daily");
  const newer = store.addItem("conversation", "较新交流", "daily");
  store.item(older).activity.updatedAt = "2026-10-03T02:00:00Z";
  store.item(newer).activity.updatedAt = "2026-10-04T02:00:00Z";
  store.state.recent = [];
  store.open("home");
  assert.equal(conversationForCompanion(store.state).id, newer);
  const archive = store.archiveItem(newer);
  assert.equal(conversationForCompanion(store.state).id, older);
  store.archiveItem(older);
  assert.equal(conversationForCompanion(store.state), undefined);
  store.restoreArchive(archive);
  assert.equal(conversationForCompanion(store.state).id, newer);
  assert.equal(store.item(newer).companionId, "rinne");
});

test("legacy and malformed selection preferences default safely without rewriting custom session identities", () => {
  for (const value of [undefined, null, "missing", "", {}, " rinne "]) {
    const seed = sampleState();
    seed.items[0].companionId = "legacy-custom-character";
    seed.selectedCompanionId = value;
    const saved = storage(seed);
    const store = new WorkspaceStore(saved);
    assert.equal(store.state.selectedCompanionId, "lumia");
    assert.equal(store.item("today").companionId, "legacy-custom-character");
    assert.deepEqual(store.state.tabs, seed.tabs);
  }
});

test("archive restore and details report the session's character rather than the currently selected character", () => {
  const saved = storage(sampleState());
  const store = new WorkspaceStore(saved);
  store.selectCompanion("rinne");
  const id = store.addItem("conversation", "凛音对话", "daily");
  const archive = store.archiveItem(id);
  store.selectCompanion("tsumugi");
  const reloaded = new WorkspaceStore(saved);
  reloaded.restoreArchive(archive);
  reloaded.open(id);
  const details = chromeModule.renderDetails(reloaded, { detailsVisible: true, fullView: false });
  assert.equal(reloaded.state.selectedCompanionId, "tsumugi");
  assert.equal(reloaded.item(id).companionId, "rinne");
  assert.match(details, /雪代凛音/);
  assert.doesNotMatch(details, /黒羽紬/);
  assertConsistent(reloaded);
});
