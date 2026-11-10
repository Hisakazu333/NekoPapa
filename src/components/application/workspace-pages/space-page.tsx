import { useState } from "react";
import { MenuIcon, SearchIcon } from "@/components/foundations/icons/app-icons";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Input } from "@/components/base/input/input";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { ToolbarIconButton } from "@/components/application/dashboard/toolbar-icon-button";
import { cx } from "@/utils/cx";
import { spaceCategories, spaceEmptyState, spaceLibrary, spaceScopes, type SpaceCategory, type SpaceScope } from "./space-catalog";

function CategoryButton({ id, selected, onSelect, compact = false }: { id: SpaceCategory; selected: boolean; onSelect: () => void; compact?: boolean }) {
  const { label, icon: Icon } = spaceCategories[id];
  return <button type="button" aria-current={selected ? "page" : undefined} onClick={onSelect} className={cx(
    "flex shrink-0 cursor-pointer items-center gap-2 rounded-2lg px-2 py-1.5 text-start outline-none transition-colors",
    "hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
    selected && "bg-background-tertiary-default", !compact && "w-full",
  )}>
    <Icon className={cx("size-[18px] shrink-0", selected ? "text-foreground-icon-primary" : "text-foreground-icon-secondary")} aria-hidden />
    <span className={cx("truncate text-body-medium", selected ? "text-text-primary" : "text-text-secondary")}>{label}</span>
  </button>;
}

/**
 * 空间: a library of everything NekoPapa keeps, after Codex's 资料空间 —
 * categories on the left; scope tabs, search and a 名称 / 来源 / 上次活动
 * list on the right (BoardUI Table, PillTab, Input). No data source is
 * connected yet: search is disabled and every list shows its empty state.
 */
export function SpacePage({ onNavigate }: { onNavigate?: () => void }) {
  const [category, setCategory] = useState<SpaceCategory>("all");
  const [scope, setScope] = useState<SpaceScope>("recent");
  const { label } = spaceCategories[category];
  const empty = spaceEmptyState(category, scope);

  return <section aria-label="空间" className="relative flex h-full min-w-0 flex-1 overflow-hidden rounded-3xl bg-background-secondary-default">
    <aside aria-label="空间分类" className="hidden w-52 shrink-0 flex-col gap-1 border-e border-separator-border p-3 md:flex">
      <h1 className="px-2 pb-2 pt-1 text-title-3-medium text-text-primary">空间</h1>
      <nav aria-label="分类" className="flex flex-col gap-0.5">
        {spaceLibrary.map((id) => <CategoryButton key={id} id={id} selected={category === id} onSelect={() => setCategory(id)} />)}
      </nav>
      <div className="mt-auto">
        <CategoryButton id="trash" selected={category === "trash"} onSelect={() => setCategory("trash")} />
      </div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3 lg:hidden">
        {onNavigate && <ToolbarIconButton icon={MenuIcon} label="打开导航" onPress={onNavigate} />}
        <span className="text-body-medium text-text-primary md:hidden">空间</span>
      </header>
      <nav aria-label="分类" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {[...spaceLibrary, "trash" as const].map((id) => <CategoryButton key={id} id={id} compact selected={category === id} onSelect={() => setCategory(id)} />)}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-6 sm:px-8 lg:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title-1-semibold text-text-primary">{label}</h2>
            <Input aria-label="搜索空间" placeholder="搜索空间" leadingIcon={SearchIcon} isDisabled className="w-full sm:w-64" />
          </div>

          <div role="status" className="flex items-start gap-3 rounded-2xl border border-separator-border bg-background-primary-default p-3">
            <StatusDot color="yellow" className="mt-1" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body-medium text-text-primary">空间尚未接入数据</p>
              <p className="text-body-2-regular text-text-secondary">这一页先确定分类与列表结构。接入后，本机的对话、项目和文件会汇总到这里；不会显示示例内容。</p>
            </div>
          </div>

          {category !== "trash" && <PillTabList aria-label="范围" className="flex gap-1 self-start">
            {spaceScopes.map(({ id, label: name }) => <PillTab key={id} variant="gray" isSelected={scope === id} onSelect={() => setScope(id)}>{name}</PillTab>)}
          </PillTabList>}

          <Table aria-label={`${label}列表`} size="sm">
            <TableHeader>
              <TableColumn isRowHeader>名称</TableColumn>
              <TableColumn>来源</TableColumn>
              <TableColumn>上次活动</TableColumn>
            </TableHeader>
            <TableBody items={[] as { id: string }[]} renderEmptyState={() => <div className="flex flex-col items-center gap-1 px-4 py-14 text-center">
              <p className="text-body-medium text-text-primary">{empty.title}</p>
              <p className="max-w-[360px] text-body-2-regular text-text-secondary">{empty.description}</p>
            </div>}>
              {(item) => <TableRow id={item.id}><TableCell /><TableCell /><TableCell /></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  </section>;
}
