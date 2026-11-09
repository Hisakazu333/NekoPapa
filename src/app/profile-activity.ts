import type { StoredThread } from "../components/application/agent-chat/thread-storage";
import { calendarDate, dayKey, localDay, validTime, type CalendarDate } from "./local-day";

/**
 * Local usage summary for the profile page, computed only from chat history
 * stored on this device. Days use the local calendar; each sent message with
 * a recorded time counts once toward its day.
 */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;
export interface ActivityDay { key: string; date: CalendarDate; count: number; level: ActivityLevel; future: boolean }
export interface ActivityMonthLabel { column: number; month: number }
/** `key` is the chat's project value, or the project id `projectKey` maps it to. */
export interface ActivityProject { key: string; conversations: number; updatedAt: number }
export interface ProfileActivity {
  /** Chats (workbench and contact) in which you sent at least one message. */
  conversations: number;
  /** Messages you sent, including ones without a recorded time. */
  sentMessages: number;
  /** Days with at least one sent message inside the heatmap window. */
  activeDays: number;
  longestStreak: number;
  /** Consecutive active days ending today, or yesterday when today is still empty. */
  currentStreak: number;
  /** Heatmap columns, Monday first, oldest week first. */
  weeks: ActivityDay[][];
  months: ActivityMonthLabel[];
  /** Workbench project folders by number of chats, most used first. */
  projects: ActivityProject[];
}

/** Fixed thresholds keep a square's meaning stable as history grows. */
export function activityLevel(count: number): ActivityLevel {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

function longestRun(days: readonly number[]) {
  let longest = 0;
  let run = 0;
  for (let index = 0; index < days.length; index += 1) {
    run = index > 0 && days[index] === days[index - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

function currentRun(active: ReadonlySet<number>, today: number) {
  let cursor = active.has(today) ? today : today - 1;
  let run = 0;
  while (active.has(cursor)) {
    run += 1;
    cursor -= 1;
  }
  return run;
}

export function profileActivity(threads: readonly StoredThread[], now: number, {
  weeks: weekCount = 53, projects: projectLimit = 3, projectKey = (value: string): string | undefined => value,
}: { weeks?: number; projects?: number; projectKey?: (value: string) => string | undefined } = {}): ProfileActivity {
  const counts = new Map<number, number>();
  const projects = new Map<string, ActivityProject>();
  let conversations = 0;
  let sentMessages = 0;
  for (const thread of threads) {
    const sent = thread.messages.filter((message) => message.role === "user");
    if (sent.length === 0) continue;
    conversations += 1;
    sentMessages += sent.length;
    for (const message of sent) {
      const time = validTime(thread.messageAt[message.id]);
      if (time === undefined) continue;
      const day = localDay(time);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    // Chats in a removed project (no key) are not counted under any project.
    const key = thread.project && !thread.contact ? projectKey(thread.project) : undefined;
    if (key) {
      const entry = projects.get(key) ?? { key, conversations: 0, updatedAt: 0 };
      entry.conversations += 1;
      entry.updatedAt = Math.max(entry.updatedAt, thread.updatedAt);
      projects.set(key, entry);
    }
  }

  const today = localDay(now);
  // 1970-01-01 was a Thursday, so (n + 3) % 7 is 0 on Mondays.
  const lastMonday = today - ((today + 3) % 7);
  const firstDay = lastMonday - (Math.max(1, weekCount) - 1) * 7;
  const weeks: ActivityDay[][] = [];
  const months: ActivityMonthLabel[] = [];
  let activeDays = 0;
  for (let column = 0; column * 7 + firstDay <= today; column += 1) {
    const week: ActivityDay[] = [];
    for (let row = 0; row < 7; row += 1) {
      const number = firstDay + column * 7 + row;
      const date = calendarDate(number);
      const future = number > today;
      const count = future ? 0 : counts.get(number) ?? 0;
      if (count > 0) activeDays += 1;
      week.push({ key: dayKey(number), date, count, level: activityLevel(count), future });
      // A month is labelled on the column that holds its first day.
      if (date.day === 1 && !future) months.push({ column, month: date.month });
    }
    weeks.push(week);
  }
  // Name the opening partial month unless its label would collide with the next one.
  if (weeks.length > 0 && (months[0]?.column ?? Infinity) > 2) months.unshift({ column: 0, month: weeks[0][0].date.month });

  const activeList = [...counts.keys()].sort((a, b) => a - b);
  return {
    conversations,
    sentMessages,
    activeDays,
    longestStreak: longestRun(activeList),
    currentStreak: currentRun(new Set(activeList), today),
    weeks,
    months,
    projects: [...projects.values()]
      .sort((a, b) => b.conversations - a.conversations || b.updatedAt - a.updatedAt)
      .slice(0, Math.max(0, projectLimit)),
  };
}
