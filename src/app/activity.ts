import type { SessionStatus, ShellState, WorkspaceGroup, WorkspaceItem } from "./state";

export const sessionStatusLabels: Record<SessionStatus, string> = {
  idle: "", running: "运行中", waiting: "等待确认", completed: "已完成", failed: "执行失败",
};

export interface ActivityEntry {
  item: WorkspaceItem;
  source?: WorkspaceGroup;
}

export interface ActivitySection {
  id: string;
  title: string;
  entries: ActivityEntry[];
}

export function unreadSessionCount(state: Pick<ShellState, "items">): number {
  return state.items.filter((item) => (item.kind === "conversation" || item.kind === "coding") && item.activity?.unread).length;
}

function attentionRank(item: WorkspaceItem): number {
  if (item.activity?.pinned) return 0;
  if (item.activity?.status === "waiting" || item.activity?.status === "failed") return 1;
  if (item.activity?.status === "running") return 2;
  return item.activity?.unread ? 3 : 4;
}

// Calendar days, rather than elapsed 24-hour periods, also handle daylight-saving changes.
function calendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function activitySections(state: Pick<ShellState, "items" | "groups" | "recent" | "activityFilter">, now = new Date()): ActivitySection[] {
  const sections: ActivitySection[] = [
    { id: "activity-priority", title: "优先级", entries: [] },
    { id: "activity-today", title: "今天", entries: [] },
    { id: "activity-yesterday", title: "昨天", entries: [] },
    { id: "activity-week", title: "过去七天", entries: [] },
    { id: "activity-earlier", title: "更早", entries: [] },
    { id: "activity-history", title: "历史会话", entries: [] },
  ];
  const recentOrder = new Map(state.recent.map((id, index) => [id, index]));
  const originalOrder = new Map(state.items.map((item, index) => [item.id, index]));
  const timestamp = (item: WorkspaceItem) => item.activity?.updatedAt ? Date.parse(item.activity.updatedAt) || 0 : 0;
  const sessions = state.items.filter((item) => (item.kind === "conversation" || item.kind === "coding") && (state.activityFilter !== "unread" || item.activity?.unread));
  sessions.sort((a, b) => attentionRank(a) - attentionRank(b) || timestamp(b) - timestamp(a) ||
    (recentOrder.get(a.id) ?? state.recent.length) - (recentOrder.get(b.id) ?? state.recent.length) || originalOrder.get(b.id)! - originalOrder.get(a.id)!);
  const today = calendarDay(now);
  for (const item of sessions) {
    const age = item.activity?.updatedAt ? today - calendarDay(new Date(item.activity.updatedAt)) : undefined;
    const section = attentionRank(item) < 4 ? 0 : age === undefined ? 5 : age <= 0 ? 1 : age === 1 ? 2 : age < 7 ? 3 : 4;
    sections[section].entries.push({ item, source: state.groups.find((group) => group.id === item.groupId) });
  }
  return sections;
}
