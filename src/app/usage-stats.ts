import type { StoredThread } from "../components/application/agent-chat/thread-storage";
import { readChatUsage } from "./chat-usage";
import { calendarDate, dayKey, localDay, validTime, type CalendarDate } from "./local-day";

/**
 * Token usage for 设置 → 消耗统计, summed from the usage each reply recorded
 * in this device's chat history. Replies saved before usage was recorded, and
 * providers that report none, are absent: nothing is estimated.
 */

/** Where a reply's chat belongs (a project, no project, contacts), resolved by the caller. */
export interface UsageSource { key: string; label: string }

export interface UsageReply {
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Local day number; absent when the reply has no recorded time. */
  day?: number;
  model: string;
  provider?: string;
  source: UsageSource;
}

export const UNNAMED_MODEL = "未标明模型";

/** Every assistant reply with recorded usage. */
export function collectUsageReplies(threads: readonly StoredThread[], sourceOf: (thread: StoredThread) => UsageSource): UsageReply[] {
  const replies: UsageReply[] = [];
  for (const thread of threads) {
    let source: UsageSource | undefined;
    for (const message of thread.messages) {
      if (message.role !== "assistant") continue;
      const recorded = readChatUsage((message as { metadata?: unknown }).metadata);
      if (!recorded) continue;
      source ??= sourceOf(thread);
      const time = validTime(thread.messageAt[message.id]);
      replies.push({
        tokens: recorded.usage.totalTokens,
        ...(recorded.usage.inputTokens !== undefined ? { inputTokens: recorded.usage.inputTokens } : {}),
        ...(recorded.usage.outputTokens !== undefined ? { outputTokens: recorded.usage.outputTokens } : {}),
        ...(time !== undefined ? { day: localDay(time) } : {}),
        model: recorded.model ?? UNNAMED_MODEL,
        ...(recorded.provider ? { provider: recorded.provider } : {}),
        source,
      });
    }
  }
  return replies;
}

function tokensByDay(replies: readonly UsageReply[]) {
  const perDay = new Map<number, number>();
  for (const reply of replies) if (reply.day !== undefined) perDay.set(reply.day, (perDay.get(reply.day) ?? 0) + reply.tokens);
  return perDay;
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

export interface UsageDay { key: string; date: CalendarDate; tokens: number }

export interface UsageOverview {
  replies: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Tokens from 1 January to today. */
  yearTokens: number;
  /** Change against the same span last year; absent when last year had none. */
  yearChange?: number;
  peakDay?: UsageDay;
  /** Longest run of consecutive days with recorded usage. */
  longestStreak: number;
}

export function usageOverview(replies: readonly UsageReply[], now: number): UsageOverview {
  const perDay = tokensByDay(replies);
  const today = localDay(now);
  const { year } = calendarDate(today);
  const yearStart = localDay(new Date(year, 0, 1).getTime());
  const lastYearStart = localDay(new Date(year - 1, 0, 1).getTime());
  const lastYearToday = lastYearStart + (today - yearStart);
  let yearTokens = 0;
  let lastYearTokens = 0;
  let peak: [number, number] | undefined;
  for (const [day, tokens] of perDay) {
    if (day >= yearStart && day <= today) yearTokens += tokens;
    if (day >= lastYearStart && day <= lastYearToday) lastYearTokens += tokens;
    if (!peak || tokens > peak[1]) peak = [day, tokens];
  }
  return {
    replies: replies.length,
    totalTokens: replies.reduce((sum, reply) => sum + reply.tokens, 0),
    inputTokens: replies.reduce((sum, reply) => sum + (reply.inputTokens ?? 0), 0),
    outputTokens: replies.reduce((sum, reply) => sum + (reply.outputTokens ?? 0), 0),
    yearTokens,
    ...(lastYearTokens > 0 ? { yearChange: (yearTokens - lastYearTokens) / lastYearTokens } : {}),
    ...(peak && peak[1] > 0 ? { peakDay: { key: dayKey(peak[0]), date: calendarDate(peak[0]), tokens: peak[1] } } : {}),
    longestStreak: longestRun([...perDay.keys()].filter((day) => (perDay.get(day) ?? 0) > 0).sort((a, b) => a - b)),
  };
}

export type UsageLevel = 0 | 1 | 2 | 3 | 4;
/** Shade relative to the busiest cell shown, so one heavy day does not flatten the rest into level 1. */
export const usageLevel = (tokens: number, max: number): UsageLevel =>
  tokens <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((tokens / max) * 4))) as UsageLevel;

export interface UsageCell { key: string; label: string; tokens: number; level: UsageLevel; future: boolean; month: number; firstOfMonth: boolean }
export type UsageGranularity = "day" | "week" | "month";

/**
 * Heatmap cells. `day`: 53 weeks × 7 days, Monday first, as columns of seven.
 * `week`: the same 53 weeks, one cell each. `month`: the last 12 months.
 */
export function usageHeatmap(replies: readonly UsageReply[], now: number, granularity: UsageGranularity): UsageCell[][] {
  const perDay = tokensByDay(replies);
  const today = localDay(now);
  const label = (number: number) => { const d = calendarDate(number); return `${d.year}年${d.month + 1}月${d.day}日`; };
  let columns: Omit<UsageCell, "level">[][];
  if (granularity === "month") {
    const { year, month } = calendarDate(today);
    columns = Array.from({ length: 12 }, (_, index) => {
      const start = new Date(year, month - 11 + index, 1);
      const first = localDay(start.getTime());
      const last = localDay(new Date(start.getFullYear(), start.getMonth() + 1, 0).getTime());
      let tokens = 0;
      for (let day = first; day <= last; day += 1) tokens += perDay.get(day) ?? 0;
      return [{ key: dayKey(first), label: `${start.getFullYear()}年${start.getMonth() + 1}月`, tokens, future: false, month: start.getMonth(), firstOfMonth: true }];
    });
  } else {
    // 1970-01-01 was a Thursday, so (n + 3) % 7 is 0 on Mondays.
    const firstDay = today - ((today + 3) % 7) - 52 * 7;
    columns = Array.from({ length: 53 }, (_, column) => {
      const days = Array.from({ length: 7 }, (_, row) => firstDay + column * 7 + row);
      const cells = days.map((number) => {
        const date = calendarDate(number);
        return { key: dayKey(number), label: label(number), tokens: number > today ? 0 : perDay.get(number) ?? 0, future: number > today, month: date.month, firstOfMonth: date.day === 1 };
      });
      if (granularity === "day") return cells;
      const tokens = cells.reduce((sum, cell) => sum + cell.tokens, 0);
      return [{ key: cells[0].key, label: `${cells[0].label} 起一周`, tokens, future: false, month: cells[0].month, firstOfMonth: cells.some((cell) => cell.firstOfMonth) }];
    });
  }
  const max = Math.max(0, ...columns.flat().map((cell) => cell.tokens));
  return columns.map((cells) => cells.map((cell) => ({ ...cell, level: usageLevel(cell.tokens, max) })));
}

export type UsageRange = "7d" | "30d" | "all";
export interface UsageNode { key: string; label: string; detail?: string; tokens: number }
export interface UsageLink { source: string; target: string; tokens: number }
export interface UsageFlow { total: number; sources: UsageNode[]; models: UsageNode[]; links: UsageLink[] }

const OTHER = "\u0000other";

function topWithOther(nodes: UsageNode[], limit: number) {
  const sorted = [...nodes].sort((a, b) => b.tokens - a.tokens);
  if (sorted.length <= limit) return { kept: sorted, folded: new Set<string>() };
  const kept = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1);
  return {
    kept: [...kept, { key: OTHER, label: "其他", tokens: rest.reduce((sum, node) => sum + node.tokens, 0) }],
    folded: new Set(rest.map((node) => node.key)),
  };
}

/**
 * Where tokens went in a time range: chat sources (projects, chats without a
 * project, contacts) on the left, models on the right. Smaller nodes fold
 * into “其他” so the chart stays readable. Replies without a time only count
 * toward “all”.
 */
export function usageFlow(replies: readonly UsageReply[], now: number, range: UsageRange, { sources: sourceLimit = 5, models: modelLimit = 6 } = {}): UsageFlow {
  const today = localDay(now);
  const from = range === "7d" ? today - 6 : range === "30d" ? today - 29 : -Infinity;
  const inRange = replies.filter((reply) => reply.tokens > 0 && (range === "all" || (reply.day !== undefined && reply.day >= from && reply.day <= today)));
  const sources = new Map<string, UsageNode>();
  const models = new Map<string, UsageNode>();
  const modelKey = (reply: UsageReply) => `${reply.provider ?? ""}\u0001${reply.model}`;
  for (const reply of inRange) {
    const source = sources.get(reply.source.key) ?? { key: reply.source.key, label: reply.source.label, tokens: 0 };
    source.tokens += reply.tokens;
    sources.set(source.key, source);
    const key = modelKey(reply);
    const model = models.get(key) ?? { key, label: reply.model, ...(reply.provider ? { detail: reply.provider } : {}), tokens: 0 };
    model.tokens += reply.tokens;
    models.set(key, model);
  }
  const keptSources = topWithOther([...sources.values()], sourceLimit);
  const keptModels = topWithOther([...models.values()], modelLimit);
  const links = new Map<string, UsageLink>();
  for (const reply of inRange) {
    const source = keptSources.folded.has(reply.source.key) ? OTHER : reply.source.key;
    const key = modelKey(reply);
    const target = keptModels.folded.has(key) ? OTHER : key;
    const id = `${source}\u0002${target}`;
    const link = links.get(id) ?? { source, target, tokens: 0 };
    link.tokens += reply.tokens;
    links.set(id, link);
  }
  return {
    total: inRange.reduce((sum, reply) => sum + reply.tokens, 0),
    sources: keptSources.kept,
    models: keptModels.kept,
    links: [...links.values()].sort((a, b) => b.tokens - a.tokens),
  };
}

/** 1.2K / 3.4M / 5.6B for compact token counts. */
export function formatTokens(value: number) {
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, unit] of units) {
    if (value >= size) {
      const scaled = value / size;
      return `${scaled >= 100 ? Math.round(scaled) : Number(scaled.toFixed(1))}${unit}`;
    }
  }
  return String(value);
}
