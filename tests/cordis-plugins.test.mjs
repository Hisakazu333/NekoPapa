import test from "node:test";
import assert from "node:assert/strict";
import { configurationContractModule, configurationStoreModule, configurationTypesModule, cordisPluginsModule } from "./helpers/production.mjs";

const { ConfigurationStore } = configurationStoreModule;
const { validateConfiguration, validateRecord } = configurationContractModule;
const { configurationKey: key } = configurationTypesModule;
const { cordisPatch, duplicateInstanceIds } = cordisPluginsModule;
const memory = () => {
  const entries = new Map();
  return { entries, getItem: (name) => entries.get(name) ?? null, setItem: (name, value) => entries.set(name, value) };
};
const plugin = (values = {}) => ({ name: "测试插件", source: "local", module: "/tmp/nekopapa-test/plugin.ts", instanceId: "", enabled: true, config: "", ...values });

test("Cordis 插件是独立集合：保存到本机，旧数据和旧备份缺少该集合时为空", () => {
  const storage = memory();
  const store = new ConfigurationStore(storage);
  assert.deepEqual(store.data.collections.plugins, []);
  assert.equal(store.saveRecord("plugins", plugin({ instanceId: "test-1" })), undefined);
  assert.equal(store.data.collections.plugins.length, 1);
  assert.equal(store.data.collections.extensions.length, 0);
  assert.equal(JSON.parse(storage.entries.get(key)).collections.plugins[0].values.instanceId, "test-1");
  const old = validateConfiguration({ version: 1, groups: {}, collections: { extensions: [] } });
  assert.equal(old.ok, true);
  assert.deepEqual(old.value.collections.plugins, []);
});

test("Cordis 插件来源校验：本地模块需绝对路径，npm 需合法包名，实例 ID 限定字符", () => {
  assert.equal(validateRecord("plugins", plugin()).ok, true);
  assert.equal(validateRecord("plugins", plugin({ module: "~/plugins/a.ts" })).ok, true);
  assert.equal(validateRecord("plugins", plugin({ module: "plugins/a.ts" })).errors.module !== undefined, true);
  assert.equal(validateRecord("plugins", plugin({ source: "npm", module: "@scope/dsh-plugin-x" })).ok, true);
  assert.equal(validateRecord("plugins", plugin({ source: "npm", module: "Bad Name" })).ok, false);
  assert.equal(validateRecord("plugins", plugin({ instanceId: "a b" })).errors.instanceId !== undefined, true);
  assert.equal(validateRecord("plugins", plugin({ module: "" })).ok, false);
  assert.equal(validateRecord("plugins", { ...plugin(), command: "x" }).ok, false);
});

test("Cordis 补丁按 insert 列表生成，转义引号，保留配置缩进并标出停用", () => {
  const records = [
    { id: "a", values: plugin({ instanceId: "hello", module: "/tmp/it's/a.ts", config: "greeting: hi\nlist:\n  - 1" }) },
    { id: "b", values: plugin({ source: "npm", module: "@scope/dsh-plugin-x", enabled: false }) },
  ];
  assert.equal(cordisPatch(records), [
    "- insert:",
    "    - id: 'hello'",
    "      name: '/tmp/it''s/a.ts'",
    "      config:",
    "        greeting: hi",
    "        list:",
    "          - 1",
    "    - name: '@scope/dsh-plugin-x'",
    "      disabled: true",
    "",
  ].join("\n"));
  assert.equal(cordisPatch([]), "");
  assert.deepEqual(duplicateInstanceIds([records[0], { id: "c", values: plugin({ instanceId: "hello" }) }, records[1]]), ["hello"]);
});
