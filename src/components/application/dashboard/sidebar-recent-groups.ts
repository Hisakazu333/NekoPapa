import type { StoredThread } from "@/components/application/agent-chat/thread-storage";
import { resolveProject, type Project } from "../../../app/projects/projects";

/** A project in the sidebar with its newest workbench chats. */
export interface RecentProjectGroup { project: Project; threads: StoredThread[]; updatedAt: number; hidden: number }
export interface RecentSidebarGroups { projects: RecentProjectGroup[]; loose: StoredThread[]; hiddenLoose: number }

/**
 * Splits workbench chats into projects and chats that belong to none (no
 * project, or a project that was removed). Contact chats and empty drafts
 * never appear. Pinned projects come first in list order; the rest are
 * ordered by their newest chat, then projects without chats in list order.
 */
export function groupRecentThreads(threads: readonly StoredThread[], {
  projects: known = [], perProject = 5, loose: looseLimit = 6,
}: { projects?: readonly Project[]; perProject?: number; loose?: number } = {}): RecentSidebarGroups {
  const recent = threads
    .filter((thread) => !thread.contact && thread.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const groups = new Map<string, RecentProjectGroup>(known.map((project) => [project.id, { project, threads: [], updatedAt: 0, hidden: 0 }]));
  const loose: StoredThread[] = [];
  for (const thread of recent) {
    const group = groups.get(resolveProject(known, thread.project)?.id ?? "");
    if (!group) {
      loose.push(thread);
      continue;
    }
    group.threads.push(thread);
    group.updatedAt = Math.max(group.updatedAt, thread.updatedAt);
  }
  const all = [...groups.values()];
  const ordered = [
    ...all.filter((group) => group.project.pinned),
    ...all.filter((group) => !group.project.pinned && group.threads.length > 0).sort((a, b) => b.updatedAt - a.updatedAt),
    ...all.filter((group) => !group.project.pinned && group.threads.length === 0),
  ];
  const limit = (count: number) => Math.max(0, count);
  return {
    projects: ordered.map((group) => ({
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

/** One day-bucket of workbench chats, newest first inside each bucket. */
export interface RecentDayGroup { key: string; label: string; threads: StoredThread[] }

/**
 * 对话 in the dock's panel lists chats by recency, not by project: switching
 * sessions is a "what did I do lately" question, so the day is the useful
 * heading. Days are local calendar days; the 7-day bucket stops before today.
 */
export function groupThreadsByDay(threads: readonly StoredThread[], now: number): RecentDayGroup[] {
  const dayStart = (timestamp: number) => {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  const today = dayStart(now);
  const buckets: RecentDayGroup[] = [
    { key: "today", label: "今天", threads: [] },
    { key: "yesterday", label: "昨天", threads: [] },
    { key: "week", label: "最近 7 天", threads: [] },
    { key: "older", label: "更早", threads: [] },
  ];
  for (const thread of [...threads].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const days = Math.round((today - dayStart(thread.updatedAt || 0)) / 86_400_000);
    buckets[days <= 0 ? 0 : days === 1 ? 1 : days < 7 ? 2 : 3].threads.push(thread);
  }
  return buckets.filter((bucket) => bucket.threads.length > 0);
}
