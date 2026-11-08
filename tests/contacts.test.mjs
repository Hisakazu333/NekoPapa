import test from "node:test";
import assert from "node:assert/strict";
import { companionsModule, contactsStoreModule } from "./helpers/production.mjs";

const { companionCatalog } = companionsModule;
const { ContactsStore, CONTACTS_STORAGE_KEY: key } = contactsStoreModule;
const memory = () => {
  const entries = new Map();
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
};

test("五位官方联系人直接复用角色身份和实际头像，不创建自建数据或修改工作台", () => {
  const storage = memory();
  storage.entries.set("nekopapa.workspace-shell.v1", "旧工作台原文");
  storage.entries.set("nekopapa.settings.v1", "原设置");
  const before = new Map(storage.entries);
  const store = new ContactsStore(storage);
  assert.deepEqual(store.contacts, companionCatalog.map((contact) => ({ ...contact, kind: "official" })));
  assert.equal(store.contacts.length, 5);
  assert.equal(store.contacts.filter((contact) => contact.avatar).length, 2);
  assert.deepEqual(storage.entries, before);
  const snapshot = store.contacts;
  snapshot[0].name = "外部覆写";
  assert.equal(store.contacts[0].name, companionCatalog[0].name);
});

test("创建联系人校验空名称、长度与同名；成功后重载保留同一ID和用户输入", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  for (const name of [" ", "x".repeat(61), companionCatalog[0].name]) assert.ok(store.create({ name, description: "" }).errors.name);
  assert.ok(store.create({ name: "新联系人", description: "x".repeat(1001) }).errors.description);
  assert.equal(storage.entries.has(key), false);
  const created = store.create({ name: "  周末搭子  ", description: "  一起计划周末  " }).contact;
  assert.ok(created.id.startsWith("contact-"));
  assert.equal(created.kind, "custom");
  assert.equal(created.name, "周末搭子");
  assert.equal(created.description, "一起计划周末");
  assert.deepEqual(new ContactsStore(storage).contacts.at(-1), created);
  assert.ok(store.create({ name: "周末搭子", description: "重复" }).errors.name);
  assert.equal(new ContactsStore(storage).contacts.length, 6);
});

test("自建联系人专业提示词独立保存、长度受限，旧版编辑调用不会意外清空提示词", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "Python导师", description: "编程课程", prompt: "先定位错误，再给渐进提示。" }).contact;
  assert.equal(created.prompt, "先定位错误，再给渐进提示。");
  assert.ok(store.create({ name: "提示词过长", description: "", prompt: "x".repeat(4001) }).errors.prompt);
  const restored = new ContactsStore(storage);
  const edited = restored.update(created.id, { name: created.name, description: "专业编程辅导" }).contact;
  assert.equal(edited.prompt, created.prompt);
  assert.equal(new ContactsStore(storage).contacts.at(-1).prompt, created.prompt);
  const cleared = new ContactsStore(storage).update(created.id, { name: edited.name, description: edited.description, prompt: "" }).contact;
  assert.equal(cleared.prompt, undefined);
  assert.equal(new ContactsStore(storage).contacts.at(-1).prompt, undefined);
});

test("五位官方人物不能通过资料更新改写提示词，失败不影响官方目录与自建联系人", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const custom = store.create({ name: "我的专业联系人", description: "", prompt: "按用户预设完成专业任务。" }).contact;
  const before = new Map(storage.entries);
  for (const companion of companionCatalog) {
    const result = store.update(companion.id, { name: companion.name, description: "替换人设", prompt: "改成专业执行角色" });
    assert.equal(result.contact, undefined);
    assert.match(result.errors.form, /固定设定.*不能修改提示词/);
    assert.deepEqual(storage.entries, before);
  }
  const restored = new ContactsStore(storage).contacts;
  assert.deepEqual(restored.slice(0, 5), companionCatalog.map((companion) => ({ ...companion, kind: "official" })));
  assert.deepEqual(restored.at(-1), custom);
});

test("创建前合并其它窗口新增联系人，官方ID不会写进自建存储", () => {
  const storage = memory();
  const first = new ContactsStore(storage);
  const second = new ContactsStore(storage);
  const a = first.create({ name: "第一位", description: "" }).contact;
  const b = second.create({ name: "第二位", description: "" }).contact;
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5).map((contact) => contact.id), [a.id, b.id]);
  assert.deepEqual(JSON.parse(storage.entries.get(key)).contacts.map((contact) => contact.kind), ["custom", "custom"]);
});

test("存储读取失败阻止空值覆盖；恢复后创建保留原联系人", () => {
  const storage = memory();
  const original = new ContactsStore(storage).create({ name: "已保存", description: "保留" }).contact;
  const raw = storage.entries.get(key);
  let blocked = true;
  const store = new ContactsStore({
    getItem: (name) => { if (blocked) throw new Error("blocked"); return storage.getItem(name); },
    setItem: storage.setItem,
  });
  assert.equal(store.storageAvailable, false);
  assert.ok(store.create({ name: "待创建", description: "" }).errors.form);
  assert.equal(storage.entries.get(key), raw);
  blocked = false;
  assert.ok(store.create({ name: "待创建", description: "" }).contact);
  assert.deepEqual(store.contacts[5], original);
  assert.equal(store.contacts.length, 7);
});

test("写入失败保留原列表且不报告创建成功，重试不会重复创建", () => {
  const storage = memory();
  let fail = true;
  const store = new ContactsStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("full"); storage.setItem(name, value); } });
  const draft = { name: "保留草稿", description: "重试" };
  const result = store.create(draft);
  assert.ok(result.errors.form);
  assert.equal(result.contact, undefined);
  assert.equal(store.contacts.length, 5);
  assert.equal(storage.entries.has(key), false);
  fail = false;
  assert.ok(store.create(draft).contact);
  assert.equal(new ContactsStore(storage).contacts.length, 6);
});

test("损坏联系人先备份原文；备份失败或不同旧备份阻止覆盖", () => {
  for (const blockBackup of [true, false]) {
    const storage = memory();
    storage.entries.set(key, "损坏的联系人原文");
    if (!blockBackup) storage.entries.set(`${key}.recovery`, "不同的旧备份");
    const store = new ContactsStore({
      getItem: storage.getItem,
      setItem: (name, value) => { if (blockBackup && name.endsWith(".recovery")) throw new Error("full"); storage.setItem(name, value); },
    });
    assert.ok(store.create({ name: "不能覆盖", description: "" }).errors.form);
    assert.equal(storage.entries.get(key), "损坏的联系人原文");
    assert.equal(store.contacts.length, 5);
  }
  const storage = memory();
  storage.entries.set(key, "需要备份的原文");
  const store = new ContactsStore(storage);
  assert.equal(storage.entries.get(`${key}.recovery`), "需要备份的原文");
  assert.equal(storage.entries.get(key), "需要备份的原文");
  assert.ok(store.create({ name: "恢复后创建", description: "" }).contact);
  assert.equal(new ContactsStore(storage).contacts.length, 6);
  assert.equal(storage.entries.get(`${key}.recovery`), "需要备份的原文");
});

test("外部同步不允许重复ID、官方身份冒充或未知版本替换有效列表", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const contact = store.create({ name: "保留联系人", description: "" }).contact;
  const before = store.contacts;
  for (const data of [
    { version: 2, contacts: [] },
    { version: 1, contacts: [contact, contact] },
    { version: 1, contacts: [{ ...contact, id: "lumia", kind: "official" }] },
    { version: 1, contacts: [{ ...contact, id: "contact-not-a-uuid" }] },
    { version: 1, contacts: [{ ...contact, avatar: "javascript:invalid" }] },
  ]) {
    assert.equal(store.reload(JSON.stringify(data)), false);
    assert.deepEqual(store.contacts, before);
  }
  assert.equal(store.reload(null), true);
  assert.deepEqual(store.contacts, before.slice(0, 5));
});

test("自建联系人编辑保留ID与原顺序，头像标签和语言在旧v1格式中往返", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const first = store.create({ name: "大学课程助教", description: "先问我思路" }).contact;
  const second = store.create({ name: "编程搭子", description: "一起读代码" }).contact;
  const edited = store.update(first.id, { name: "  数学助教 ", description: "  给提示，不直接给答案  ", tags: "  数学、大学课程  ", language: "zh-CN", avatarColor: "blue" }).contact;
  assert.equal(edited.id, first.id);
  assert.equal(edited.name, "数学助教");
  assert.equal(edited.tags, "数学、大学课程");
  assert.equal(edited.description, "给提示，不直接给答案");
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), [edited, second]);
  assert.equal(JSON.parse(storage.entries.get(key)).version, 1);
  const renamed = store.update(first.id, { name: "同一位数学助教", description: edited.description }).contact;
  assert.equal(renamed.avatarColor, "blue");
  assert.equal(renamed.language, "zh-CN");
  assert.equal(renamed.tags, edited.tags);
});

test("编辑允许自己的现有名称，拒绝重名、官方预设与失效ID而不写数据", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const a = store.create({ name: "Alpha", description: "" }).contact;
  store.create({ name: "Beta", description: "" });
  assert.ok(store.update(a.id, { name: a.name, description: "已更新" }).contact);
  const before = storage.entries.get(key);
  for (const name of ["Ｂｅｔａ", companionCatalog[0].name, " "]) assert.ok(store.update(a.id, { name, description: "" }).errors.name);
  assert.ok(store.update(companionCatalog[0].id, { name: "不能改官方", description: "" }).errors.form);
  assert.ok(store.update("contact-00000000-0000-4000-8000-000000000000", { name: "不存在", description: "" }).errors.form);
  assert.equal(storage.entries.get(key), before);
});

test("编辑前合并其他窗口新建和修改，存储失败时保留原设定与重试ID", () => {
  const storage = memory();
  const first = new ContactsStore(storage);
  const a = first.create({ name: "课程助教", description: "原设定" }).contact;
  const second = new ContactsStore(storage);
  const b = second.create({ name: "代码助手", description: "外部创建" }).contact;
  const updatedB = second.update(b.id, { name: b.name, description: "外部编辑" }).contact;
  const updatedA = first.update(a.id, { name: a.name, description: "本页编辑" }).contact;
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), [updatedA, updatedB]);
  let fail = true;
  const failing = new ContactsStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("full"); storage.setItem(name, value); } });
  const before = storage.entries.get(key);
  const draft = { name: "修改后", description: "保留草稿重试" };
  assert.ok(failing.update(a.id, draft).errors.form);
  assert.equal(storage.entries.get(key), before);
  assert.deepEqual(failing.contacts.slice(5), [updatedA, updatedB]);
  fail = false;
  assert.equal(failing.update(a.id, draft).contact.id, a.id);
  assert.equal(new ContactsStore(storage).contacts.length, 7);
});

test("扩展联系人字段严格校验，无效语言和颜色不进入存储", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const draft = { name: "可编辑", description: "", tags: "代码", language: "ja", avatarColor: "pink" };
  const created = store.create(draft).contact;
  const before = storage.entries.get(key);
  for (const [field, value] of [["tags", "x".repeat(101)], ["language", "unsupported"], ["avatarColor", "javascript:red"]]) {
    assert.ok(store.update(created.id, { ...draft, [field]: value }).errors[field]);
    assert.equal(storage.entries.get(key), before);
    assert.equal(store.reload(JSON.stringify({ version: 1, contacts: [{ ...created, [field]: value }] })), false);
    assert.deepEqual(store.contacts.at(-1), created);
  }
});

test("自建联系人选择人物外观保存外观ID，读取时推导真实头像而不复制URL", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = companionCatalog.map((appearance) => store.create({
    name: `我的${appearance.name}`, description: "自己的设定", appearanceId: appearance.id,
  }).contact);
  for (const [index, appearance] of companionCatalog.entries()) {
    assert.equal(created[index].appearanceId, appearance.id);
    assert.equal(created[index].avatar, appearance.avatar);
    assert.equal(created[index].kind, "custom");
    assert.notEqual(created[index].id, appearance.id);
  }
  assert.deepEqual(new ContactsStore(storage).contacts.slice(5), created);
  const saved = JSON.parse(storage.entries.get(key));
  assert.equal(saved.version, 1);
  assert.deepEqual(saved.contacts.map((contact) => contact.appearanceId), companionCatalog.map((appearance) => appearance.id));
  assert.ok(saved.contacts.every((contact) => !Object.hasOwn(contact, "avatar")));
});

test("编辑保留继承外观与原ID，换预设后重载显示目录中的新头像", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "我的联系人", description: "", appearanceId: "rinne" }).contact;
  const renamed = store.update(created.id, { name: "改个名字", description: "新设定" }).contact;
  assert.equal(renamed.id, created.id);
  assert.equal(renamed.appearanceId, "rinne");
  assert.equal(renamed.avatar, companionCatalog.find((appearance) => appearance.id === "rinne").avatar);
  const changed = store.update(created.id, { name: renamed.name, description: renamed.description, appearanceId: "lumia" }).contact;
  assert.equal(changed.id, created.id);
  assert.equal(changed.avatar, companionCatalog.find((appearance) => appearance.id === "lumia").avatar);
  assert.deepEqual(new ContactsStore(storage).contacts.at(-1), changed);
  assert.equal(Object.hasOwn(JSON.parse(storage.entries.get(key)).contacts[0], "avatar"), false);
});

test("明确切回字母头像会清除外观，重载和后续省略外观的编辑不会恢复旧人物", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "切换头像", description: "保留设定", appearanceId: "rinne", avatarColor: "blue" }).contact;
  const cleared = store.update(created.id, { name: created.name, description: created.description, appearanceId: undefined }).contact;
  assert.equal(cleared.id, created.id);
  assert.equal(cleared.appearanceId, undefined);
  assert.equal(cleared.avatar, undefined);
  assert.equal(cleared.avatarColor, "blue");
  assert.equal(Object.hasOwn(JSON.parse(storage.entries.get(key)).contacts[0], "appearanceId"), false);
  const restored = new ContactsStore(storage);
  assert.deepEqual(restored.contacts.at(-1), cleared);
  const renamed = restored.update(created.id, { name: "字母头像联系人", description: created.description }).contact;
  assert.equal(renamed.appearanceId, undefined);
  assert.equal(renamed.avatar, undefined);
});

test("清除人物外观保存失败保留原记录，以同一草稿重试后才清除", () => {
  const storage = memory();
  const created = new ContactsStore(storage).create({ name: "重试清除", description: "", appearanceId: "lumia" }).contact;
  const raw = storage.entries.get(key);
  let fail = true;
  const store = new ContactsStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("full"); storage.setItem(name, value); } });
  const draft = { name: created.name, description: created.description, appearanceId: undefined };
  assert.ok(store.update(created.id, draft).errors.form);
  assert.equal(storage.entries.get(key), raw);
  assert.deepEqual(store.contacts.at(-1), created);
  fail = false;
  assert.equal(store.update(created.id, draft).contact.id, created.id);
  assert.equal(new ContactsStore(storage).contacts.at(-1).appearanceId, undefined);
  assert.equal(new ContactsStore(storage).contacts.at(-1).avatar, undefined);
});

test("非法外观与任意头像不能进入存储，旧无外观记录仍可编辑", () => {
  const storage = memory();
  const store = new ContactsStore(storage);
  const created = store.create({ name: "旧联系人", description: "旧记录" }).contact;
  const before = storage.entries.get(key);
  for (const appearanceId of ["unknown", "https://remote.test/photo", "../lumia", null, {}, ["lumia"]]) {
    assert.ok(store.update(created.id, { name: created.name, description: "", appearanceId }).errors.appearanceId);
    assert.equal(storage.entries.get(key), before);
    assert.equal(store.reload(JSON.stringify({ version: 1, contacts: [{ ...created, appearanceId }] })), false);
  }
  assert.equal(store.reload(JSON.stringify({ version: 1, contacts: [{ ...created, appearanceId: "rinne", avatar: "/characters/rinne-avatar.webp" }] })), false);
  const edited = new ContactsStore(storage).update(created.id, { name: created.name, description: "兼容编辑" }).contact;
  assert.equal(edited.id, created.id);
  assert.equal(edited.appearanceId, undefined);
  assert.equal(edited.avatar, undefined);
});
