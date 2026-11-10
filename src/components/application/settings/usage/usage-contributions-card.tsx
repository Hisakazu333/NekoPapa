import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatTokens, usageHeatmap, type UsageGranularity, type UsageLevel, type UsageOverview, type UsageReply } from "@/app/usage/usage-stats";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";

const LEVEL: Record<UsageLevel, string> = {
  0: "bg-chart-track",
  1: "bg-accent-500/25",
  2: "bg-accent-500/45",
  3: "bg-accent-500/70",
  4: "bg-accent-500",
};
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const GRANULARITY: [UsageGranularity, string][] = [["day", "每日"], ["week", "每周"], ["month", "每月"]];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-background-primary-default p-3">
      <p className="truncate text-title-3-medium tabular-nums text-text-primary">{value}</p>
      <p className="truncate text-caption-1-regular text-text-secondary">{label}</p>
      {note && <p className="truncate text-caption-1-regular text-text-tertiary">{note}</p>}
    </div>
  );
}

/**
 * Contributions-style token card (layout after BoardUI's Pro Contributions
 * Card, rebuilt from existing tokens and SegmentedControl): this year's total
 * with the change against the same span last year, four totals, and a heatmap
 * shown per day, per week or per month.
 */
export function UsageContributionsCard({ replies, overview, now }: { replies: readonly UsageReply[]; overview: UsageOverview; now: number }) {
  const [granularity, setGranularity] = useState<UsageGranularity>("day");
  const columns = useMemo(() => usageHeatmap(replies, now, granularity), [replies, now, granularity]);
  const scroller = useRef<HTMLDivElement>(null);
  // Open on the newest weeks. The modal may still be laying out on mount, so
  // follow size changes too, until the person scrolls the heatmap themselves.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let pinned = true;
    const toEnd = () => { if (pinned) element.scrollLeft = element.scrollWidth; };
    const release = () => { pinned = false; };
    toEnd();
    const observer = new ResizeObserver(toEnd);
    observer.observe(element);
    element.addEventListener("pointerdown", release);
    element.addEventListener("wheel", release, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("pointerdown", release); element.removeEventListener("wheel", release); };
  }, [granularity]);
  const change = overview.yearChange;
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };
  const rows = columns[0]?.length ?? 1;
  // A label on the column holding a month's first day (every column in the monthly view).
  const labels = columns.flatMap((cells, column) => cells.some((cell) => cell.firstOfMonth && !cell.future)
    ? [{ column, month: (cells.find((cell) => cell.firstOfMonth) ?? cells[0]).month }] : []);
  const span = granularity === "month" ? 1 : 3;

  return (
    <section aria-labelledby="usage-year-title" className="@container flex flex-col gap-4 rounded-2xl bg-background-secondary-default p-4">
      <div className="flex flex-col gap-1">
        <h3 id="usage-year-title" className="text-body-2-regular text-text-secondary">今年消耗的 Token</h3>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-title-1-semibold tabular-nums text-text-primary" title={overview.yearTokens.toLocaleString()}>{formatTokens(overview.yearTokens)}</p>
          {change !== undefined && Number.isFinite(change) && <span className={cx(
            "rounded-md px-1.5 py-0.5 text-caption-1-medium tabular-nums",
            change >= 0 ? "bg-accent-500/15 text-text-primary" : "bg-background-tertiary-default text-text-secondary",
          )} title="与去年同期相比">{change >= 0 ? "+" : ""}{(change * 100).toFixed(1)}%</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Stat label="累计 Token" value={formatTokens(overview.totalTokens)} note={`${overview.replies.toLocaleString()} 次回复`} />
        <Stat label="单日峰值" value={formatTokens(overview.peakDay?.tokens ?? 0)}
          note={overview.peakDay ? `${overview.peakDay.date.month + 1}月${overview.peakDay.date.day}日` : undefined} />
        <Stat label="输入 / 输出" value={`${formatTokens(overview.inputTokens)} / ${formatTokens(overview.outputTokens)}`} />
        <Stat label="最长连续使用" value={`${overview.longestStreak} 天`} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body-2-medium text-text-secondary">活动</p>
          <SegmentedControl aria-label="热力图粒度" variant="plain" selectedKeys={[granularity]}
            onSelectionChange={(keys) => { const next = Array.from(keys)[0]; if (next === "day" || next === "week" || next === "month") setGranularity(next); }}>
            {GRANULARITY.map(([key, label]) => <SegmentedControlItem key={key} id={key}>{label}</SegmentedControlItem>)}
          </SegmentedControl>
        </div>
        <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
          <div role="img" aria-label={`按${GRANULARITY.find(([key]) => key === granularity)![1].slice(1)}显示的 Token 用量`}
            className={cx("flex flex-col gap-[3px]", granularity !== "month" && "min-w-[520px]")}>
            <div className="grid gap-[3px]" style={{ ...grid, gridAutoFlow: "column", gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
              {columns.flat().map((cell) => <span key={cell.key}
                title={cell.future ? undefined : `${cell.label} · ${cell.tokens.toLocaleString()} Token`}
                className={cx("rounded-[3px]", granularity === "day" ? "aspect-square" : "h-6", cell.future ? "invisible" : LEVEL[cell.level])} />)}
            </div>
            <div aria-hidden className="grid h-4 gap-x-[3px]" style={grid}>
              {labels.map((label) => <span key={label.column} style={{ gridColumn: `${label.column + 1} / span ${Math.min(span, columns.length - label.column)}`, gridRow: 1 }}
                className="whitespace-nowrap text-caption-2-regular text-text-tertiary">{MONTHS[label.month]}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
