import { useMemo } from "react";
import { placeSegments, type Lane, type TimelineSegment } from "@/app/agent/trajectory";
import { cx } from "@/utils/cx";

const LANES: { lane: Lane; label: string; color: string }[] = [
  { lane: "input", label: "输入", color: "bg-status-lime-text" },
  { lane: "model", label: "模型", color: "bg-status-purple-text" },
  { lane: "tool", label: "工具", color: "bg-status-orange-text" },
];

/**
 * The chat's work on one axis, a lane each for the user's messages, the
 * model's steps and the tool calls. Waiting between turns is shortened
 * (placeSegments), so the bars show where time went while working.
 * Choosing a bar selects its row in the list.
 */
export function TrajectoryTimeline({ segments, selected, onSelect }: { segments: readonly TimelineSegment[]; selected?: string; onSelect: (rowId: string) => void }) {
  const placed = useMemo(() => placeSegments(segments), [segments]);
  return <div className="grid shrink-0 grid-cols-[2.5rem_1fr] gap-x-2 gap-y-1 px-4 py-2" aria-label="时间轴" role="group">
    {LANES.map(({ lane, label, color }) => <div key={lane} className="contents">
      <span className="text-caption-1-regular leading-4 text-text-tertiary">{label}</span>
      <div className="relative h-4 overflow-hidden rounded-sm bg-background-primary-default">
        {placed.filter(({ segment }) => segment.lane === lane).map(({ segment, left, width }, index) =>
          <button key={`${segment.rowId}-${index}`} type="button" tabIndex={-1} aria-hidden
            onClick={() => onSelect(segment.rowId)}
            className={cx("absolute inset-y-0.5 min-w-[3px] cursor-pointer rounded-[2px] opacity-70 hover:opacity-100", color, selected === segment.rowId && "opacity-100 ring-1 ring-border-focus-ring")}
            style={{ left: `${left * 100}%`, width: `${width * 100}%` }} />)}
      </div>
    </div>)}
  </div>;
}
