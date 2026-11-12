import { useEffect, useMemo, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { buildTrajectory, filterRows, formatDuration, type TrajectoryKind } from "@/app/agent/trajectory";
import { Input } from "@/components/base/input/input";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { SearchIcon, WorkflowIcon } from "@/components/foundations/icons/app-icons";
import { ToolPanelMessage } from "../tools/tool-panel-frame";
import { KIND_LABEL, TrajectoryRow } from "./trajectory-row";
import { TrajectoryTimeline } from "./trajectory-timeline";

const FILTERS: { id: "all" | TrajectoryKind; label: string }[] = [
  { id: "all", label: "全部" }, { id: "user", label: KIND_LABEL.user[0] }, { id: "assistant", label: KIND_LABEL.assistant[0] },
  { id: "tool", label: KIND_LABEL.tool[0] }, { id: "reasoning", label: KIND_LABEL.reasoning[0] },
];
const tokens = (count: number) => count >= 10_000 ? `${(count / 1000).toFixed(0)}k` : count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

/**
 * 轨迹: the open chat as a list of what happened (buildTrajectory), with the
 * totals, a timeline of the timed replies, a search and a kind filter. It
 * reads the same messages as the transcript and updates while a reply
 * streams. Rows open for the full input and result; 在对话中查看 returns to
 * the transcript at that message.
 */
export function TrajectoryView({ messages, messageAt, onJump }: {
  messages: UIMessage[];
  messageAt: Record<string, number | undefined>;
  onJump: (messageId: string) => void;
}) {
  const trajectory = useMemo(() => buildTrajectory(messages, messageAt), [messages, messageAt]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | TrajectoryKind>("all");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string>();
  const list = useRef<HTMLOListElement>(null);
  const rows = useMemo(() => filterRows(trajectory.rows, query, kind === "all" ? undefined : new Set([kind])), [trajectory.rows, query, kind]);
  const { stats } = trajectory;

  useEffect(() => {
    if (!selected) return;
    list.current?.querySelector(`[data-trajectory-row="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const choose = (id: string) => {
    setKind("all");
    setQuery("");
    setSelected(id);
    setOpen((current) => new Set(current).add(id));
  };

  const facts = [
    `${stats.turns} 轮`, `${stats.steps} 步`, `${stats.toolCalls} 次工具调用`,
    stats.timedReplies > 0 && `模型 ${formatDuration(stats.modelMs)} · 工具 ${formatDuration(stats.toolMs)}`,
    stats.inputTokens + stats.outputTokens > 0 && `输入 ${tokens(stats.inputTokens)} · 输出 ${tokens(stats.outputTokens)} tokens`,
  ].filter(Boolean);

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-1">
      <p className="min-w-0 flex-1 text-caption-1-regular text-text-secondary">{facts.join(" · ")}</p>
      <Input aria-label="搜索轨迹" placeholder="搜索" size="small" value={query} onChange={setQuery} leadingIcon={SearchIcon} type="search" className="w-56" />
    </div>
    {trajectory.segments.length > 0
      ? <TrajectoryTimeline segments={trajectory.segments} selected={selected} onSelect={choose} />
      : <p className="shrink-0 px-4 py-1 text-caption-1-regular text-text-tertiary">这段对话的回复生成于记录耗时之前，只显示步骤列表。</p>}
    {stats.timedReplies > 0 && stats.timedReplies < stats.replies && <p className="shrink-0 px-4 pb-1 text-caption-1-regular text-text-tertiary">
      较早的 {stats.replies - stats.timedReplies} 条回复没有耗时记录，不在时间轴上。</p>}
    <PillTabList role="group" aria-label="按类型筛选" className="shrink-0 gap-0.5 px-3 py-1.5">
      {FILTERS.map((filter) => <PillTab key={filter.id} variant="gray" isSelected={kind === filter.id} onSelect={() => setKind(filter.id)}>{filter.label}</PillTab>)}
    </PillTabList>
    {rows.length === 0
      ? <ToolPanelMessage icon={WorkflowIcon} title={trajectory.rows.length === 0 ? "还没有可显示的步骤" : "没有符合条件的步骤"} detail={trajectory.rows.length === 0 ? "发送消息后，这里按顺序列出用户消息、模型回复和工具调用。" : "换个关键词或类型试试。"} />
      : <ol ref={list} aria-label="轨迹" className="min-h-0 flex-1 overflow-y-auto border-t border-separator-border">
        {rows.map((row) => <TrajectoryRow key={row.id} row={row} open={open.has(row.id)} selected={selected === row.id}
          onToggle={() => { setSelected(row.id); toggle(row.id); }} onJump={() => onJump(row.messageId)} />)}
      </ol>}
  </div>;
}
