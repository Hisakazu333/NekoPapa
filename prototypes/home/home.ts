import "../../src/styles.css";
import "../../src/app/chrome.css";
import "../../src/app/sidebar.css";
import "../../src/app/companion.css";
import "../../src/app/features.css";
import "../../src/app/theme.css";
import "./home.css";
import { icon } from "../../src/app/icons";
import { companionCatalog, conversationForCompanion } from "../../src/app/companion-model";
import type { CompanionId } from "../../src/app/companion-model";
import { renderCompanionAvatar } from "../../src/app/companion-view";
import type { IconName } from "../../src/app/icons";
import { escapeHtml } from "../../src/app/view-shared";
import { navigationModes } from "../../src/app/workspace-model";
import type { ContentKind, NavigationMode } from "../../src/app/workspace-model";
import { createPreview, suggestions } from "./demo-data";
import { renderPreviewShell, renderRecent, renderReviews, reviewDialog } from "./home-view";

const root = document.querySelector<HTMLElement>("#app")!;
const homeTemplate = document.querySelector<HTMLTemplateElement>("#home-template")!;
const feedback = document.querySelector<HTMLElement>("#preview-feedback")!;
const lifecycle = new AbortController();
let { store, works, reviews } = createPreview(true);
let daily = true;
let filter = "all";
let goal = "";
let mode: ContentKind = "conversation";
let projectId = "";
let attachments: File[] = [];
let feedbackTimer: ReturnType<typeof setTimeout>;
let dialog: HTMLDialogElement | null = null;
let dialogFocus: { element: HTMLElement; key?: string } | null = null;

function announce(message: string): void {
  clearTimeout(feedbackTimer);
  feedback.textContent = message;
  feedback.hidden = false;
  feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 4000);
}

function captureInput(): void {
  const input = root.querySelector<HTMLTextAreaElement>("#task-input");
  if (input) goal = input.value;
}

function render(focus?: string, captureDraft = true): void {
  if (captureDraft) captureInput();
  root.classList.toggle("sidebar-hidden", !store.state.sidebarVisible);
  root.style.setProperty("--sidebar-width", `${store.state.sidebarWidth}px`);
  root.innerHTML = renderPreviewShell(store, homeTemplate.innerHTML, works);
  if (store.state.activeId === "home") prepareHome();
  root.querySelector(".workspace-tab.is-selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (focus) root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focus)}"]`)?.focus({ preventScroll: true });
}

function updateLists(): void {
  root.querySelectorAll<HTMLElement>("[data-work-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.workFilter === filter)));
  const list = root.querySelector("#recent-work-list");
  if (list) list.innerHTML = renderRecent(works, filter, works.length > 0);
  const attention = root.querySelector("#attention-list");
  if (attention) attention.innerHTML = renderReviews(reviews);
  const count = root.querySelector<HTMLElement>("#attention-count");
  if (count) { count.textContent = String(reviews.length); count.hidden = reviews.length === 0; }
}

function updateAttachments(): void {
  const target = root.querySelector<HTMLElement>("#home-attachments");
  if (!target) return;
  target.hidden = !attachments.length;
  target.innerHTML = attachments.map((file, index) => `<span class="attachment-chip">${icon("file")}<span>${escapeHtml(file.name)}</span><button type="button" data-remove-file="${index}" aria-label="移除${escapeHtml(file.name)}">${icon("close")}</button></span>`).join("");
}

function prepareHome(): void {
  root.querySelector<HTMLTextAreaElement>("#task-input")!.value = goal;
  root.querySelector<HTMLSelectElement>('[name="mode"]')!.value = mode;
  const projects = store.state.groups.filter((group) => group.kind === "project");
  root.querySelector<HTMLSelectElement>('[name="project"]')!.innerHTML = '<option value="">选择项目</option>' + projects.map((project) => `<option value="${project.id}" ${project.id === projectId ? "selected" : ""}>${escapeHtml(project.title)}</option>`).join("");
  root.querySelector<HTMLElement>(".project-select")!.hidden = mode !== "coding";
  root.querySelector<HTMLButtonElement>(".composer-submit")!.disabled = !goal.trim();
  const glyphs: Record<string, IconName> = { "mode-icon": mode === "coding" ? "code" : "message", "project-icon": "folder", "model-chevron": "down", "submit-icon": "arrow" };
  for (const [id, name] of Object.entries(glyphs)) root.querySelector(`#${id}`)!.innerHTML = icon(name);
  root.querySelector(".composer-attach")!.innerHTML = icon("plus");
  root.querySelectorAll<HTMLElement>("[data-suggestion-icon], [data-inline-icon]").forEach((target) => { target.innerHTML = icon((target.dataset.suggestionIcon ?? target.dataset.inlineIcon) as IconName); });
  updateAttachments();
  updateLists();
}

function home(focus = false): void {
  closeDialog();
  store.navigate("home");
  store.open("home");
  render();
  if (focus) root.querySelector<HTMLTextAreaElement>("#task-input")?.focus();
}

function openWork(id: string): void {
  closeDialog();
  store.open(id);
  render(`tab-${id}`);
}

function showDialog(contents: string): void {
  closeDialog();
  const element = document.activeElement;
  if (element instanceof HTMLElement) dialogFocus = { element, key: element.dataset.focus };
  dialog = document.createElement("dialog");
  dialog.className = "preview-dialog";
  dialog.setAttribute("aria-labelledby", "preview-dialog-title");
  dialog.innerHTML = `<button class="icon-button dialog-close" type="button" data-dialog-close aria-label="关闭">${icon("close")}</button>${contents}`;
  dialog.addEventListener("close", () => closeDialog(), { once: true });
  dialog.addEventListener("click", (event) => { const current = event.currentTarget as HTMLDialogElement; if (event.target === current) { const rect = current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
  document.body.append(dialog);
  dialog.showModal();
}

function closeDialog(): void {
  const previous = dialog;
  dialog = null;
  previous?.remove();
  if (dialogFocus?.element.isConnected) dialogFocus.element.focus();
  else if (dialogFocus?.key) root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(dialogFocus.key)}"]`)?.focus();
  dialogFocus = null;
}

function modelDialog(): void {
  showDialog('<span class="dialog-eyebrow">模型与连接</span><h2 id="preview-dialog-title">还没有连接模型</h2><p class="preview-dialog-description">首页会使用你配置的模型来处理普通任务或 Coding 任务。尚未连接时，可以先保留任务草稿。</p><p class="dialog-prototype-note">本次 HTML 预览不连接服务、不提交目标和资料。</p><div class="preview-dialog-actions"><button class="text-button" type="button" data-dialog-close>返回</button><button class="primary-button" type="button" data-save-draft>保留任务草稿</button></div>');
}

function startDraft(): void {
  captureInput();
  if (!goal.trim()) { closeDialog(); home(true); root.querySelector("#home-message")!.textContent = "先写下你想完成的事。"; return; }
  if (mode === "coding" && !projectId) { closeDialog(); home(true); root.querySelector("#home-message")!.textContent = "Coding 任务需要先选择项目。可从项目目录添加项目。"; return; }
  const group = mode === "coding" ? projectId : store.state.groups.find((entry) => entry.kind === "space")?.id;
  const title = goal.trim().split("\n")[0].slice(0, 28);
  const id = group ? store.addItem(mode, title, group) : store.addItemWithGroup(mode, title, "我的空间");
  if (!id) return;
  works.unshift({ id, title, kind: mode, groupId: store.item(id)!.groupId!, summary: "任务草稿 · 模型连接后再开始", when: "刚刚", label: mode === "coding" ? store.state.groups.find((entry) => entry.id === projectId)!.title : "我的空间", paragraphs: [], goal, files: attachments.map((file) => file.name) });
  goal = "";
  attachments = [];
  closeDialog();
  render(`tab-${id}`, false);
  announce("草稿已保留在本次预览中；没有调用模型或执行任务。");
}

function menu(title: string, body: string): void {
  showDialog(`<h2 id="preview-dialog-title">${title}</h2><div class="preview-menu-list">${body}</div>`);
}

function search(): void {
  showDialog('<h2 id="preview-dialog-title">搜索内容</h2><input class="text-field preview-search" type="search" aria-label="搜索工作" placeholder="搜索任务、页面或项目…" /><div class="preview-menu-list" id="search-results"></div>');
  updateSearch("");
  dialog!.querySelector<HTMLInputElement>("input")!.focus();
}

function updateSearch(query: string): void {
  const results = works.filter((work) => `${work.title} ${work.summary}`.toLowerCase().includes(query.toLowerCase()));
  dialog!.querySelector("#search-results")!.innerHTML = results.length ? results.map((work) => `<button type="button" data-home-action="open-work" data-id="${work.id}">${icon(work.kind === "coding" ? "code" : work.kind === "page" ? "file" : "message")}<span>${escapeHtml(work.title)}</span></button>`).join("") : '<p class="preview-dialog-description">没有匹配的内容，换个关键词试试。</p>';
}

function projectDialog(): void {
  showDialog('<h2 id="preview-dialog-title">添加项目</h2><p class="preview-dialog-description">先为项目取个名字。本次预览只创建项目入口，不读取本机目录。</p><form id="preview-project-form"><label class="field-label" for="project-title">项目名称</label><input id="project-title" class="text-field" name="title" required maxlength="72" autocomplete="off" /><div class="preview-dialog-actions"><button type="button" class="text-button" data-dialog-close>取消</button><button type="submit" class="primary-button">添加项目</button></div></form>');
  dialog!.querySelector<HTMLInputElement>("input")!.focus();
}

function shellAction(action: string, id: string): void {
  if (action === "open") { openWork(id); return; }
  if (action === "navigate" && navigationModes.includes(id as NavigationMode)) { store.navigate(id as NavigationMode); render(`rail-${id}`); return; }
  if (action === "close-tab") { store.close(id); render(`tab-${store.state.activeId}`); return; }
  if (action === "toggle-sidebar") { store.state.sidebarVisible = !store.state.sidebarVisible; render("toggle-sidebar"); return; }
  if (action === "back" || action === "forward") { store.travel(action === "back" ? -1 : 1); render(); return; }
  if (action === "search") { search(); return; }
  if (action === "companion-menu") { menu("选择角色", companionCatalog.map((companion) => `<button type="button" data-preview-companion="${companion.id}">${renderCompanionAvatar(companion)}<span>${companion.name}</span>${companion.avatar ? "" : '<small class="dialog-prototype-note">头像待更新</small>'}</button>`).join("")); return; }
  if (action === "companion") { const conversation = conversationForCompanion(store.state); if (conversation) openWork(conversation.id); else { mode = "conversation"; home(true); } return; }
  if (action === "preview-reviews") { home(); root.querySelector("#attention-heading")!.scrollIntoView({ block: "center" }); return; }
  if (action === "new-tab") { menu("开始新的工作", `<button type="button" data-new-mode="conversation">${icon("message")}普通任务</button><button type="button" data-new-mode="coding">${icon("code")}Coding 任务</button><button type="button" data-home-action="add-project">${icon("folder")}添加项目</button>`); return; }
  if (action === "tab-overflow") { menu("打开的标签页", store.state.tabs.map((tab) => `<button type="button" data-action="open" data-id="${tab}">${icon(tab === "home" ? "home" : "layers")}${escapeHtml(store.item(tab)!.title)}</button>`).join("")); return; }
  if (action === "navigation-settings" || action === "sidebar-options") { menu("侧栏布局", '<button type="button" data-action="toggle-sidebar">展开 / 收起侧栏</button><button type="button" data-reset-width>恢复默认宽度</button>'); return; }
  if (action === "content-menu" || action === "toggle-details") { menu("内容详情", `<p class="preview-dialog-description">${escapeHtml(store.item(store.state.activeId)!.title)}</p><button type="button" data-home-action="new">${icon("edit")}开始新任务</button><button type="button" data-home-action="home">${icon("home")}返回首页</button>`); return; }
  menu(action === "account-menu" ? "本机工作台" : "更多功能", `<button type="button" data-home-action="model">${icon("link")}模型与连接</button><button type="button" data-home-action="add-project">${icon("folder")}添加项目</button><p class="dialog-prototype-note">这是独立首页预览，完整设置与其他功能仍使用已有客户端。</p>`);
}

document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (!button || button.disabled) return;
  const data = button.dataset;
  if (data.scenario) {
    closeDialog();
    clearTimeout(feedbackTimer); feedback.hidden = true;
    daily = data.scenario === "daily"; ({ store, works, reviews } = createPreview(daily)); goal = ""; mode = "conversation"; projectId = ""; attachments = []; filter = "all";
    document.querySelectorAll<HTMLElement>("[data-scenario]").forEach((target) => target.setAttribute("aria-pressed", String(target.dataset.scenario === data.scenario)));
    render(undefined, false); return;
  }
  if ("previewTheme" in data) { const dark = document.documentElement.dataset.theme !== "dark"; document.documentElement.dataset.theme = dark ? "dark" : "light"; button.setAttribute("aria-pressed", String(dark)); button.textContent = dark ? "浅色" : "深色"; return; }
  if ("dialogClose" in data) { closeDialog(); return; }
  if (data.previewCompanion) { store.selectCompanion(data.previewCompanion as CompanionId); closeDialog(); render("companion-selector"); return; }
  if ("saveDraft" in data) { startDraft(); return; }
  if (data.confirmReview) { reviews = reviews.filter((review) => review.id !== data.confirmReview); closeDialog(); updateLists(); const next = root.querySelector<HTMLElement>(".attention-item") ?? root.querySelector<HTMLElement>("#attention-heading"); if (next) { next.tabIndex = -1; next.focus(); } announce("示例操作已确认；没有写入或修改真实文件。"); return; }
  if ("resetWidth" in data) { closeDialog(); store.state.sidebarWidth = 232; render(); return; }
  if (data.newMode) { mode = data.newMode as ContentKind; home(true); return; }
  if (data.workFilter) { filter = data.workFilter; updateLists(); return; }
  if (data.suggestion) { const suggestion = suggestions[data.suggestion as keyof typeof suggestions]; mode = suggestion.mode; goal = suggestion.text; root.querySelector<HTMLTextAreaElement>("#task-input")!.value = goal; prepareHome(); root.querySelector<HTMLTextAreaElement>("#task-input")!.focus(); return; }
  if (data.removeFile !== undefined) { attachments.splice(Number(data.removeFile), 1); updateAttachments(); return; }
  const action = data.homeAction;
  if (action === "home") home();
  else if (action === "focus" || action === "new") home(true);
  else if (action === "open-work") openWork(data.id!);
  else if (action === "review") showDialog(reviewDialog(reviews.find((review) => review.id === data.id)!));
  else if (action === "model") modelDialog();
  else if (action === "attach") root.querySelector<HTMLInputElement>("#context-files")!.click();
  else if (action === "add-project") projectDialog();
  else if (action === "spaces" || action === "projects") { store.navigate(action === "spaces" ? "library" : "projects"); render(); if (action === "projects" && !store.state.groups.some((group) => group.kind === "project")) projectDialog(); }
  else if (action === "all-work") { filter = "all"; updateLists(); root.querySelector("#recent-heading")!.scrollIntoView({ block: "start" }); }
  else if (data.action) { closeDialog(); shellAction(data.action, data.id ?? ""); }
}, { signal: lifecycle.signal });

document.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === "task-input") { goal = input.value; root.querySelector<HTMLButtonElement>(".composer-submit")!.disabled = !goal.trim(); root.querySelector("#home-message")!.textContent = ""; }
  if (input.matches(".preview-search")) updateSearch(input.value);
}, { signal: lifecycle.signal });

document.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === "mode") { mode = input.value as ContentKind; prepareHome(); }
  if (input.name === "project") projectId = input.value;
  if (input.id === "context-files") { attachments = [...attachments, ...Array.from(input.files ?? [])].slice(0, 6); updateAttachments(); }
}, { signal: lifecycle.signal });

document.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id === "home-composer") { event.preventDefault(); startDraft(); }
  if (form.id === "preview-project-form") { event.preventDefault(); const name = String(new FormData(form).get("title") ?? "").trim(); if (!name) return; projectId = store.addGroup("project", name)!; closeDialog(); home(true); announce("项目入口已加入本次预览，未读取本机目录。"); }
}, { signal: lifecycle.signal });

document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  if (event.key === "Escape" && dialog) { event.preventDefault(); closeDialog(); return; }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && target.id === "task-input") { event.preventDefault(); startDraft(); }
  if ((event.metaKey || event.ctrlKey) && !dialog && event.key.toLowerCase() === "k") { event.preventDefault(); search(); }
  if ((event.metaKey || event.ctrlKey) && !dialog && event.key.toLowerCase() === "n") { event.preventDefault(); home(true); }
  if (target.getAttribute("role") === "tab" && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const tabs = store.state.tabs;
    const index = tabs.indexOf(store.state.activeId);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    store.open(tabs[next]); render(`tab-${tabs[next]}`);
  }
  if (target.classList.contains("sidebar-resizer") && ["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); store.state.sidebarWidth = event.key === "Home" ? 232 : Math.min(320, Math.max(196, store.state.sidebarWidth + (event.key === "ArrowRight" ? 8 : -8))); render("sidebar-resizer"); }
}, { signal: lifecycle.signal });

root.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !(event.target as Element).closest(".sidebar-resizer")) return;
  event.preventDefault();
  captureInput();
  const origin = event.clientX;
  const width = store.state.sidebarWidth;
  const move = (pointer: PointerEvent) => { store.state.sidebarWidth = Math.min(320, Math.max(196, width + pointer.clientX - origin)); root.style.setProperty("--sidebar-width", `${store.state.sidebarWidth}px`); };
  const finish = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", finish); render("sidebar-resizer"); };
  document.addEventListener("pointermove", move, { signal: lifecycle.signal });
  document.addEventListener("pointerup", finish, { once: true, signal: lifecycle.signal });
}, { signal: lifecycle.signal });

import.meta.hot?.dispose(() => { lifecycle.abort(); clearTimeout(feedbackTimer); closeDialog(); });
render();
