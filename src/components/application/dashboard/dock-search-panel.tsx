import { useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/foundations/icons/app-icons";
import { DashboardSidebarSearchResults } from "./dashboard-sidebar-search-results";
import { filterSidebarSearch, sidebarSearchOptionId, type SidebarSearchEntry } from "./sidebar-search";

/**
 * 快速搜索 in the dock's panel: the sidebar's search over chats, contacts,
 * pages and settings, with the same results list and arrow / Enter keys.
 * Escape closes the panel (the popover's own handling) and focus returns to
 * the dock tile.
 */
export function DockSearchPanel({ entries, onSelect, onClose }: {
  entries: SidebarSearchEntry[];
  onSelect?: (entry: SidebarSearchEntry) => boolean | void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = filterSidebarSearch(entries, query);
  const choose = (entry: SidebarSearchEntry) => { if (onSelect?.(entry) !== false) onClose(); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      choose(results[active]);
    }
  };
  const searching = Boolean(query.trim());

  return <div className="flex flex-col gap-2 p-2">
    <div className="flex items-center gap-2 rounded-full bg-background-tertiary-default py-2 pe-2.5 ps-2 ring-2 ring-inset ring-border-button-active">
      <SearchIcon className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <input type="search" role="combobox" aria-label="快速搜索" aria-autocomplete="list" aria-controls="sidebar-search-results"
        aria-expanded={searching} autoFocus value={query} placeholder="搜索聊天、联系人和设置"
        aria-activedescendant={searching && results[active] ? sidebarSearchOptionId(results[active].id) : undefined}
        onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent text-body-medium text-text-primary outline-none placeholder:text-text-tertiary" />
    </div>
    {searching
      ? <DashboardSidebarSearchResults entries={results} activeIndex={active} onSelect={choose} />
      : <p className="px-2 pb-1 text-body-2-regular text-text-tertiary">搜索会话内容、联系人名称和设置</p>}
  </div>;
}
