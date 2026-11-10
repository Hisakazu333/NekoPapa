import { useEffect, useState, type ReactNode } from "react";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { AlertDialog } from "@/components/base/modal/modal";
import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { resolveProject, type Project } from "@/app/projects/projects";
import { useProjects } from "@/hooks/use-projects";
import { ProjectEditDialog } from "@/components/application/projects/project-edit-dialog";
import { groupRecentThreads, type RecentProjectGroup } from "./sidebar-recent-groups";
import { RecentConversationRow, type RowActions } from "./recent-conversation-row";
import { AddProjectFolderButton, ProjectFolderGroup } from "./sidebar-project-folders";

/** Re-renders once a minute so age badges stay current without reading the clock during render. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Expanded: the 对话 label and its "+". Collapsed: a short rule under the
 * icon column, so the project icons read as their own group below 更多 (a
 * zero-width label would wrap one character per line and leave a blank block).
 */
function SectionHeading({ label, collapsed, action }: { label: string; collapsed: boolean; action?: ReactNode }) {
  if (collapsed) return <span aria-hidden className="mx-2 mb-2.5 block h-px w-5 bg-separator-border" />;
  return <div className="flex min-w-0 items-center justify-between gap-2 px-2">
    <span className="whitespace-nowrap py-1 text-body-2-medium text-text-tertiary">{label}</span>
    {action}
  </div>;
}

/**
 * The sidebar's 对话 section. Local projects expand into a tree of their
 * chats; chats with no project follow as plain rows. Grouping comes from each
 * chat's stored project. Projects are edited and removed from here.
 */
export function DashboardRecentConversations({
  threads, collapsed, activeId, busy, onSelect, onShowAll, onRename, onToggleUnread, onDelete, onNewChatInProject,
}: {
  threads: StoredThread[];
  collapsed: boolean;
  activeId: string;
  busy: boolean;
  onSelect: (thread: StoredThread) => void;
  onShowAll: () => void;
  onRename: (id: string, title: string) => void;
  onToggleUnread: (id: string) => void;
  onDelete: (id: string) => boolean | Promise<boolean>;
  onNewChatInProject: (projectId: string) => void;
}) {
  const localize = useTemplateCopy();
  const now = useMinuteClock();
  const { projects: known, remove: removeProject } = useProjects();
  const { projects, loose, hiddenLoose } = groupRecentThreads(threads, { projects: known });
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Project | null>(null);
  const removeCount = removeTarget
    ? threads.filter((thread) => !thread.contact && thread.messages.length > 0 && resolveProject(known, thread.project)?.id === removeTarget.id).length
    : 0;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<StoredThread | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const actions: RowActions = {
    activeId, busy, collapsed, now, onSelect, onRename, onToggleUnread,
    onDelete: (thread) => { setDeleteError(undefined); setDeleteTarget(thread); },
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deleted = await onDelete(deleteTarget.id);
    if (!deleted) {
      setDeleteError("无法保存删除操作。对话仍保留在本机，请检查存储后重试。");
      throw new Error("Chat history deletion was not persisted");
    }
  };
  // A folder opens by default when it holds the open chat, or when it is the most recent one with chats.
  const isOpen = (group: RecentProjectGroup, index: number) =>
    expanded[group.project.id] ?? ((index === 0 && group.threads.length > 0) || group.threads.some((thread) => thread.id === activeId));

  const empty = projects.length === 0 && loose.length === 0;

  // One list for every workbench chat: project folders first (each a tree of
  // its chats), then chats that belong to no folder. One heading, one "+" and
  // one empty state, so a chat never has two places it might appear.
  return localize(<section aria-label="对话" className="flex min-w-0 flex-col gap-0.5">
    <SectionHeading label="对话" collapsed={collapsed} action={!collapsed && <AddProjectFolderButton />} />
    {projects.map((group, index) => <ProjectFolderGroup key={group.project.id} group={group} open={isOpen(group, index)}
      onToggle={(open) => setExpanded((current) => ({ ...current, [group.project.id]: open }))} actions={actions}
      onNewChat={onNewChatInProject} onShowAll={onShowAll} onEdit={setEditTarget} onRemove={setRemoveTarget} />)}
    {loose.map((thread) => <RecentConversationRow key={thread.id} thread={thread} actions={actions} />)}
    {empty && !collapsed && <p className="px-2 py-1 text-body-2-regular text-text-tertiary">聊天后会显示在这里。用 + 添加项目，对话会按项目分组。</p>}
    {hiddenLoose > 0 && !collapsed && <button type="button" onClick={onShowAll}
      className="w-full cursor-pointer rounded-2lg px-2 py-1 text-start text-body-2-medium text-text-secondary hover:bg-background-secondary-hover">查看全部对话</button>}
    <AlertDialog
      isOpen={deleteTarget !== null}
      onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(undefined); } }}
      title="删除这段对话？"
      description={deleteTarget ? `“${deleteTarget.title}”及其消息记录将从本机移除。此操作无法撤销。` : undefined}
      confirmLabel="删除对话"
      cancelLabel="取消"
      pendingLabel="正在删除…"
      onConfirm={confirmDelete}
      onCancel={() => setDeleteError(undefined)}
    >
      {deleteError && <p role="alert" className="text-body-2-regular text-text-error-primary">{deleteError}</p>}
    </AlertDialog>
    {editTarget && <ProjectEditDialog key={editTarget.id} project={editTarget} onClose={() => setEditTarget(null)}
      onRemove={() => { setRemoveTarget(editTarget); setEditTarget(null); }} />}
    <AlertDialog
      isOpen={removeTarget !== null}
      onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
      title={removeTarget ? `移除项目“${removeTarget.name}”？` : "移除项目？"}
      description={removeCount > 0
        ? `只从 NekoPapa 移除，不会删除文件夹。其中 ${removeCount} 段对话会保留，改列在未归入项目的对话中。`
        : "只从 NekoPapa 移除，不会删除文件夹。"}
      confirmLabel="移除项目"
      cancelLabel="取消"
      onConfirm={() => { if (removeTarget) removeProject(removeTarget.id); }}
    />
  </section>);
}
