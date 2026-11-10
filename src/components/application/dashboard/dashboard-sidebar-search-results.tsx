import { useEffect } from "react";
import { ContactIcon, MessageCircleIcon, SettingsIcon } from "@/components/foundations/icons/app-icons";
import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";
import { sidebarSearchOptionId, type SidebarSearchEntry } from "./sidebar-search";
import { cx } from "@/utils/cx";

const icons = {
  page: MessageCircleIcon, thread: MessageCircleIcon, contact: ContactIcon, setting: SettingsIcon,
};

export function DashboardSidebarSearchResults({
  entries, activeIndex, onSelect,
}: {
  entries: SidebarSearchEntry[];
  activeIndex: number;
  onSelect: (entry: SidebarSearchEntry) => void;
}) {
  const localize = useTemplateCopy();
  const activeEntry = entries[activeIndex];

  useEffect(() => {
    if (!activeEntry) return;
    document.getElementById(sidebarSearchOptionId(activeEntry.id))?.scrollIntoView({ block: "nearest" });
  }, [activeEntry]);

  if (entries.length === 0) {
    return localize(<p className="px-2 py-3 text-body-2-regular text-text-tertiary">未找到匹配内容</p>);
  }

  return localize(<div id="sidebar-search-results" role="listbox" aria-label="搜索结果" className="flex max-h-[min(52dvh,420px)] flex-col gap-3 overflow-y-auto">
    {groupEntries(entries).map(([group, items]) => <section key={group} className="flex flex-col gap-1">
      <p className="px-2 pt-1 text-body-2-medium text-text-tertiary">{group}</p>
      {items.map((entry) => <SearchResult key={entry.id} entry={entry} active={activeEntry?.id === entry.id} onSelect={onSelect} />)}
    </section>)}
  </div>);
}

function groupEntries(entries: SidebarSearchEntry[]) {
  const groups = new Map<string, SidebarSearchEntry[]>();
  for (const entry of entries) groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry]);
  return [...groups];
}

function SearchResult({ entry, active, onSelect }: {
  entry: SidebarSearchEntry; active: boolean; onSelect: (entry: SidebarSearchEntry) => void;
}) {
  const Icon = icons[entry.target.type];
  const userContent = entry.target.type === "thread" || entry.target.type === "contact";
  return <button id={sidebarSearchOptionId(entry.id)} type="button" role="option" aria-selected={active}
    onClick={() => onSelect(entry)}
    className={cx(
      "flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-2lg px-2 py-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
      active ? "bg-background-secondary-hover" : "hover:bg-background-secondary-hover/60",
    )}>
    <Icon className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span translate={userContent ? "no" : undefined} className="truncate text-body-2-medium text-text-primary">{entry.title}</span>
      <span translate={userContent ? "no" : undefined} className="line-clamp-2 text-body-2-regular text-text-tertiary">{entry.subtitle}</span>
    </span>
  </button>;
}
