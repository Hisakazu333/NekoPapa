import { generalSettings, characterSettings } from "./settings-workspace-view";
import { settingRow } from "./settings-form-view";
import { configurationSchemas } from "./configuration-contract";
import { configurationCollections } from "./configuration-types";
import type { ConfigurationView, ConfigurationGroup, ConfigurationCollection } from "./configuration-types";
import { personalConfigurationPage, importSettings, dataSettings, shortcutSettings } from "./settings-personal-view";
import { collectionSettings } from "./settings-collection-view";
import { cloudUsageSettings } from "./settings-usage-view";
import { accountSettings } from "./settings-account-view";
import { icon } from "./icons";
import { escapeHtml } from "./view-shared";
import { renderGlobalRail } from "./rail-view";
import { renderWindowNavigation } from "./chrome";
import { settingsCatalog, searchSettings, settingEntry } from "./settings-model";
import type { SettingsNavigation, SettingsSection } from "./settings-model";
import { renderCollection } from "./lifecycle-view";
import type { WorkspaceStore } from "./state";

export function renderSettingsNavigation(store: WorkspaceStore, navigation: SettingsNavigation): string {
  const results = searchSettings(navigation.query);
  return [...new Set(settingsCatalog.map((entry) => entry.group))].map((group) => {
    const entries = results.filter((entry) => entry.group === group);
    return entries.length ? `<section class="settings-nav-group" aria-label="${group}"><h3>${group}</h3>${entries.map((entry) => {
      const count = entry.id === "archive" ? store.state.archives.length : entry.id === "trash" ? store.state.trash.length : undefined;
      return `<button class="settings-nav-item ${entry.id === navigation.section ? "is-current" : ""}" type="button" data-settings-section="${entry.id}" data-focus="settings-section-${entry.id}" ${entry.id === navigation.section ? 'aria-current="page"' : ""}>${icon(entry.icon)}<span>${entry.title}</span>${count === undefined ? "" : `<span class="settings-nav-count">${count}</span>`}</button>`;
    }).join("")}</section>` : "";
  }).join("") || '<p class="settings-nav-empty" role="status">没有匹配的设置</p><button class="settings-clear" type="button" data-settings-action="clear-search">清除搜索</button>';
}

function sectionBody(store: WorkspaceStore, section: SettingsSection, configuration: ConfigurationView): string {
  if (section === "usage") return cloudUsageSettings(configuration);
  if (section === "account") return accountSettings(configuration);
  if (configurationSchemas.some((schema) => schema.id === section)) return personalConfigurationPage(section as ConfigurationGroup, store, configuration);
  if (configurationCollections.includes(section as ConfigurationCollection)) return collectionSettings(section as ConfigurationCollection, configuration);
  if (section === "import") return importSettings(configuration);
  if (section === "data") return dataSettings(store, configuration);
  if (section === "general") return generalSettings(store);
  if (section === "characters") return characterSettings(store);
  if (section === "archive" || section === "trash") return renderCollection(store, section);
  if (section === "shortcuts") return shortcutSettings(configuration);
  return `<section class="settings-block settings-about"><img src="/brand/nekopapa-app-icon-v1-128.png" width="52" height="52" alt="NekoPapa Logo" /><h2>NekoPapa</h2><p>普通陪伴与 Coding 会话，收纳在同一个桌面工作台。</p><div class="settings-option-group">${settingRow("本机保存", "当前保存内容索引、归档、回收站与导航偏好。", `<span class="settings-value">${store.storageAvailable ? "可用" : "保存失败"}</span>`)}${settingRow("账号", "账号登录尚未接入。", '<span class="settings-value">未登录</span>')}${settingRow("Agent 能力", "聊天正文、Pi Coding 与 Live2D 将在后续接入。", '<span class="settings-value">开发中</span>')}</div></section>`;
}

export function renderSettingsShell(store: WorkspaceStore, navigation: SettingsNavigation, configuration: ConfigurationView): string {
  const entry = settingEntry(navigation.section)!;
  return `<header class="window-chrome" aria-label="窗口顶部栏">${renderWindowNavigation(store, navigation)}<div class="settings-chrome" data-tauri-drag-region><span data-tauri-drag-region>设置<span class="settings-chrome-separator">/</span>${entry.title}</span><div class="chrome-drag" data-tauri-drag-region></div><button class="settings-return" type="button" data-settings-action="close" data-focus="settings-close" aria-label="关闭设置，返回工作台" title="关闭设置 (Esc)">${icon("close")}</button></div></header>
    ${renderGlobalRail(store, true)}
    <aside class="sidebar settings-sidebar" id="sidebar" aria-label="设置侧栏"><h1>设置</h1><label class="settings-search">${icon("search")}<input type="search" aria-label="搜索设置" placeholder="搜索设置" data-settings-search data-focus="settings-search" value="${escapeHtml(navigation.query)}" autocomplete="off" /></label><nav class="settings-navigation" aria-label="设置分类">${renderSettingsNavigation(store, navigation)}</nav><div class="settings-sidebar-footer"><span>${store.storageAvailable && configuration.storageAvailable ? "导航自动保存 · 表单需保存" : "有未落盘的更改"}</span><button type="button" data-settings-action="close" data-focus="settings-back-workspace">${icon("left")}返回工作台</button></div></aside>
    <main class="settings-workspace" data-settings-page="${navigation.section}" aria-labelledby="settings-page-title" tabindex="-1"><div class="settings-page"><div class="settings-page-heading"><span class="settings-breadcrumb">${entry.group}</span><h1 id="settings-page-title" tabindex="-1" data-focus="settings-heading">${entry.title}</h1><p>${entry.description}</p></div><p class="settings-feedback" role="status" data-settings-feedback hidden></p>${!store.storageAvailable ? '<div class="settings-storage-error" role="alert">本次更改尚未保存。<button type="button" data-settings-action="retry-save">重试保存</button></div>' : ""}${configuration.notice ? `<div class="settings-storage-error" role="alert">${escapeHtml(configuration.notice)}<button type="button" data-config-action="retry-configuration">重试保存</button></div>` : ""}${sectionBody(store, navigation.section, configuration)}</div></main>`;
}
