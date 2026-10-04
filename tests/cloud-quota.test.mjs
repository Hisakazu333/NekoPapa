import test from "node:test";
import assert from "node:assert/strict";
import { cloudAccountContractModule, configurationContractModule, settingsUsageViewModule, settingsAccountViewModule } from "./helpers/production.mjs";

const { cloudQuotaPercentage, cloudPointCount, quotaPercentage, quotaResetTime } = cloudAccountContractModule;
const view = () => ({ data: configurationContractModule.configurationDefaults(), drafts: {}, queries: {}, notice: "", storageAvailable: true });
const quota = (values = {}) => ({ remaining: 24.12345, total: 100, used: 75.87655, periodLabel: "验证周期", resetsAt: "2026-10-12T00:00:00+08:00", ...values });

test("未接入账号服务不展示虚假的余额、百分比或重置周期", () => {
  assert.equal(cloudQuotaPercentage(), undefined);
  assert.equal(cloudPointCount(), "—");
  assert.equal(quotaPercentage(), "—");
  assert.equal(quotaResetTime(), "—");
  const html = settingsUsageViewModule.cloudUsageSettings(view());
  assert.match(html, /尚未连接账号服务/);
  assert.match(html, /暂无账单数据/);
  assert.doesNotMatch(html, /aria-valuenow|手动预算|data-config-form="usage"|0%|100%|累计发放|NekoBuddy|Pro 100/);
});

test("剩余百分比依据本期配额，金额、周期和重置时间来自展示契约", () => {
  const data = view(); data.cloudQuota = quota();
  assert.equal(cloudQuotaPercentage(data.cloudQuota), 24.12345);
  assert.equal(quotaPercentage(cloudQuotaPercentage(data.cloudQuota)), "24.1%");
  assert.equal(cloudPointCount(data.cloudQuota.remaining), "24.12345");
  const html = settingsUsageViewModule.cloudUsageSettings(data);
  for (const amount of ["24.12345", "75.87655", "验证周期", "24.1%", quotaResetTime(data.cloudQuota.resetsAt)]) assert.ok(html.includes(amount));
  data.cloudQuota = quota({ remaining: 50, used: 50 });
  assert.match(settingsUsageViewModule.cloudUsageSettings(data), /剩余额度 50%/);
  data.cloudQuota.periodLabel = '<script>untrusted</script>';
  assert.doesNotMatch(settingsUsageViewModule.cloudUsageSettings(data), /<script>/);
});

test("缺失、零配额或矛盾数据不伪造百分比，实际耗尽显示零", () => {
  for (const values of [{ total: 0 }, { total: NaN }, { remaining: Infinity }, { remaining: -1 }, { remaining: 101 }, { used: -1 }, { used: 100 }]) assert.equal(cloudQuotaPercentage(quota(values)), undefined);
  assert.equal(cloudQuotaPercentage(quota({ remaining: 0, used: 100 })), 0);
  assert.equal(cloudQuotaPercentage(quota({ remaining: 100, used: 0 })), 100);
  assert.equal(cloudQuotaPercentage(quota({ remaining: 60, used: 30 })), 60);
  assert.equal(quotaResetTime("invalid"), "—");
  assert.equal(quotaPercentage(0), "0%");
  assert.equal(cloudPointCount(0), "0");
  assert.equal(cloudPointCount(NaN), "—");
});

test("自定义 API 数量和模型来源来自配置，账号页不宣称已登录", () => {
  const data = view();
  data.data.groups.agent.modelSource = "custom";
  data.data.collections.models.push({ id: "qa-api", values: { name: "独立配置" } });
  const html = settingsUsageViewModule.cloudUsageSettings(data);
  assert.match(html, /1 个/);
  assert.match(html, /由 API 提供方计费/);
  assert.match(html, /data-settings-section="agent">自定义 API/);
  const account = settingsAccountViewModule.accountSettings(data);
  assert.match(account, /尚未登录 · 账号服务待接入/);
  assert.match(account, /disabled[^>]*>登录账号/);
  assert.match(account, /自定义 API 无需登录/);
  assert.doesNotMatch(account, /type="password"|已登录|月费|订阅套餐|NekoBuddy/);
  data.data.groups.agent.modelSource = "cloud";
  assert.match(settingsUsageViewModule.cloudUsageSettings(data), /官方云端 · 待接入/);
});
