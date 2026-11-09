import type { StoredThread } from "@/components/application/agent-chat/thread-storage";

/** A project folder in the sidebar with its newest workbench chats. */
export interface RecentProjectGroup { folder: string; threads: StoredThread[]; updatedAt: number; hidden: number }
export interface RecentSidebarGroups { projects: RecentProjectGroup[]; loose: StoredThread[]; hiddenLoose: number }

/**
 * Splits workbench chats into project folders and chats that belong to no
 * folder. Contact chats and empty drafts never appear. Folders with chats are
 * ordered by their newest chat; remembered folders without chats follow in
 * their own order, so a folder added before its first chat is still listed.
 */
export function groupRecentThreads(threads: readonly StoredThread[], {
  folders = [], perProject = 5, loose: looseLimit = 6,
}: { folders?: readonly string[]; perProject?: number; loose?: number } = {}): RecentSidebarGroups {
  const recent = threads
    .filter((thread) => !thread.contact && thread.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const projects = new Map<string, RecentProjectGroup>();
  const loose: StoredThread[] = [];
  for (const thread of recent) {
    if (!thread.project) {
      loose.push(thread);
      continue;
    }
    const group = projects.get(thread.project);
    if (group) group.threads.push(thread);
    else projects.set(thread.project, { folder: thread.project, threads: [thread], updatedAt: thread.updatedAt, hidden: 0 });
  }
  for (const folder of folders) {
    if (!projects.has(folder)) projects.set(folder, { folder, threads: [], updatedAt: 0, hidden: 0 });
  }
  const limit = (count: number) => Math.max(0, count);
  return {
    projects: [...projects.values()].map((group) => ({
      ...group, threads: group.threads.slice(0, limit(perProject)), hidden: Math.max(0, group.threads.length - limit(perProject)),
    })),
    loose: loose.slice(0, limit(looseLimit)),
    hiddenLoose: Math.max(0, loose.length - limit(looseLimit)),
  };
}

/** Compact age badge: 现在, 34m, 5h, 2d, 3w, then month/day. */
export function recentAge(timestamp: number, now: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return "现在";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 35) return `${Math.floor(days / 7)}w`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
