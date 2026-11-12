import { formatDuration, type TrajectoryKind, type TrajectoryRow as Row } from "@/app/agent/trajectory";
import { Chip, type ChipColor } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { ArrowUpRightIcon, ChevronRightIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";

export const KIND_LABEL: Record<TrajectoryKind, [string, ChipColor]> = {
  user: ["用户", "blue"], assistant: ["助手", "purple"], reasoning: ["思考", "gray"], tool: ["工具", "orange"],
};
const STATUS_LABEL = { running: "进行中", awaiting: "等待确认", done: "", error: "出错", denied: "已拒绝" } as const;

function Detail({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return <div className="flex min-w-0 flex-col gap-1">
    <span className="text-caption-1-medium text-text-tertiary">{label}</span>
    <pre translate="no" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background-secondary-default px-2.5 py-2 font-mono text-caption-1-regular leading-5 text-text-primary">{text}</pre>
  </div>;
}

/** One event of the chat: its kind, a one-line summary and its time; open for the full input and result. */
export function TrajectoryRow({ row, open, selected, onToggle, onJump }: {
  row: Row; open: boolean; selected: boolean; onToggle: () => void; onJump: () => void;
}) {
  const [label, color] = KIND_LABEL[row.kind];
  const status = row.status ? STATUS_LABEL[row.status] : "";
  return <li data-trajectory-row={row.id} className={cx("border-b border-separator-border", selected && "bg-background-primary-hover")}>
    <button type="button" aria-expanded={open} onClick={onToggle}
      className="flex min-h-10 w-full cursor-pointer items-center gap-3 px-4 py-2 text-start outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring">
      <ChevronRightIcon className={cx("size-3.5 shrink-0 text-text-tertiary transition-transform", open && "rotate-90")} aria-hidden />
      <Chip variant="caption" color={color} className="w-9 shrink-0 justify-center">{label}</Chip>
      {row.name && <span translate="no" className="shrink-0 font-mono text-caption-1-medium text-text-primary">{row.name}</span>}
      <span translate={row.kind === "tool" ? "no" : undefined} className={cx("min-w-0 flex-1 truncate text-body-2-regular", row.kind === "tool" ? "font-mono text-caption-1-regular text-text-secondary" : "text-text-primary", row.kind === "reasoning" && "text-text-secondary")}>{row.summary || "（无文字）"}</span>
      {status && <span className={cx("shrink-0 text-caption-1-regular", row.status === "error" || row.status === "denied" ? "text-text-error-primary" : "text-text-tertiary")}>{status}</span>}
      {row.durationMs !== undefined && <span className="w-16 shrink-0 text-end font-mono text-caption-1-regular tabular-nums text-text-tertiary">{formatDuration(row.durationMs)}</span>}
    </button>
    {open && <div className="flex flex-col gap-2.5 px-4 pb-3 ps-11">
      {row.kind === "tool" ? <><Detail label="参数" text={row.input} /><Detail label="结果" text={row.output} /></>
        : <Detail label={row.kind === "user" ? "消息" : row.kind === "reasoning" ? "思考" : "回复"} text={row.input ?? row.output} />}
      <div className="flex items-center gap-3">
        {row.at && <span className="text-caption-1-regular text-text-tertiary">{new Date(row.at).toLocaleString()}</span>}
        <Button variant="secondary" size="xs" leadingIcon={ArrowUpRightIcon} onClick={onJump}>在对话中查看</Button>
      </div>
    </div>}
  </li>;
}
