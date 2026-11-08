import test from "node:test";
import assert from "node:assert/strict";
import { configurationStoreModule, configurationContractModule, configurationTypesModule, localProfileModule } from "./helpers/production.mjs";

const { ConfigurationStore } = configurationStoreModule;
const { configurationDefaults } = configurationContractModule;
const { configurationKey: key } = configurationTypesModule;
const { readLocalProfile, saveLocalProfile } = localProfileModule;
const memory = (data = configurationDefaults()) => {
  const entries = new Map([[key, JSON.stringify(data)]]);
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
};

test("账号资料只保存实际编辑字段，保留同时更新的个人资料与其他设置", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  const original = readLocalProfile(store);
  const incoming = store.data;
  incoming.groups.profile.biography = "另一窗口刚保存的简介";
  incoming.groups.appearance.mode = "dark";
  assert.equal(store.reload(JSON.stringify(incoming)), true);
  assert.equal(saveLocalProfile(store, { ...original, name: "本轮名称" }, original), undefined);
  assert.equal(readLocalProfile(store).name, "本轮名称");
  assert.equal(readLocalProfile(store).biography, "另一窗口刚保存的简介");
  assert.equal(new ConfigurationStore(storage).data.groups.appearance.mode, "dark");
});

test("初次读取受阻后恢复原设置，资料保存不会清空用户未编辑的字段", () => {
  const data = configurationDefaults();
  data.groups.profile.name = "原用户名";
  data.groups.profile.biography = "需要保留的简介";
  data.groups.profile.website = "https://example.test";
  data.groups.git.branchPrefix = "keep/";
  const storage = memory(data);
  let blocked = true;
  const store = new ConfigurationStore({
    getItem: (name) => { if (blocked) throw new Error("blocked"); return storage.getItem(name); },
    setItem: storage.setItem,
  });
  const original = readLocalProfile(store);
  const draft = { ...original, name: "恢复后的修改" };
  assert.ok(saveLocalProfile(store, draft, original).form);
  assert.deepEqual(JSON.parse(storage.entries.get(key)), data);
  blocked = false;
  assert.equal(saveLocalProfile(store, draft, original), undefined);
  const restored = new ConfigurationStore(storage).data;
  assert.deepEqual(restored.groups.profile, { ...data.groups.profile, name: "恢复后的修改" });
  assert.equal(restored.groups.git.branchPrefix, "keep/");
});

test("资料校验与写入失败不报告成功；重试保留本轮草稿并写入完整配置", () => {
  const storage = memory();
  let failWrites = false;
  const store = new ConfigurationStore({
    getItem: storage.getItem,
    setItem: (name, value) => { if (failWrites) throw new Error("full"); storage.setItem(name, value); },
  });
  const original = readLocalProfile(store);
  const saved = storage.entries.get(key);
  assert.ok(saveLocalProfile(store, { ...original, name: " " }, original).name);
  assert.ok(saveLocalProfile(store, { ...original, website: "not a URL" }, original).website);
  assert.equal(storage.entries.get(key), saved);
  const draft = { ...original, name: "待保存资料" };
  failWrites = true;
  assert.ok(saveLocalProfile(store, draft, original).form);
  assert.equal(storage.entries.get(key), saved);
  assert.equal(readLocalProfile(store).name, draft.name);
  failWrites = false;
  assert.equal(saveLocalProfile(store, draft, original), undefined);
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, draft.name);
});
