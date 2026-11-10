import { icon } from "./icons";
import { escapeHtml, itemIcon } from "./view-shared";
import { canDeleteContent } from "./workspace-lifecycle";
import type { ArchiveRecord, ContentSnapshot, TrashRecord, WorkspaceItem } from "./workspace-model";
import type { WorkspaceStore } from "./state";

export type CollectionKind = "archive" | "trash";

export function snapshotTitle(record: ContentSnapshot): string {
  return record.target === "group" ? record.group!.title : record.items[0].title;
}

function collectionRow(record: ArchiveRecord | TrashRecord, collection: CollectionKind): string {
  const grouped = record.target === "group";
  const item = record.items[0];
  const title = snapshotTitle(record);
  const labels: Partial<Record<WorkspaceItem["kind"], string>> = { conversation: "对话", coding: "Coding 会话", page: "页面" };
  const type = grouped ? record.group?.kind === "project" ? "项目" : "空间" : labels[item.kind] ?? "内容";
  const childTitles = record.items.map((entry) => entry.title).join("、");
  const origin = grouped ? `${record.items.length} 条内容${childTitles ? ` · ${childTitles}` : ""}` : record.group?.title ?? "原位置";
  const returnsToArchive = collection === "trash" && !!record.archivedAt;
  const originLabel = returnsToArchive ? `来自归档 · ${origin}` : origin;
  const timestamp = "deletedAt" in record ? record.deletedAt : record.archivedAt;
  const date = new Date(timestamp);
  const searchText = `${title} ${record.group?.title ?? ""} ${type} ${childTitles} ${originLabel}`;
  const restoreLabel = `恢复${title}${returnsToArchive ? "至归档" : grouped && record.items.length ? `及其 ${record.items.length} 条内容` : ""}`;
  const deletionAllowed = canDeleteContent(record.items);
  return `<div class="archive-list-row ${collection === "archive" ? "has-delete" : ""}" role="listitem" data-collection-entry="${escapeHtml(record.id)}" data-search-text="${escapeHtml(searchText)}">
    <div class="archive-list-main">${icon(grouped ? record.group?.kind === "project" ? "code" : "folder" : itemIcon(item))}<span class="archive-list-title">${escapeHtml(title)}</span></div>
    <span class="archive-list-origin" title="${escapeHtml(originLabel)}">${escapeHtml(originLabel)}</span><span class="archive-list-kind">${type}</span>
    <time class="archive-date" datetime="${escapeHtml(timestamp)}" title="${escapeHtml(date.toLocaleString("zh-CN"))}">${escapeHtml(date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }))}</time>
    <button class="archive-restore" type="button" data-collection-action="restore" data-id="${escapeHtml(record.id)}" data-focus="restore-${collection}-${escapeHtml(record.id)}" aria-label="${escapeHtml(restoreLabel)}" title="${escapeHtml(restoreLabel)}">${returnsToArchive ? "恢复至归档" : "恢复"}</button>
    ${collection === "archive" ? `<button class="icon-button collection-delete" type="button" data-collection-action="delete" data-focus="delete-${collection}-${escapeHtml(record.id)}" data-id="${escapeHtml(record.id)}" aria-label="删除${escapeHtml(title)}" title="${deletionAllowed ? "移入回收站" : "请先结束会话执行"}" ${deletionAllowed ? "" : "disabled"}>${icon("trash")}</button>` : ""}
  </div>`;
}

export function renderCollection(store: WorkspaceStore, collection: CollectionKind): string {
  const records = collection === "archive" ? store.state.archives : store.state.trash;
  const name = collection === "archive" ? "归档" : "回收站";
  return `<div class="archive-content">
    <p class="archive-description">${collection === "archive" ? "收起暂时不用的内容，恢复后继续使用。" : "删除的内容保留在这里；来自归档的内容会恢复至归档。"}</p>
    ${records.length ? `<label class="archive-search">${icon("search")}<input type="search" data-collection-search data-focus="collection-search-${collection}" aria-label="搜索${name}" placeholder="搜索${name}" autocomplete="off" /></label><div class="archive-section-heading"><h3>${collection === "archive" ? "已归档" : "已删除"}</h3><span class="archive-total" data-collection-total>${records.length} 项</span></div><div class="archive-list" role="list" aria-label="${name}内容">${records.map((record) => collectionRow(record, collection)).join("")}</div><p class="archive-search-empty" data-collection-empty hidden>没有匹配的${name}内容。</p>` : `<div class="archive-empty">${icon(collection === "archive" ? "archive" : "trash")}<h3>${collection === "archive" ? "还没有归档内容" : "回收站是空的"}</h3><p>在内容或分组的操作菜单中选择「${collection === "archive" ? "归档" : "删除"}」。</p></div>`}
  </div>`;
}
