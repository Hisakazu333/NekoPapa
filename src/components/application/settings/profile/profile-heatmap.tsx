import { useLayoutEffect, useRef } from "react";
import type { ActivityLevel, ProfileActivity } from "@/app/profile-activity";
import { cx } from "@/utils/cx";

const LEVEL: Record<ActivityLevel, string> = {
  0: "bg-chart-track",
  1: "bg-accent-500/25",
  2: "bg-accent-500/45",
  3: "bg-accent-500/70",
  4: "bg-accent-500",
};
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const WEEKDAYS = ["周一", "", "周三", "", "周五", "", ""];

/**
 * A year of sent messages, one square per day, Monday at the top. The grid
 * stretches to the card; on narrow windows it keeps a readable minimum size
 * and scrolls, starting at the current week.
 */
export function ProfileHeatmap({ activity }: { activity: ProfileActivity }) {
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);
  const columns = activity.weeks.length;
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  const summary = `近一年有 ${activity.activeDays} 天发送过消息`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-medium text-text-primary">{summary}</p>
        <div aria-hidden className="flex items-center gap-1 text-caption-1-regular text-text-tertiary">
          <span className="me-1">少</span>
          {([0, 1, 2, 3, 4] as const).map((level) => <span key={level} className={cx("size-2.5 rounded-[3px]", LEVEL[level])} />)}
          <span className="ms-1">多</span>
        </div>
      </div>
      <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
        <div role="img" aria-label={summary} className="flex min-w-[520px] gap-1.5">
          <div className="grid shrink-0 grid-rows-[auto_repeat(7,minmax(0,1fr))] gap-[3px] pe-0.5 text-caption-2-regular text-text-tertiary" aria-hidden>
            <span className="h-4" />
            {WEEKDAYS.map((label, row) => <span key={row} className="flex items-center leading-none">{label}</span>)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]" aria-hidden>
            {/* Same columns and column gap as the squares, so each label sits on its week. */}
            <div className="grid h-4 gap-x-[3px]" style={grid}>
              {activity.months.map((label) => <span key={`${label.column}-${label.month}`}
                style={{ gridColumn: `${label.column + 1} / span ${Math.min(3, columns - label.column)}`, gridRow: 1 }}
                className="whitespace-nowrap text-caption-2-regular text-text-tertiary">{MONTHS[label.month]}</span>)}
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={grid}>
              {activity.weeks.flat().map((day) => <span key={day.key}
                title={day.future ? undefined : `${day.date.year}年${day.date.month + 1}月${day.date.day}日 · ${day.count} 条消息`}
                className={cx("aspect-square rounded-[3px]", day.future ? "invisible" : LEVEL[day.level])} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
