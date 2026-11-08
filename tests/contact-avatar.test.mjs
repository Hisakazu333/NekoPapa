import test from "node:test";
import assert from "node:assert/strict";
import { contactsStoreModule, companionsModule } from "./helpers/production.mjs";

const { ContactsStore, CONTACTS_STORAGE_KEY: key, MAX_CONTACTS_STORAGE_LENGTH } = contactsStoreModule;
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6j2cAAAAASUVORK5CYII=";
const webp = `data:image/webp;base64,${Buffer.from("RIFF\x10\0\0\0WEBPVP8 \0\0\0\0", "binary").toString("base64")}`;
const memory = () => {
  const entries = new Map();
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
};

test("导入头像与自建联系人一同保存，读取与重载使用相同图片和联系人ID", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const contact = store.create({ name: "有头像的联系人", description: "自己的头像", avatarDataUrl: png }).contact;
  assert.equal(contact.avatar, png);
  assert.equal(contact.avatarDataUrl, png);
  const stored = JSON.parse(storage.entries.get(key));
  assert.equal(stored.version, 1);
  assert.equal(stored.contacts[0].avatarDataUrl, png);
  assert.equal(Object.hasOwn(stored.contacts[0], "avatar"), false);
  assert.deepEqual(new ContactsStore(storage).contacts.at(-1), contact);
});

test("更换图片保留联系人身份、顺序、专业设定，省略图片的旧调用保留导入头像", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const first = store.create({ name: "课程导师", description: "", prompt: "提供渐进提示", avatarDataUrl: png }).contact;
  const second = store.create({ name: "另一位联系人", description: "" }).contact;
  const replaced = store.update(first.id, { name: first.name, description: "换头像", avatarDataUrl: webp }).contact;
  assert.equal(replaced.avatar, webp);
  assert.equal(replaced.prompt, first.prompt);
  assert.equal(replaced.id, first.id);
  const renamed = store.update(first.id, { name: "同一位课程导师", description: replaced.description }).contact;
  assert.equal(renamed.avatar, webp);
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), [renamed, second]);
});

test("导入头像覆盖人物图片但保留Live2D外观ID；明确移除后恢复原人物头像", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "自定义外观", description: "", appearanceId: "rinne", avatarDataUrl: png }).contact;
  assert.equal(created.appearanceId, "rinne");
  assert.equal(created.avatar, png);
  const cleared = store.update(created.id, { name: created.name, description: "", avatarDataUrl: undefined }).contact;
  assert.equal(cleared.id, created.id);
  assert.equal(cleared.appearanceId, "rinne");
  assert.equal(cleared.avatarDataUrl, undefined);
  assert.equal(cleared.avatar, companionsModule.companionCatalog.find((companion) => companion.id === "rinne").avatar);
  assert.equal(Object.hasOwn(JSON.parse(storage.entries.get(key)).contacts[0], "avatarDataUrl"), false);
  assert.deepEqual(new ContactsStore(storage).contacts.at(-1), cleared);
});

test("无人物外观时移除图片恢复字母头像，后续省略图片不复活已移除头像", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "字母头像", description: "", avatarColor: "blue", avatarDataUrl: png }).contact;
  const cleared = store.update(created.id, { name: created.name, description: "", avatarDataUrl: undefined }).contact;
  assert.equal(cleared.avatar, undefined);
  assert.equal(cleared.avatarColor, "blue");
  const edited = new ContactsStore(storage).update(created.id, { name: created.name, description: "保留字母" }).contact;
  assert.equal(edited.avatar, undefined);
  assert.equal(edited.avatarDataUrl, undefined);
});

test("图片类型、编码、文件头和大小无效时拒绝写入，外部无效快照不能替换当前记录", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "保留有效头像", description: "", avatarDataUrl: png }).contact;
  const raw = storage.entries.get(key);
  const saved = JSON.parse(raw).contacts[0];
  for (const avatarDataUrl of [
    "https://remote.test/avatar.png", "blob:temporary", "javascript:invalid",
    "data:image/svg+xml;base64,PHN2Zy8+", "data:image/gif;base64,R0lGODlh",
    "data:image/png;base64,not-an-image", "data:image/png;base64,YWJjZA==",
    png.replace("image/png", "image/jpeg"), png + "A".repeat(100_000),
    null, 42, {}, [],
  ]) {
    const result = store.update(created.id, { name: created.name, description: "", avatarDataUrl });
    assert.ok(result.errors.avatarDataUrl);
    assert.equal(result.contact, undefined);
    assert.equal(storage.entries.get(key), raw);
    assert.equal(store.reload(JSON.stringify({ version: 1, contacts: [{ ...saved, avatarDataUrl }] })), false);
    assert.deepEqual(store.contacts.at(-1), created);
  }
});

test("图片写入或移除失败保留原图与ID，使用相同草稿重试才更新", () => {
  const storage = memory();
  const created = new ContactsStore(storage).create({ name: "可重试头像", description: "", avatarDataUrl: png }).contact;
  let fail = true;
  const store = new ContactsStore({
    getItem: storage.getItem,
    setItem: (name, value) => { if (fail) throw new Error("quota"); storage.setItem(name, value); },
  });
  for (const avatarDataUrl of [webp, undefined]) {
    const before = storage.entries.get(key);
    const previous = store.contacts.at(-1);
    const draft = { name: created.name, description: "", avatarDataUrl };
    fail = true;
    assert.ok(store.update(created.id, draft).errors.form);
    assert.equal(storage.entries.get(key), before);
    assert.deepEqual(store.contacts.at(-1), previous);
    fail = false;
    const saved = store.update(created.id, draft).contact;
    assert.equal(saved.id, created.id);
    assert.equal(saved.avatarDataUrl, avatarDataUrl);
    assert.equal(saved.avatar, avatarDataUrl);
    assert.deepEqual(new ContactsStore(storage).contacts.at(-1), saved);
  }
});

test("带头像联系人支持超过旧上限的有效快照，整体空间超限前拒绝写入且可减少图片重试", () => {
  const storage = memory();
  // The large payload exercises persistence budgets; image decoding belongs to the import UI.
  const large = `data:image/png;base64,${Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(74_000)]).toString("base64")}`;
  const contacts = Array.from({ length: 40 }, (_, index) => ({
    id: `contact-${index.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`,
    kind: "custom", name: `联系人${index}`, description: "", avatarDataUrl: large,
  }));
  const raw = JSON.stringify({ version: 1, contacts });
  assert.ok(raw.length > 512_000 && raw.length < MAX_CONTACTS_STORAGE_LENGTH);
  storage.entries.set(key, raw);
  const store = new ContactsStore(storage);
  assert.equal(store.storageAvailable, true);
  assert.equal(store.contacts.length, 45);
  const failure = store.create({ name: "超限前保留", description: "", avatarDataUrl: large });
  assert.equal(failure.contact, undefined);
  assert.match(failure.errors.form, /空间/);
  assert.equal(storage.entries.get(key), raw);
  assert.equal(store.contacts.length, 45);
  const recovered = store.create({ name: "超限前保留", description: "", avatarDataUrl: png }).contact;
  assert.ok(recovered);
  assert.equal(new ContactsStore(storage).contacts.length, 46);
});

test("超过总上限的外部数据保留原件并拒绝替换当前有效联系人", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "有效联系人", description: "", avatarDataUrl: png }).contact;
  const raw = storage.entries.get(key);
  assert.equal(store.reload(raw + " ".repeat(MAX_CONTACTS_STORAGE_LENGTH)), false);
  assert.deepEqual(store.contacts.at(-1), created);
  assert.equal(storage.entries.get(key), raw);
});

test("旧无图片v1记录继续往返；官方人物拒绝用户导入头像且不改目录", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const old = store.create({ name: "旧联系人", description: "" }).contact;
  assert.deepEqual(new ContactsStore(storage).contacts.at(-1), old);
  const before = storage.entries.get(key);
  const originals = store.contacts.slice(0, 5);
  for (const official of originals) {
    assert.ok(store.update(official.id, { name: official.name, description: official.description, avatarDataUrl: png }).errors.form);
  }
  assert.equal(storage.entries.get(key), before);
  assert.deepEqual(store.contacts.slice(0, 5), originals);
});
