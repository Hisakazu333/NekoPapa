import { renderChrome, defaultPresentation } from "../../src/app/chrome";
import { renderGlobalRail } from "../../src/app/rail-view";
import { renderCompanionEntry } from "../../src/app/companion-view";
import { icon } from "../../src/app/icons";
import { escapeHtml, iconButton, itemIcon } from "../../src/app/view-shared";
import type { WorkspaceStore } from "../../src/app/state";
import type { WorkPreview, ReviewPreview } from "./demo-data";

const categoryLabels = { home: "NekoPapa", chat: "对话", library: "空间", projects: "项目", tasks: "任务", tools: "工具" };
const kindLabels = { conversation: "对话", coding: "Coding", page: "页面" };

function sidebar(store: WorkspaceStore): string {
  const mode = store.state.navigationMode;
  const row = (id: string) => {
    const item = store.item(id)!;
    return `<div class="navigation-row ${store.state.activeId === id ? "is-active" : ""}"><button type="button" class="row-main" data-action="open" data-id="${escapeHtml(id)}" data-focus="preview-open-${escapeHtml(id)}" title="${escapeHtml(item.title)}">${icon(itemIcon(item))}<span class="row-title">${escapeHtml(item.title)}</span></button></div>`;
  };
  const section = (title: string, ids: string[]) => `<section class="sidebar-section"><div class="section-heading"><span class="preview-sidebar-label">${title}</span></div>${ids.map(row).join("")}</section>`;
  let contents = "";
  if (mode === "home") {
    const recent = store.state.recent.filter((id) => !store.state.favorites.includes(id));
    if (store.state.favorites.length) contents += section("收藏", store.state.favorites);
    if (recent.length) contents += section("最近访问", recent);
  } else if (mode === "chat") contents = section("最近对话", store.state.items.filter((item) => item.kind === "conversation").map((item) => item.id));
  else {
    const groups = store.state.groups.filter((group) => group.kind === (mode === "projects" ? "project" : "space"));
    contents = groups.map((group) => section(escapeHtml(group.title), store.state.items.filter((item) => item.groupId === group.id).map((item) => item.id))).join("");
  }
  if (!store.state.items.length) contents = '<div class="workbench-empty"><p>暂无最近工作</p></div>';
  return `<aside class="sidebar" id="sidebar" aria-label="${categoryLabels[mode]}侧栏" ${store.state.sidebarVisible ? "" : "inert"}>
    <div class="sidebar-header"><h2 class="sidebar-heading">${mode === "home" ? '<img class="app-logo" src="/brand/nekopapa-app-icon-v1-128.png" width="18" height="18" alt="" />' : ""}<span class="sidebar-heading-text">${categoryLabels[mode]}</span></h2><div class="sidebar-header-actions">${iconButton("more", "侧栏选项", "sidebar-options")}${iconButton("bell", "查看待处理事项", "preview-reviews")}${iconButton("search", "搜索内容", "search")}</div></div>
    <div class="sidebar-scroll">${mode === "home" || mode === "chat" ? `<div class="sidebar-shortcuts">${renderCompanionEntry(store)}</div>` : ""}${contents}</div>
    <div class="sidebar-footer"><div class="sidebar-create-row"><button class="sidebar-create" type="button" data-home-action="new" data-focus="preview-new">${icon("edit")}<span>新任务</span><kbd>⌘N</kbd></button>${iconButton("down", "新建菜单", "new-tab")}</div></div>
    <div class="sidebar-resizer" role="separator" data-focus="sidebar-resizer" aria-label="调整侧栏宽度" aria-orientation="vertical" aria-valuemin="196" aria-valuemax="320" aria-valuenow="${store.state.sidebarWidth}" tabindex="0"></div>
  </aside>`;
}

export function renderPreviewShell(store: WorkspaceStore, home: string, works: WorkPreview[]): string {
  const active = store.item(store.state.activeId)!;
  const work = works.find((entry) => entry.id === active.id);
  const body = active.id === "home" ? home : renderWork(work!);
  return `${renderChrome(store, defaultPresentation())}${renderGlobalRail(store)}${sidebar(store)}
    <main class="workspace" id="workspace" role="tabpanel" aria-labelledby="tab-${escapeHtml(active.id)}" tabindex="-1"><div class="content-surface"><div class="content-toolbar"><div class="breadcrumbs"><span class="breadcrumb-current">${escapeHtml(active.title)}</span></div>${active.id !== "home" ? '<button type="button" class="home-text-action content-return" data-home-action="home">返回首页</button>' : ""}</div>${body}</div></main>`;
}

export function renderRecent(works: WorkPreview[], filter: string, daily: boolean): string {
  const selected = works.filter((work) => filter === "all" || work.kind === filter);
  if (!selected.length) return `<div class="home-empty"><span class="empty-work-icon">${icon(daily ? "search" : "layers")}</span><h3>${daily ? "这里暂时没有内容" : "从第一件事开始"}</h3><p>${daily ? "换个分类，看看其他工作。" : "新任务、项目和保存的页面会出现在这里。"}</p><button type="button" class="home-text-action" data-home-action="focus">${daily ? "开始新的工作" : "写下你的第一个目标"}${icon("arrow")}</button></div>`;
  return selected.map((work) => `<button type="button" class="recent-work-row" data-home-action="open-work" data-id="${escapeHtml(work.id)}" data-focus="work-${escapeHtml(work.id)}"><span class="work-kind-icon">${icon(work.kind === "coding" ? "code" : work.kind === "page" ? "file" : "message")}</span><span class="recent-work-copy"><span class="recent-work-title">${escapeHtml(work.title)}</span><span class="recent-work-meta">${kindLabels[work.kind]}<i></i>${escapeHtml(work.label)}</span></span><span class="recent-work-time">${escapeHtml(work.when)}</span><span class="recent-work-arrow">${icon("right")}</span></button>`).join("");
}

export function renderReviews(reviews: ReviewPreview[]): string {
  if (!reviews.length) return '<div class="attention-empty"><span>暂无待处理</span></div>';
  return reviews.map((review) => `<button class="attention-item" type="button" data-home-action="review" data-id="${review.id}" data-focus="review-${review.id}"><span class="review-kind">${icon(review.id === "preview-write" ? "file" : "code")}</span><span class="attention-item-copy"><strong>${review.title}</strong><span class="review-tag">${review.id === "preview-write" ? "待确认" : "待审阅"}</span></span><span class="attention-item-link">${icon("right")}</span></button>`).join("");
}

function renderWork(work: WorkPreview): string {
  return `<article class="preview-work-page"><div class="work-page-heading"><span>${kindLabels[work.kind]} · ${escapeHtml(work.label)}</span><h1>${escapeHtml(work.title)}</h1><p>${escapeHtml(work.summary)}</p></div>${work.goal ? `<section class="draft-notice"><span>${icon("clock")}任务草稿 · 尚未开始</span><p>模型尚未连接。目标和资料已保留在本次预览中，配置模型后才能执行。</p><button type="button" class="home-text-action" data-home-action="model">配置模型${icon("arrow")}</button></section><section class="work-page-body"><h2>你的目标</h2><p class="work-goal">${escapeHtml(work.goal)}</p>${work.files?.length ? `<h2>相关资料</h2>${work.files.map((name) => `<p>${icon("file")} ${escapeHtml(name)}</p>`).join("")}` : ""}</section>` : `<div class="work-page-body"><p class="example-content-label">示例内容 · 用于预览打开后的页面</p>${work.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join("")}</div>`}</article>`;
}

export function reviewDialog(review: ReviewPreview): string {
  return `<span class="dialog-eyebrow">需要你处理</span><h2 id="preview-dialog-title">${review.title}</h2><p class="preview-dialog-description">${review.summary}</p><div class="review-file-name">${icon("file")}<span>${review.path}</span></div><pre class="review-file-content">${escapeHtml(review.body)}</pre><p class="dialog-prototype-note">这是示例审阅，不会写入或修改真实文件。</p><div class="preview-dialog-actions"><button type="button" class="text-button" data-dialog-close>稍后处理</button><button type="button" class="primary-button" data-confirm-review="${review.id}">${review.id === "preview-write" ? "允许本次" : "确认已审阅"}</button></div>`;
}
