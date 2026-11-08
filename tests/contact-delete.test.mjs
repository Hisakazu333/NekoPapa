import test from "node:test";
import assert from "node:assert/strict";
import { contactsStoreModule } from "./helpers/production.mjs";

const { ContactsStore, CONTACTS_STORAGE_KEY: key, readDeletedContactIds } = contactsStoreModule;
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6j2cAAAAASUVORK5CYII=";
const memory = () => {
  const entries = new Map();
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
};

test("删除自建联系人移除资料和头像，保留其他联系人的ID、顺序和设定并在重载后保持", () => {
  const storage = memory();
  storage.entries.set("unrelated", "原数据");
  const store = new ContactsStore(storage);
  const first = store.create({ name: "保留第一位", description: "", prompt: "保留提示词" }).contact;
  const removed = store.create({ name: "删除第二位", description: "", avatarDataUrl: png, appearanceId: "rinne" }).contact;
  const last = store.create({ name: "保留第三位", description: "", avatarDataUrl: png }).contact;
  const officials = store.contacts.slice(0, 5);
  assert.equal(store.remove(removed.id), true);
  assert.equal(store.notice, "");
  assert.equal(store.storageAvailable, true);
  assert.deepEqual(store.contacts, [...officials, first, last]);
  assert.deepEqual(new ContactsStore(storage).contacts, store.contacts);
  assert.equal(storage.entries.get("unrelated"), "原数据");
  assert.equal(JSON.parse(storage.entries.get(key)).contacts.some((contact) => contact.id === removed.id), false);
  assert.deepEqual(store.deletedIds, [removed.id]);
  assert.deepEqual(readDeletedContactIds(storage), [removed.id]);
});

test("官方人物不能删除；无效或已经不存在的ID不改变有效记录", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "只保留这位", description: "" }).contact;
  const before = storage.entries.get(key);
  for (const contact of store.contacts.slice(0, 5)) {
    assert.equal(store.remove(contact.id), false);
    assert.match(store.notice, /官方人物不能删除/);
    assert.equal(storage.entries.get(key), before);
  }
  for (const id of ["invalid", "contact-00000000-0000-4000-8000-000000000000"]) {
    assert.equal(store.remove(id), false);
    assert.match(store.notice, /已不存在/);
    assert.equal(storage.entries.get(key), before);
  }
  assert.equal(store.remove(created.id), true);
  const empty = storage.entries.get(key);
  assert.equal(store.remove(created.id), true);
  assert.equal(storage.entries.get(key), empty);
  assert.equal(store.contacts.length, 5);
  assert.deepEqual(store.deletedIds, [created.id]);
});

test("删除先合并最新联系人列表，不覆盖其他窗口新建和编辑的记录", () => {
  const storage = memory();
  const firstWindow = new ContactsStore(storage);
  const a = firstWindow.create({ name: "删除目标", description: "" }).contact;
  const b = firstWindow.create({ name: "保留目标", description: "旧描述" }).contact;
  const secondWindow = new ContactsStore(storage);
  const c = secondWindow.create({ name: "另一窗口新建", description: "新建记录" }).contact;
  const changedB = secondWindow.update(b.id, { name: b.name, description: "另一窗口修改", avatarDataUrl: png }).contact;
  assert.equal(firstWindow.remove(a.id), true);
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), [changedB, c]);
});

test("删除写入失败保留原记录；普通重载不暗中删除，必须明确重试删除", () => {
  const storage = memory();
  const created = new ContactsStore(storage).create({ name: "失败后保留", description: "", avatarDataUrl: png }).contact;
  let fail = true;
  const store = new ContactsStore({
    getItem: storage.getItem,
    setItem: (name, value) => { if (fail) throw new Error("quota"); storage.setItem(name, value); },
  });
  const raw = storage.entries.get(key);
  assert.equal(store.remove(created.id), false);
  assert.equal(store.storageAvailable, false);
  assert.match(store.notice, /未能删除.*保留/);
  assert.deepEqual(store.contacts.at(-1), created);
  assert.deepEqual(store.deletedIds, []);
  assert.equal(storage.entries.get(key), raw);
  fail = false;
  assert.equal(store.reload(), true);
  assert.deepEqual(store.contacts.at(-1), created);
  const another = store.create({ name: "无关创建", description: "" }).contact;
  assert.deepEqual(store.contacts.slice(5), [created, another]);
  assert.equal(store.remove(created.id), true);
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), [another]);
  assert.deepEqual(readDeletedContactIds(storage), [created.id]);
});

test("删除读取失败保留原状态与源数据，恢复后明确重试成功", () => {
  const storage = memory();
  const created = new ContactsStore(storage).create({ name: "读取失败", description: "原记录" }).contact;
  let fail = false;
  const store = new ContactsStore({
    getItem: (name) => { if (fail) throw new Error("unreadable"); return storage.getItem(name); },
    setItem: storage.setItem,
  });
  const raw = storage.entries.get(key);
  fail = true;
  assert.equal(store.remove(created.id), false);
  assert.equal(store.storageAvailable, false);
  assert.deepEqual(store.contacts.at(-1), created);
  assert.equal(storage.entries.get(key), raw);
  assert.deepEqual(store.deletedIds, []);
  assert.match(store.notice, /无法读取/);
  fail = false;
  assert.equal(store.remove(created.id), true);
  assert.equal(new ContactsStore(storage).contacts.length, 5);
});

test("删除拒绝损坏数据，即使备份成功也不能将内存旧快照覆盖回源数据", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "原内存记录", description: "" }).contact;
  storage.entries.set(key, "损坏的新来源");
  assert.equal(store.remove(created.id), false);
  assert.equal(store.storageAvailable, false);
  assert.equal(storage.entries.get(key), "损坏的新来源");
  assert.equal(storage.entries.get(`${key}.recovery`), "损坏的新来源");
  assert.deepEqual(store.contacts.at(-1), created);
});

test("其他窗口删除后迟到的资料保存不能恢复该联系人，同名新建采用新的ID", () => {
  const storage = memory();
  const firstWindow = new ContactsStore(storage);
  const created = firstWindow.create({ name: "旧窗口草稿", description: "", avatarDataUrl: png }).contact;
  const secondWindow = new ContactsStore(storage);
  assert.equal(secondWindow.remove(created.id), true);
  const deletedRaw = storage.entries.get(key);
  const result = firstWindow.update(created.id, { name: created.name, description: "迟到修改", avatarDataUrl: png });
  assert.equal(result.contact, undefined);
  assert.match(result.errors.form, /已不存在/);
  assert.equal(storage.entries.get(key), deletedRaw);
  assert.equal(firstWindow.contacts.some((contact) => contact.id === created.id), false);
  const replacement = firstWindow.create({ name: created.name, description: "重新创建" }).contact;
  assert.notEqual(replacement.id, created.id);
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), [replacement]);
  assert.deepEqual(readDeletedContactIds(storage), [created.id]);
});

test("删除标记与v1兼容且不能被外部快照中的旧资料复活，调用方不能改写标记", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "标记优先", description: "" }).contact;
  const old = JSON.parse(storage.entries.get(key)).contacts[0];
  assert.equal(store.remove(created.id), true);
  const staleSnapshot = JSON.stringify({ version: 1, contacts: [old], deletedIds: [created.id] });
  storage.entries.set(key, staleSnapshot);
  assert.equal(store.reload(), true);
  assert.equal(store.contacts.some((contact) => contact.id === created.id), false);
  const exposed = store.deletedIds;
  exposed.length = 0;
  assert.deepEqual(store.deletedIds, [created.id]);
  assert.deepEqual(readDeletedContactIds(storage), [created.id]);
  storage.entries.set(key, JSON.stringify({ version: 1, contacts: [] }));
  assert.deepEqual(readDeletedContactIds(storage), []);
});

test("删除标记读取失败与真正的空集合可区分，坏标记不替换已有删除状态", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "保留删除状态", description: "" }).contact;
  assert.equal(store.remove(created.id), true);
  for (const deletedIds of [["lumia"], [created.id, created.id], null, "bad"]) {
    storage.entries.set(key, JSON.stringify({ version: 1, contacts: [], deletedIds }));
    assert.equal(readDeletedContactIds(storage), undefined);
    assert.equal(store.reload(), false);
    assert.deepEqual(store.deletedIds, [created.id]);
  }
  storage.entries.set(key, "corrupt");
  assert.equal(readDeletedContactIds(storage), undefined);
  assert.equal(readDeletedContactIds({ getItem: () => { throw new Error("blocked"); } }), undefined);
  assert.deepEqual(readDeletedContactIds({ getItem: () => null }), []);
});
