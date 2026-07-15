import { useState } from "react";
import {
  Brain,
  CalendarDays,
  Filter,
  List,
  Network,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyState, IconButton, PageHeading } from "../components/ui";

type MemoryView = "graph" | "timeline" | "list";

export function MemoryPage() {
  const [view, setView] = useState<MemoryView>("graph");

  return (
    <div className="page memory-page">
      <PageHeading
        eyebrow="长期记忆"
        title="记忆"
        description="检索记忆、检查关联，并追踪写入来源。"
        actions={
          <div className="segmented-control" aria-label="记忆视图">
            <button className={view === "graph" ? "is-active" : ""} onClick={() => setView("graph")}><Network size={15} />关联</button>
            <button className={view === "timeline" ? "is-active" : ""} onClick={() => setView("timeline")}><CalendarDays size={15} />时间线</button>
            <button className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}><List size={15} />列表</button>
          </div>
        }
      />

      <div className="memory-toolbar">
        <label className="search-field search-field--wide">
          <Search size={15} aria-hidden="true" />
          <input type="search" placeholder="搜索人物、事件或关键词" aria-label="搜索记忆" />
        </label>
        <button type="button" className="button button--secondary"><Filter size={15} />筛选</button>
        <IconButton label="记忆视图设置"><SlidersHorizontal size={16} /></IconButton>
      </div>

      <div className="memory-workspace">
        <aside className="memory-filters">
          <div className="sidebar-section-label">范围</div>
          <label className="check-row"><input type="checkbox" defaultChecked />全部记忆 <span>--</span></label>
          <label className="check-row"><input type="checkbox" />对话 <span>--</span></label>
          <label className="check-row"><input type="checkbox" />事件 <span>--</span></label>
          <label className="check-row"><input type="checkbox" />偏好 <span>--</span></label>
          <div className="sidebar-section-label">情感强度</div>
          <input className="full-range" type="range" min="0" max="100" defaultValue="0" aria-label="最低情感强度" />
          <small>包含全部强度</small>
        </aside>

        <section className={`memory-canvas memory-canvas--${view}`}>
          {view === "graph" ? (
            <div className="memory-graph">
              <span className="memory-node memory-node--muted memory-node--one">人物</span>
              <span className="memory-node memory-node--muted memory-node--two">事件</span>
              <span className="memory-node memory-node--muted memory-node--three">偏好</span>
              <EmptyState
                icon={<Brain size={25} />}
                title="记忆索引未连接"
                detail="关联图将在 NekoCore 返回记忆边后显示。"
              />
            </div>
          ) : null}
          {view === "timeline" ? (
            <EmptyState icon={<CalendarDays size={25} />} title="时间线为空" detail="尚无可显示的记忆写入记录。" />
          ) : null}
          {view === "list" ? (
            <div className="memory-table-wrap">
              <table className="data-table">
                <thead><tr><th>时间</th><th>摘要</th><th>来源</th><th>强度</th></tr></thead>
                <tbody><tr><td colSpan={4}>尚无记忆记录</td></tr></tbody>
              </table>
            </div>
          ) : null}
        </section>

        <aside className="memory-detail">
          <h2>记忆详情</h2>
          <EmptyState icon={<Brain size={21} />} title="未选择记忆" detail="选择一条记忆查看来源与关联。" />
        </aside>
      </div>
    </div>
  );
}
