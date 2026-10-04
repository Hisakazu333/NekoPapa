import { cloudQuotaPercentage, cloudPointCount, quotaPercentage, quotaResetTime } from "./cloud-account-contract";
import { icon } from "./icons";
import { escapeHtml } from "./view-shared";
import type { ConfigurationView } from "./configuration-types";

export function cloudUsageSettings(view: ConfigurationView): string {
  const quota = view.cloudQuota;
  const percentage = cloudQuotaPercentage(quota);
  const models = view.data.collections.models;
  const cloudSource = view.data.groups.agent.modelSource === "cloud";
  const metrics = [
    ["本期配额", quota?.total],
    ["已使用", quota?.used],
    ["剩余额度", quota?.remaining],
  ] as const;
  const progress = percentage === undefined
    ? '<div class="cloud-quota-track is-unavailable" aria-label="云点比例暂无数据"></div>'
    : `<div class="cloud-quota-track" role="progressbar" aria-label="本期云点剩余额度百分比"
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"
        aria-valuetext="剩余额度 ${quotaPercentage(percentage)}">
        <span style="width:${percentage}%"></span></div>`;
  return `
    <section class="cloud-quota-section" aria-label="账号云点额度">
      <div class="cloud-quota-heading">
        <div><span>官方云端服务 · 可选</span><h2>云点额度</h2></div>
        <button class="settings-small-button" type="button" data-settings-section="account">管理账号${icon("right")}</button>
      </div>
      <div class="cloud-quota-card">
        <div class="cloud-quota-primary">
          <div><span>剩余额度</span><strong>${quotaPercentage(percentage)}</strong></div>
          <div class="cloud-quota-summary"><span>${quota ? escapeHtml(quota.periodLabel || "本期云点配额") : "尚未连接账号服务"}</span>
            <small>${quota ? "本期剩余 / 本期配额" : "连接后显示实际配额"}</small></div>
        </div>
        ${progress}
        <dl class="cloud-quota-metrics">${metrics.map(([label, value]) => `
          <div><dt>${label}</dt><dd>${cloudPointCount(value)}<small>云点</small></dd></div>`).join("")}
          <div><dt>下次重置</dt><dd>${quotaResetTime(quota?.resetsAt)}<small>${quota?.resetsAt ? "本机时间" : "待获取"}</small></dd></div></dl>
      </div>
      <p class="settings-footnote">配额和重置时间以云点服务返回的数据为准。自定义 API 由提供方计费，单独使用，无需登录云端账号。</p>
    </section>
    <section class="settings-block" aria-label="自定义 API 使用方式">
      <div class="settings-section-heading"><div><h2>自定义 API</h2><p>使用你自己的模型服务，由 API 提供方计费。</p></div>
        <button class="settings-small-button" type="button" data-settings-section="models">管理 API${icon("right")}</button></div>
      <div class="settings-option-group">
        <div class="settings-option"><div class="settings-option-copy"><span>默认模型来源</span><p>可以在 Agent 配置中切换。</p></div>
          <button class="settings-small-button" type="button" data-settings-section="agent">${cloudSource ? "官方云端 · 待接入" : "自定义 API"}${icon("right")}</button></div>
        <div class="settings-option"><div class="settings-option-copy"><span>已保存的 API 配置</span><p>服务地址、模型标识与凭据引用保存在本机。</p></div>
          <span class="settings-value">${models.length} 个</span></div>
      </div>
    </section>
    <section class="settings-block" aria-label="云点账单">
      <div class="settings-section-heading"><div><h2>云点账单</h2><p>发放、消耗和模型使用明细。</p></div><span class="settings-badge">账号服务待接入</span></div>
      <div class="settings-list-empty">${icon("usage")}<strong>暂无账单数据</strong><p>接入账号服务后显示真实云点流水。</p></div>
    </section>`;
}
