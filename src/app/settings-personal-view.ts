import { icon } from "./icons";
import { escapeHtml } from "./view-shared";
import { companionById } from "./companion-model";
import { renderCompanionAvatar } from "./companion-view";
import { settingsShortcuts } from "./settings-model";
import type { WorkspaceStore } from "./state";
import type { ConfigurationView, ConfigurationGroup } from "./configuration-types";
import { configurationForm, settingRow, configurationStatus } from "./settings-form-view";

const size = (value: unknown) => `${(new TextEncoder().encode(JSON.stringify(value)).length / 1024).toFixed(1)} KiB`;
const action = (label: string, name: string, extra = "") => `<button class="settings-small-button" type="button" data-config-action="${name}" data-focus="configuration-${name}" ${extra}>${label}</button>`;

export function personalConfigurationPage(group: ConfigurationGroup, store: WorkspaceStore, view: ConfigurationView): string {
  let preview = "";
  if (group === "profile") {
    const profile = view.data.groups.profile;
    preview = `<div class="settings-profile"><span class="settings-profile-avatar">${escapeHtml(String(profile.name).slice(0, 1).toLocaleUpperCase())}</span><h2>${escapeHtml(String(profile.name))}</h2><p>${escapeHtml(String(profile.biography) || "添加个人介绍，让本机资料更完整。")}</p><span class="settings-badge">本机资料 · 未登录在线账号</span></div>`;
  } else if (group === "appearance") {
    preview = `<div class="settings-theme-preview" aria-label="主题预览"><div class="theme-mini theme-system"><i></i><span><b></b><b></b><b></b></span><small>跟随系统</small></div><div class="theme-mini theme-light"><i></i><span><b></b><b></b><b></b></span><small>浅色</small></div><div class="theme-mini theme-dark"><i></i><span><b></b><b></b><b></b></span><small>深色</small></div></div>`;
  } else if (group === "desktop") {
    const companion = companionById(store.state.selectedCompanionId)!;
    const values = view.drafts.desktop?.values ?? view.data.groups.desktop;
    preview = `<div class="settings-companion-preview"><div data-companion-preview style="transform:scale(${Math.min(2, Math.max(0.5, Number(values.scale) || 1))});opacity:${Math.min(100, Math.max(30, Number(values.opacity) || 100)) / 100}">${renderCompanionAvatar(companion)}</div><strong>${companion.name}</strong><span>头像尺寸预览 · Live2D 资源待接入</span><button class="settings-small-button" type="button" data-settings-section="characters">切换角色</button></div>`;
  }
  const empty = ["history", "voice", "browser", "worktrees", "screenshots"].includes(group) ? `<div class="settings-operation-status">${icon(group === "history" ? "clock" : group === "worktrees" ? "folder" : "layers")}<div><strong>${group === "voice" ? "没有录音记录" : group === "history" ? "没有电脑活动记录" : group === "browser" ? "没有内置浏览数据" : group === "worktrees" ? "尚未读取项目工作树" : "尚未生成应用快照"}</strong><p>${group === "browser" ? "历史记录、密码管理与清除操作将在浏览器接入后可用。" : "接入对应服务后，此处才会显示真实记录和管理操作。"}</p></div></div>` : "";
  return preview + configurationForm(group, view) + empty;
}

export function importSettings(view: ConfigurationView): string {
  const preview = view.importPreview;
  return `${configurationStatus("设置备份 · 仅导入本机设置与配置引用；保留工作台内容、角色选择、标签、归档和回收站。", true)}<section class="settings-block"><h2>从设置备份导入</h2><div class="settings-import-box">${icon("arrow")}<strong>选择 NekoPapa 设置 JSON 文件</strong><p>先校验并预览，确认后替换当前设置。替换前的配置会自动备份。</p><label class="settings-file-button">选择文件<input type="file" accept="application/json,.json" aria-label="选择设置备份文件" data-config-import /></label><small>最大 1 MiB · 不导入 API Key、密码或私钥</small></div>${view.importError ? `<p class="settings-field-error" role="alert">${escapeHtml(view.importError)}</p>` : ""}</section>${preview ? `<section class="settings-block settings-import-preview"><h2>导入预览</h2><p class="settings-block-description">文件校验通过。以下设置将替换当前本机配置。</p><div class="settings-option-group">${settingRow("个人与外观", "包括资料、主题和个性化指令。", `<span class="settings-value">${escapeHtml(String(preview.groups.profile.name))}</span>`)}${settingRow("模型与工具", "只含配置，不代表连接成功。", `<span class="settings-value">${preview.collections.models.length} 个模型 · ${preview.collections.extensions.length} 个工具</span>`)}${settingRow("设备与钩子", "不建立远程连接或执行命令。", `<span class="settings-value">${preview.collections.connections.length} 个设备 · ${preview.collections.hooks.length} 个钩子</span>`)}</div><div class="settings-form-actions"><span>工作台内容保持原样</span>${action("取消导入", "cancel-import")}<button class="primary-button" type="button" data-config-action="apply-import" data-focus="configuration-apply-import">导入这些设置</button></div></section>` : ""}<section class="settings-block"><h2>其他应用</h2><p class="settings-block-description">当前支持 NekoPapa 自身的设置备份。Claude、Cursor 等第三方配置的格式转换尚未接入。</p></section>`;
}

export function dataSettings(store: WorkspaceStore, view: ConfigurationView): string {
  return `${configurationStatus("数据保存在当前设备的应用存储中。浏览器预览和桌面客户端分别保存；当前没有云端同步服务。", true)}<section class="settings-block"><h2>导出与备份</h2><div class="settings-option-group">${settingRow("设置备份", "包含资料、主题、默认值和配置引用，可从「导入」恢复。", action("导出设置", "export-settings"))}${settingRow("工作台索引", "包含内容 ID、归属、导航、收藏、归档和回收站；当前不含聊天正文。", action("导出工作台索引", "export-workspace"))}${settingRow("替换前的设置", "导入或恢复默认前会保留一份本机备份。", action("导出上次备份", "export-previous"))}${settingRow("原始设置恢复", "读取损坏数据时保留原文，可导出后人工检查。", action("导出原始设置", "export-recovery"))}</div></section><section class="settings-block"><h2>当前存储</h2><div class="settings-option-group">${settingRow("工作台索引大小", "当前状态序列化为 JSON 后的大小。", `<span class="settings-value">${size(store.state)}</span>`)}${settingRow("设置大小", "不含历史备份。", `<span class="settings-value">${size(view.data)}</span>`)}${settingRow("写入状态", "失败时保留当前窗口的值，并提供重试。", `<span class="settings-value">${store.storageAvailable && view.storageAvailable ? "已保存" : "有未落盘的更改"}</span>`)}</div></section><section class="settings-block"><h2>恢复默认设置</h2><p class="settings-block-description">恢复全部新设置并清空模型、工具、设备和钩子配置。不会删除工作台内容或重置原有侧栏偏好。</p>${action("恢复默认设置…", "reset-settings")}</section>`;
}

export function shortcutRows(query = ""): string {
  const shortcuts = settingsShortcuts(/Mac/.test(navigator.platform)).filter(([title, key]) => `${title} ${key}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return shortcuts.map(([title, key]) => `<div><dt>${title}</dt><dd><kbd>${key}</kbd></dd></div>`).join("") || '<p class="settings-list-empty" role="status">没有匹配的快捷键</p>';
}

export function shortcutSettings(view: ConfigurationView): string {
  return `<label class="settings-page-search">${icon("search")}<input type="search" placeholder="搜索快捷键" aria-label="搜索快捷键" value="${escapeHtml(view.queries.shortcuts ?? "")}" data-config-filter="shortcuts" data-focus="configuration-filter-shortcuts" /></label><section class="settings-block"><h2>工作台与设置</h2><dl class="settings-shortcuts" data-shortcut-list>${shortcutRows(view.queries.shortcuts)}</dl><p class="settings-block-description">这些快捷键已接入当前界面。系统全局热键和自定义绑定服务尚未接入。</p></section>`;
}
