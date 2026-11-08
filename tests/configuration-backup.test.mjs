import test from "node:test";
import assert from "node:assert/strict";
import { configurationStoreModule, configurationContractModule, configurationTypesModule } from "./helpers/production.mjs";

const { ConfigurationStore } = configurationStoreModule;
const { configurationDefaults, exportConfiguration, parseConfigurationBackup } = configurationContractModule;
const { configurationKey } = configurationTypesModule;

function memory(data = configurationDefaults()) {
  const entries = new Map([[configurationKey, JSON.stringify(data)]]);
  return { entries, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test("设置备份只导出原配置格式；确认导入不触碰聊天、附件或旧工作台", () => {
  const storage = memory();
  for (const [key, value] of [
    ["nekopapa:chat-threads:v1", '{"用户聊天":"保留"}'],
    ["boardui:agent-chat-threads", '["旧聊天"]'],
    ["nekopapa.workspace-shell.v1", '{"内容ID":"保留"}'],
    ["nekopapa:attachments", '{"文件":"保留"}'],
  ]) storage.entries.set(key, value);
  const unrelated = [...storage.entries].filter(([key]) => key !== configurationKey);
  const store = new ConfigurationStore(storage);
  const backup = JSON.parse(exportConfiguration(store.data));
  assert.deepEqual(Object.keys(backup).sort(), ["format", "version", "exportedAt", "data"].sort());
  assert.equal(backup.format, "NekoPapa settings");
  assert.deepEqual(Object.keys(backup.data).sort(), ["version", "groups", "collections"].sort());
  backup.data.groups.profile.name = "恢复的本机资料";
  const parsed = parseConfigurationBackup(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  assert.deepEqual([...storage.entries].filter(([key]) => key !== configurationKey), unrelated);
  assert.equal(store.replace(parsed.value), true);
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, "恢复的本机资料");
  for (const [key, value] of unrelated) assert.equal(storage.entries.get(key), value);
  assert.equal(JSON.parse(store.previousBackup).groups.profile.name, "NekoPapa 用户");
});

test("导入已确认但落盘失败时，重试只保存当前配置且保留最初替换前备份", () => {
  const storage = memory();
  const original = storage.entries.get(configurationKey);
  let fail = true;
  const store = new ConfigurationStore({
    getItem: storage.getItem,
    setItem(key, value) {
      if (key === configurationKey && fail) throw new Error("storage full");
      storage.setItem(key, value);
    },
  });
  const incoming = configurationDefaults();
  incoming.groups.profile.name = "已确认的设置";
  assert.equal(store.replace(incoming), true);
  assert.equal(store.storageAvailable, false);
  assert.equal(store.data.groups.profile.name, "已确认的设置");
  assert.equal(storage.entries.get(configurationKey), original);
  const previous = store.previousBackup;
  assert.equal(previous, original);
  fail = false;
  assert.equal(store.persist(), true);
  assert.equal(store.previousBackup, previous);
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, "已确认的设置");
});

test("主题模式保存使用最新外观字段，不清空旧工作台偏好或其他配置", () => {
  const existing = configurationDefaults();
  existing.groups.profile.name = "保留的用户";
  existing.groups.appearance = { mode: "system", accent: "purple", font: "serif", density: "compact", reducedMotion: true };
  const storage = memory(existing);
  const store = new ConfigurationStore(storage);
  assert.equal(store.saveGroup("appearance", { ...store.data.groups.appearance, mode: "dark" }), undefined);
  const restored = new ConfigurationStore(storage).data;
  assert.deepEqual(restored.groups.appearance, { ...existing.groups.appearance, mode: "dark" });
  assert.equal(restored.groups.profile.name, existing.groups.profile.name);
  assert.deepEqual(restored.collections, existing.collections);
  assert.deepEqual(restored.groups.agent, existing.groups.agent);
});
