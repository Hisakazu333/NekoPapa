import test from "node:test";
import assert from "node:assert/strict";
import { configurationStoreModule, configurationContractModule, configurationTypesModule } from "./helpers/production.mjs";

const { ConfigurationStore } = configurationStoreModule;
const { configurationDefaults, validateConfiguration, validateFields, parseConfigurationBackup, exportConfiguration, configurationSchemas } = configurationContractModule;
const { configurationKey: key } = configurationTypesModule;
const memory = (data) => {
  const entries = new Map(data ? [[key, JSON.stringify(data)]] : []);
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
};
const model = (name = "测试模型") => ({ name, provider: "compatible", endpoint: "http://127.0.0.1:1234/v1", model: "test-model", environment: "TEST_MODEL_KEY" });

test("设置默认值无生产样例、无在线连接，与工作台键独立", () => {
  const storage = memory();
  storage.entries.set("nekopapa.workspace.v1", "保留的工作台");
  const store = new ConfigurationStore(storage);
  assert.deepEqual(store.data.collections, { models: [], extensions: [], plugins: [], connections: [], hooks: [] });
  assert.equal(store.data.groups.usage, undefined);
  assert.equal(store.data.groups.agent.modelSource, "custom");
  assert.equal(store.data.groups.computer.enabled, false);
  assert.equal(store.data.groups.history.policy, "off");
  assert.equal(store.saveGroup("profile", { ...store.data.groups.profile, name: "本机用户" }), undefined);
  assert.equal(storage.entries.get("nekopapa.workspace.v1"), "保留的工作台");
});

test("每类配置均可完整校验，新增字段在旧版本 1 数据中使用默认值", () => {
  assert.equal(validateConfiguration(configurationDefaults()).ok, true);
  const old = validateConfiguration({ version: 1, groups: { profile: { name: "旧资料" } }, collections: {} });
  assert.equal(old.ok, true);
  assert.equal(old.value.groups.profile.name, "旧资料");
  assert.equal(old.value.groups.appearance.mode, "system");
  assert.equal(Object.keys(old.value.groups).length, 19);
  // Backups written before the General, privacy and development pages existed load their defaults.
  assert.equal(old.value.groups.general.sendKey, "enter");
  assert.equal(old.value.groups.general.defaultMode, "auto");
  assert.equal(old.value.groups.general.projectFolder, "inherit");
  const generalFields = configurationSchemas.find((schema) => schema.id === "general").blocks.flatMap((block) => block.fields);
  assert.equal(validateFields(generalFields, { ...configurationDefaults().groups.general, defaultMode: "professional" }).ok, false);
  assert.equal(old.value.groups.privacy.usageStats, false);
  assert.equal(old.value.groups.permissions.mode, "ask");
  assert.equal(old.value.groups.permissions.deny, "rm -rf");
  assert.equal(old.value.groups.context.compactThreshold, 85);
  assert.equal(old.value.groups.editor.shell, "system");
  const outOfRange = validateConfiguration({ version: 1, groups: { context: { compactThreshold: 120 } }, collections: {} });
  assert.equal(outOfRange.ok, false);
});

test("运行类设置显式声明适合的 BoardUI 控件，不依赖字段名猜测", () => {
  const controls = new Map();
  for (const schema of configurationSchemas) {
    for (const field of schema.blocks.flatMap((block) => block.fields)) {
      if (field.control) controls.set(`${schema.id}.${field.key}`, field.control);
      if (["segmented", "select"].includes(field.control)) assert.equal(field.type, "select");
      if (field.control === "switch") assert.equal(field.type, "boolean");
      // Segmented choices sit on the right of a settings row, so their labels stay short.
      if (field.control === "segmented") assert.ok(field.options.reduce((total, [, name]) => total + name.length, 0) <= 10, `${schema.id}.${field.key}`);
      for (const option of Object.keys(field.optionHints ?? {})) assert.ok(field.options?.some(([id]) => id === option), `${schema.id}.${field.key}.${option}`);
      if (field.control === "tags") assert.equal(field.type, "textarea");
      if (field.control === "slider" || field.control === "number") assert.equal(field.type, "number");
      if (field.control === "directory") assert.equal(field.type, "text");
      if (field.control === "textarea") assert.equal(field.type, "textarea");
    }
  }
  assert.equal(controls.get("desktop.scale"), "slider");
  assert.equal(controls.get("desktop.opacity"), "slider");
  assert.equal(controls.get("worktrees.limit"), "number");
  assert.equal(controls.get("coding.directory"), "directory");
  assert.equal(controls.get("agent.reasoning"), "segmented");
  assert.equal(controls.get("agent.modelSource"), "select");
  assert.equal(controls.get("computer.applications"), "tags");
  assert.equal(controls.get("history.excluded"), "tags");
  assert.equal(controls.get("agent.approval"), "segmented");
  assert.equal(controls.get("computer.confirmation"), "select");
  assert.equal(controls.get("desktop.alwaysOnTop"), "switch");
  assert.equal(controls.get("permissions.allow"), "tags");
  assert.equal(controls.get("context.compactThreshold"), "slider");
  assert.equal(controls.get("editor.diff"), "segmented");
  assert.equal(controls.get("git.commitInstructions"), "textarea");
});

test("旧外观语言可兼容读取但不再进入设置配置或导出备份", () => {
  const legacy = configurationDefaults();
  legacy.groups.appearance.language = "en-US";
  const restored = validateConfiguration(legacy);
  assert.equal(restored.ok, true);
  assert.equal(Object.hasOwn(restored.value.groups.appearance, "language"), false);
  assert.equal(Object.hasOwn(configurationDefaults().groups.appearance, "language"), false);
  assert.equal(Object.hasOwn(JSON.parse(exportConfiguration(restored.value)).data.groups.appearance, "language"), false);
  legacy.groups.appearance.language = "ja";
  assert.equal(validateConfiguration(legacy).ok, false);
});

test("保存外观、资料、Git 与桌面偏好后重载保持，不修改其他域", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  for (const [group, values] of [["profile", { name: "验证用户" }], ["appearance", { mode: "dark", accent: "blue" }], ["git", { branchPrefix: "feature/" }], ["desktop", { scale: "1.5", opacity: "80" }]]) {
    assert.equal(store.saveGroup(group, { ...store.data.groups[group], ...values }), undefined);
  }
  const restored = new ConfigurationStore(storage);
  assert.equal(restored.data.groups.profile.name, "验证用户");
  assert.equal(restored.data.groups.appearance.mode, "dark");
  assert.equal(restored.data.groups.desktop.scale, 1.5);
  assert.equal(restored.data.groups.desktop.opacity, 80);
  assert.equal(restored.data.groups.git.branchPrefix, "feature/");
  assert.deepEqual(restored.data.groups.agent, configurationDefaults().groups.agent);
});

test("无效枚举、空白数值、越界与非整数不覆盖有效设置", () => {
  const store = new ConfigurationStore(memory());
  const before = store.data;
  for (const [group, values] of [["appearance", { mode: "missing" }], ["desktop", { scale: "" }], ["desktop", { opacity: 101 }], ["worktrees", { limit: 1.5 }], ["profile", { name: " " }]]) {
    assert.ok(store.saveGroup(group, { ...store.data.groups[group], ...values }));
    assert.deepEqual(store.data, before);
  }
});

test("凭据只接受环境变量引用，服务地址拒绝嵌入凭据和查询密钥", () => {
  const store = new ConfigurationStore(memory());
  for (const endpoint of ["file:///tmp/data", "https://user:password@example.test", "https://example.test?api_key=anything", "https://example.test#token", "not-a-url"]) assert.ok(store.saveRecord("models", { ...model(), endpoint }));
  assert.ok(store.saveRecord("models", { ...model(), environment: "contains secret value" }));
  assert.ok(store.saveRecord("models", { ...model(), apiKey: "unrecognized" }));
  assert.equal(store.data.collections.models.length, 0);
});

test("模型配置编辑保留同一 ID，默认模型引用与重载一致", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  assert.equal(store.saveRecord("models", model()), undefined);
  const id = store.data.collections.models[0].id;
  assert.equal(store.saveGroup("agent", { ...store.data.groups.agent, modelId: id }), undefined);
  assert.equal(store.saveRecord("models", { ...model(), model: "changed-model" }, id), undefined);
  const restored = new ConfigurationStore(storage);
  assert.equal(restored.data.collections.models.length, 1);
  assert.equal(restored.data.collections.models[0].id, id);
  assert.equal(restored.data.collections.models[0].values.model, "changed-model");
  assert.equal(restored.data.groups.agent.modelId, id);
  assert.ok(restored.saveGroup("coding", { ...restored.data.groups.coding, modelId: "missing" }));
});

test("删除模型取消引用，撤销恢复原 ID、顺序与默认模型", () => {
  const store = new ConfigurationStore(memory());
  store.saveRecord("models", model("一")); store.saveRecord("models", model("二"));
  const id = store.data.collections.models[0].id;
  for (const group of ["agent", "coding"]) store.saveGroup(group, { ...store.data.groups[group], modelId: id });
  assert.equal(store.removeRecord("models", id), true);
  assert.equal(store.data.groups.agent.modelId, "");
  assert.equal(store.data.groups.coding.modelId, "");
  assert.equal(store.restoreRemoved(), true);
  assert.equal(store.data.collections.models[0].id, id);
  assert.equal(store.data.groups.agent.modelId, id);
  assert.equal(store.data.groups.coding.modelId, id);
  assert.equal(store.restoreRemoved(), false);
});

test("撤销删除不会覆盖期间重新指定的默认模型", () => {
  const store = new ConfigurationStore(memory());
  store.saveRecord("models", model("一")); store.saveRecord("models", model("二"));
  const [first, second] = store.data.collections.models;
  store.saveGroup("agent", { ...store.data.groups.agent, modelId: first.id });
  store.removeRecord("models", first.id);
  store.saveGroup("agent", { ...store.data.groups.agent, modelId: second.id });
  store.restoreRemoved();
  assert.equal(store.data.groups.agent.modelId, second.id);
});

test("MCP 本地和 HTTP 路径必填，切换后清除旧传输路径", () => {
  const store = new ConfigurationStore(memory());
  const values = { name: "验证工具", kind: "mcp", transport: "stdio", command: "", endpoint: "", environment: "" };
  assert.ok(store.saveRecord("extensions", values));
  assert.equal(store.saveRecord("extensions", { ...values, command: "test-command" }), undefined);
  const id = store.data.collections.extensions[0].id;
  assert.equal(store.saveRecord("extensions", { ...values, transport: "http", command: "old-command", endpoint: "https://example.test/mcp" }, id), undefined);
  assert.equal(store.data.collections.extensions[0].values.command, "");
});

test("SSH 与钩子配置验证地址、端口、用户名和超时，无执行副作用", () => {
  const store = new ConfigurationStore(memory());
  const ssh = { name: "测试主机", host: "localhost", port: "22", username: "qa", identity: "" };
  assert.equal(store.saveRecord("connections", ssh), undefined);
  for (const change of [{ host: "https://example.test" }, { port: "0" }, { port: "65536" }, { username: "" }]) assert.ok(store.saveRecord("connections", { ...ssh, ...change }));
  const hook = { name: "结束钩子", event: "run-end", command: "test-command", timeout: 30 };
  assert.equal(store.saveRecord("hooks", hook), undefined);
  assert.ok(store.saveRecord("hooks", { ...hook, timeout: 301 }));
  assert.equal(store.data.collections.connections.length, 1);
  assert.equal(store.data.collections.hooks.length, 1);
});

test("编辑已消失记录不会重建对象，配置快照不允许外部写入", () => {
  const store = new ConfigurationStore(memory());
  assert.ok(store.saveRecord("models", model(), "missing"));
  const snapshot = store.data;
  snapshot.groups.profile.name = "外部修改";
  snapshot.collections.models.push({ id: "injected", values: model() });
  assert.equal(store.data.groups.profile.name, "NekoPapa 用户");
  assert.equal(store.data.collections.models.length, 0);
});

test("写入失败保留本轮设置、旧持久化值不变，重试后可恢复", () => {
  const storage = memory(configurationDefaults());
  let fail = true;
  const store = new ConfigurationStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail) throw new Error("full"); storage.setItem(name, value); } });
  store.saveGroup("profile", { ...store.data.groups.profile, name: "待保存" });
  assert.equal(store.storageAvailable, false);
  assert.equal(store.data.groups.profile.name, "待保存");
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, "NekoPapa 用户");
  fail = false; assert.equal(store.persist(), true);
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, "待保存");
});

test("损坏设置先保存原文，备份失败不允许覆盖源数据", () => {
  const storage = memory(); storage.entries.set(key, "损坏的 JSON");
  let fail = true;
  const store = new ConfigurationStore({ getItem: storage.getItem, setItem: (name, value) => { if (fail && name.endsWith(".recovery")) throw new Error("full"); storage.setItem(name, value); } });
  assert.ok(store.saveGroup("profile", { ...store.data.groups.profile, name: "不应写入" }));
  assert.equal(storage.entries.get(key), "损坏的 JSON");
  assert.equal(store.persist(), false);
  fail = false; assert.equal(store.persist(), true);
  assert.equal(storage.entries.get(`${key}.recovery`), "损坏的 JSON");
  assert.equal(store.data.groups.profile.name, "NekoPapa 用户");
});

test("初始读取被阻止后重试会读取原有效数据，不能覆盖为默认值", () => {
  const data = configurationDefaults(); data.groups.profile.name = "原用户";
  const storage = memory(data); let fail = true;
  const store = new ConfigurationStore({ getItem: (name) => { if (fail) throw new Error("blocked"); return storage.getItem(name); }, setItem: storage.setItem });
  assert.ok(store.saveGroup("profile", { ...store.data.groups.profile, name: "无效覆盖" }));
  fail = false; assert.equal(store.persist(), true);
  assert.equal(store.data.groups.profile.name, "原用户");
});

test("导入预览解析不更改存储，确认替换前保留完整设置备份", () => {
  const storage = memory(); const store = new ConfigurationStore(storage);
  store.saveRecord("models", model());
  const before = store.data;
  const incoming = configurationDefaults(); incoming.groups.profile.name = "导入资料";
  const preview = parseConfigurationBackup(exportConfiguration(incoming));
  assert.equal(preview.ok, true);
  assert.deepEqual(store.data, before);
  assert.equal(store.replace(preview.value), true);
  assert.deepEqual(JSON.parse(store.previousBackup), before);
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, "导入资料");
});

test("替换前备份失败时不丢弃现有设置，原始持久化数据保持不变", () => {
  const data = configurationDefaults(); data.groups.profile.name = "保留";
  const storage = memory(data);
  const store = new ConfigurationStore({ getItem: storage.getItem, setItem: (name, value) => { if (name.endsWith(".previous")) throw new Error("full"); storage.setItem(name, value); } });
  assert.equal(store.replace(configurationDefaults()), false);
  assert.equal(store.data.groups.profile.name, "保留");
  assert.equal(new ConfigurationStore(storage).data.groups.profile.name, "保留");
});

test("备份拒绝未知版本、未知字段、重复 ID、失效模型引用与超大文件", () => {
  assert.equal(parseConfigurationBackup("{broken").ok, false);
  const valid = JSON.parse(exportConfiguration(configurationDefaults()));
  assert.equal(parseConfigurationBackup(JSON.stringify({ ...valid, version: 2 })).ok, false);
  assert.equal(parseConfigurationBackup(JSON.stringify({ ...valid, secret: "unexpected" })).ok, false);
  const secret = configurationDefaults(); secret.groups.agent.apiKey = "unexpected";
  assert.equal(parseConfigurationBackup(exportConfiguration(secret)).ok, false);
  const duplicate = configurationDefaults(); duplicate.collections.models = [{ id: "same", values: model() }, { id: "same", values: model() }];
  assert.equal(validateConfiguration(duplicate).ok, false);
  const stale = configurationDefaults(); stale.groups.agent.modelId = "missing";
  assert.equal(validateConfiguration(stale).ok, false);
  assert.equal(parseConfigurationBackup(" ".repeat(1024 * 1024 + 1)).ok, false);
});

test("外部窗口同步接受有效数据，损坏或未知契约保持当前值", () => {
  const store = new ConfigurationStore(memory());
  const changed = configurationDefaults(); changed.groups.profile.name = "外部窗口";
  assert.equal(store.reload(JSON.stringify(changed)), true);
  assert.equal(store.reload("invalid"), false);
  assert.equal(store.reload(JSON.stringify({ ...changed, version: 2 })), false);
  assert.equal(store.data.groups.profile.name, "外部窗口");
});

test("旧预览手动 Token 预算被丢弃，资料和自定义 API 的 ID 保留", () => {
  const data = configurationDefaults();
  data.groups.profile.name = "已有资料";
  data.collections.models.push({ id: "saved-api", values: model() });
  data.groups.agent.modelId = "saved-api";
  delete data.groups.agent.modelSource;
  data.groups.usage = { period: "weekly", limit: 1000, used: 900, resetDate: "2026-10-12" };
  const result = validateConfiguration(data);
  assert.equal(result.ok, true);
  assert.equal(result.value.groups.usage, undefined);
  assert.equal(result.value.groups.profile.name, "已有资料");
  assert.equal(result.value.collections.models[0].id, "saved-api");
  assert.equal(result.value.groups.agent.modelSource, "custom");
  assert.equal(result.value.groups.agent.modelId, "saved-api");
  data.groups.usage.apiKey = "unexpected";
  assert.equal(validateConfiguration(data).ok, false);
});

test("技能目录不能通过导入变成 HTTP 服务", () => {
  const store = new ConfigurationStore(memory());
  assert.ok(store.saveRecord("extensions", { name: "目录", kind: "skill", transport: "http", command: "", endpoint: "https://example.test/skill", environment: "" }));
  assert.equal(store.data.collections.extensions.length, 0);
});

test("未落盘的设置不会被外部同步丢弃", () => {
  const storage = memory(configurationDefaults());
  const store = new ConfigurationStore({ getItem: storage.getItem, setItem: () => { throw new Error("full"); } });
  store.saveGroup("profile", { ...store.data.groups.profile, name: "待保存" });
  assert.equal(store.reload(JSON.stringify(configurationDefaults())), false);
  assert.equal(store.data.groups.profile.name, "待保存");
  assert.equal(store.storageAvailable, false);
});

test("模型配置的密钥来源：旧记录按环境变量读取，新值只接受三种来源，不保存密钥本身", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  assert.equal(store.saveRecord("models", model()), undefined);
  assert.equal(store.data.collections.models[0].values.keySource, "environment");
  assert.equal(store.saveRecord("models", { ...model("钥匙串"), keySource: "keychain", environment: "" }), undefined);
  assert.equal(store.data.collections.models[1].values.keySource, "keychain");
  assert.ok(store.saveRecord("models", { ...model(), keySource: "plaintext" }));
  assert.ok(store.saveRecord("models", { ...model(), keySource: "keychain", apiKey: "sk-should-never-be-stored" }));
  const restored = new ConfigurationStore(storage);
  assert.equal(restored.data.collections.models.length, 2);
  assert.doesNotMatch(JSON.stringify(restored.data), /sk-should-never-be-stored/);
});


test("one model connection round-trips multiple IDs under its original credential identity", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  assert.equal(store.saveRecord("models", { ...model(), keySource: "keychain", additionalModels: "model-b\nmodel-c\ntest-model\nmodel-b" }), undefined);
  const [saved] = store.data.collections.models;
  const restored = new ConfigurationStore(storage).data.collections.models;
  assert.deepEqual(restored, [saved]);
  assert.equal(saved.values.additionalModels, "model-b\nmodel-c");
  assert.equal(saved.values.model, "test-model");
  assert.equal(saved.values.keySource, "keychain");
  assert.ok(store.saveRecord("models", { ...saved.values, additionalModels: "a".repeat(161) }, saved.id)?.model);
  assert.equal(store.data.collections.models[0].values.additionalModels, "model-b\nmodel-c");
});
