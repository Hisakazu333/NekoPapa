import { icon } from "./icons";
import { escapeHtml } from "./view-shared";
import { settingRow } from "./settings-form-view";
import type { ConfigurationView } from "./configuration-types";

export function accountSettings(view: ConfigurationView): string {
  const profile = view.data.groups.profile;
  const cloud = view.data.groups.agent.modelSource === "cloud";
  const link = (title: string, section: string) => `<button class="settings-small-button" type="button" data-settings-section="${section}">${title}${icon("right")}</button>`;
  return `
    <section class="settings-account-card" aria-label="云端账号">
      <div class="settings-account-mark">${icon("user")}</div>
      <div class="settings-account-copy"><h2>云端账号</h2><p>官方云点服务为可选项；使用自定义 API 无需登录。</p><span class="settings-badge">尚未登录 · 账号服务待接入</span></div>
      <button class="primary-button" type="button" disabled title="账号服务尚未接入">登录账号</button>
    </section>
    <section class="settings-block"><h2>模型服务</h2><div class="settings-option-group">
      ${settingRow("云点额度", "查看官方云端服务的实际配额与消耗。", link("查看额度", "usage"))}
      ${settingRow("自定义 API", "配置你自己的服务地址、模型与凭据引用。", link("管理 API", "models"))}
      ${settingRow("默认模型来源", "为新运行选择自定义 API 或官方云端服务。", link(cloud ? "官方云端 · 待接入" : "自定义 API", "agent"))}
    </div></section>
    <section class="settings-block"><h2>本机资料与数据</h2><div class="settings-option-group">
      ${settingRow("显示名称", "当前设备使用的个人资料。", link(escapeHtml(String(profile.name)), "profile"))}
      ${settingRow("数据与备份", "管理本机设置、配置引用和工作台索引。", link("管理备份", "data"))}
    </div></section>`;
}
