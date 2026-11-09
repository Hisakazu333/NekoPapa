"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  RiCloseLine,
  RiSearchLine,
  RiSideBarFill,
} from "@remixicon/react";
import { DashboardSidebarFooter } from "./dashboard-sidebar-footer";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Kbd } from "@/components/base/kbd/kbd";
import { Collapsible, NavRows, DASHBOARD_NAV, type DashboardNavItem, type DashboardNavKey } from "./sidebar-navigation";
import { SidebarResizeFrame } from "./sidebar-resize-frame";
import { SidebarMoreMenu, type SidebarMoreEntry } from "./sidebar-more-menu";
export { DASHBOARD_NAV, type DashboardNavItem, type DashboardNavKey } from "./sidebar-navigation";
import { cx } from "@/utils/cx";
import { filterSidebarSearch, isSidebarQuickSearchShortcut, sidebarQuickSearchShortcut, sidebarSearchOptionId, type SidebarSearchEntry } from "./sidebar-search";
import { DashboardSidebarSearchResults } from "./dashboard-sidebar-search-results";

/**
 * Figma sources:
 *   expanded  → Board UI → dashboard 1 → Sidebar (node 3731:2934)
 *   collapsed → Board UI → Sidebar (node 3768:3382)
 *
 * Floating sidebar panel. Expanded: 280px wide, p 12, radius/3xl (24px),
 * white 1px border, "Background/Sidebar Elevation" shadow, bg
 * background/secondary. Collapsed: 60px wide (36px icon items + 12px
 * padding); collapse button sits centered above the workspace avatar, quick
 * search becomes a 36px neutral-200 square, nav items become icon-only
 * squares, and the account avatar stays visible.
 *
 * The two states morph into each other: the panel width animates while
 * labels / badges / kbd collapse via max-width + opacity.
 */

export function DashboardSidebar({
  mobile = false,
  onClose,
  fluid = false,
  selected = "chat",
  items = DASHBOARD_NAV,
  flat = false,
  children,
  className,
  searchEntries = [],
  onSearchSelect,
  more,
}: {
  /** Rendered inside the mobile drawer: always expanded, close button instead of collapse. */
  mobile?: boolean;
  onClose?: () => void;
  /** Expanded width fills its container below `lg` instead of the fixed
   *  280px (e.g. the landing page, where the sidebar isn't in a drawer).
   *  Collapsed width stays the fixed 60px rail at every breakpoint — the
   *  whole point of collapsing is to shrink, so it must never get
   *  overridden back to full width. */
  fluid?: boolean;
  /** Which nav item shows the selected (filled blue) state. */
  selected?: DashboardNavKey;
  /** Navigation rows for capabilities wired into the current workspace. */
  items?: DashboardNavItem[];
  /** Removes the floating panel treatment for a sidebar revealed beneath mobile content. */
  flat?: boolean;
  /** Product-specific navigation below the primary workspace entry. */
  children?: (collapsed: boolean) => ReactNode;
  /** Current local conversations, contacts, pages and settings. */
  searchEntries?: SidebarSearchEntry[];
  onSearchSelect?: (entry: SidebarSearchEntry) => boolean | void;
  /** Codex-style "更多" panel of secondary destinations with pin toggles. */
  more?: { entries: SidebarMoreEntry[]; notice?: string; onTogglePin: (id: string) => void };
  className?: string;
} = {}) {
  const localize = useTemplateCopy();
  const [collapsedState, setCollapsed] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchFieldRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const collapsed = mobile ? false : collapsedState;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchResults = filterSidebarSearch(searchEntries, query);
  const chooseSearchResult = (entry: SidebarSearchEntry) => {
    if (onSearchSelect?.(entry) === false) return;
    deactivateSearch(false);
  };
  const activeSearchEntry = searchResults[activeSearchIndex];
  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      deactivateSearch(true);
    } else if (event.key === "ArrowDown" && searchResults.length) {
      event.preventDefault();
      setActiveSearchIndex((index) => (index + 1) % searchResults.length);
    } else if (event.key === "ArrowUp" && searchResults.length) {
      event.preventDefault();
      setActiveSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === "Enter" && searchResults[activeSearchIndex]) {
      event.preventDefault();
      chooseSearchResult(searchResults[activeSearchIndex]);
    }
  };

  const activateSearch = useCallback(() => {
    if (!mobile) setCollapsed(false);
    setSearchActive(true);
  }, [mobile]);

  const deactivateSearch = useCallback((restoreFocus: boolean) => {
    setQuery("");
    setSearchActive(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => searchTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!searchActive) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchActive]);

  useEffect(() => {
    if (!searchActive) return;

    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && searchFieldRef.current?.contains(target)) return;
      deactivateSearch(false);
    };

    document.addEventListener("click", onOutsideClick);
    return () => document.removeEventListener("click", onOutsideClick);
  }, [deactivateSearch, searchActive]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || !isSidebarQuickSearchShortcut(event, navigator.platform)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']"))) return;
      event.preventDefault();
      activateSearch();
    };

    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [activateSearch]);

  return localize((
    <SidebarResizeFrame enabled={!mobile} collapsed={collapsedState} onCollapsedChange={setCollapsed} className={mobile ? undefined : className}>
    <aside
      className={cx(
        "flex h-full shrink-0 flex-col justify-between overflow-hidden",
        flat
          ? "bg-background-full"
          : "rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar",
        "transition-[width] duration-300 ease-in-out",
        // Collapsed rail keeps the 60px spec: 1px border + 11px padding on each
        // side leaves an exactly 36px column so the w-9 (36px) icon items center.
        collapsed
          ? "w-[60px] px-[11px] py-3"
          : fluid
            ? "w-full p-3 lg:w-[280px]"
            : "w-[280px] p-3",
        mobile ? className : undefined,
      )}
      style={mobile ? undefined : { width: "100%" }}
    >
      {/* `overflow-y: auto` forces the x axis to clip too, and this box hugs
          its contents on every side — so the selected item's 1px ring, the
          profile's hover pill (which outsets 6px) and focus rings all landed
          outside it. Padding moves the clip edge out; the matching negative
          margin borrows that space back from the rail's own padding, leaving
          every child exactly where it was. */}
      <div
        className="-m-2 flex min-h-0 w-[calc(100%+16px)] flex-col gap-3 overflow-y-auto p-2 [scrollbar-width:none]"
      >
        {/* Local workspace identity lives in the macOS title bar when available. */}
        <div
          className={cx(
            "flex w-full transition-[gap] duration-300 ease-in-out",
            collapsed
              ? "flex-col-reverse items-start justify-center gap-2.5"
              : "flex-row items-center justify-between",
          )}
        >
          <div
            className={cx(
              "-m-2 min-w-0 overflow-hidden p-2 transition-[max-width,opacity,transform] duration-300 ease-in-out",
              mobile && flat && searchActive
                ? "max-w-0 scale-95 opacity-0"
                : "max-w-[206px] scale-100 opacity-100",
            )}
          >
            <div
              aria-label="NekoPapa local workspace"
              className={cx("flex min-w-0 items-center gap-2", collapsed && "w-9 justify-center gap-0")}
            >
              <img
                src="/brand/nekopapa-app-icon-v1-128.png"
                alt=""
                className="size-8 shrink-0 rounded-full object-contain"
              />
              <Collapsible collapsed={collapsed}>
                <span className="text-body-medium whitespace-nowrap text-text-primary">NekoPapa</span>
              </Collapsible>
            </div>
          </div>
          {mobile && flat ? (
            <div
              ref={searchFieldRef}
              className={cx(
                "flex h-9 items-center overflow-hidden rounded-full bg-background-tertiary-default transition-[width,box-shadow] duration-300 ease-in-out",
                searchActive
                  ? "w-full gap-2 pe-2.5 ps-2 ring-2 ring-inset ring-border-button-active"
                  : "w-9 gap-0 px-2",
              )}
            >
              <button
                ref={searchTriggerRef}
                type="button"
                aria-label="Search"
                onClick={activateSearch}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center text-foreground-icon-secondary"
              >
                <RiSearchLine className="size-5" aria-hidden />
              </button>
              <input
                ref={searchInputRef}
                type="search"
                role="combobox"
                aria-label="Filter workspace navigation"
                aria-autocomplete="list"
                aria-controls="sidebar-search-results"
                aria-expanded={searchActive && Boolean(normalizedQuery)}
                aria-activedescendant={activeSearchEntry ? sidebarSearchOptionId(activeSearchEntry.id) : undefined}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveSearchIndex(0); }}
                onKeyDown={onSearchKeyDown}
                placeholder="搜索聊天、联系人和设置"
                tabIndex={searchActive ? 0 : -1}
                className={cx(
                  "min-w-0 bg-transparent text-body-medium tracking-[-0.015em] text-text-primary outline-none placeholder:text-text-tertiary",
                  "transition-[width,opacity] duration-200 ease-in-out",
                  searchActive
                    ? "w-full flex-1 opacity-100 delay-100"
                    : "pointer-events-none w-0 flex-none opacity-0 delay-0",
                )}
              />
              <CloseButton
                size="2xs"
                aria-label="Clear navigation search"
                onClick={() => deactivateSearch(true)}
                className={cx(
                  "shrink-0 bg-background-tertiary-hover transition-opacity duration-150",
                  searchActive ? "opacity-100 delay-150" : "pointer-events-none opacity-0 delay-0",
                )}
              />
            </div>
          ) : mobile ? (
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={onClose}
              className="cursor-pointer text-foreground-icon-secondary"
            >
              <RiCloseLine className="size-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={() => {
                if (!collapsedState) deactivateSearch(false);
                setCollapsed(!collapsedState);
              }}
              className={cx(
                "cursor-pointer text-foreground-icon-secondary transition-transform duration-300 ease-in-out",
                collapsed && "flex w-9 items-center justify-center",
              )}
            >
              <RiSideBarFill
                className={cx("size-5 transition-transform duration-300 ease-in-out", collapsed ? "rtl:-scale-x-100" : "-scale-x-100 rtl:scale-x-100")}
                aria-hidden
              />
            </button>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          {/* Quick search */}
          {!flat && (searchActive && !collapsed ? (
            <div
              ref={searchFieldRef}
              className="flex w-full items-center gap-2 rounded-full bg-background-tertiary-default py-2 pe-2.5 ps-2 ring-2 ring-inset ring-border-button-active transition-[background-color,box-shadow] duration-[var(--input-transition-ms)] ease"
            >
              <RiSearchLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Filter workspace navigation"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="sidebar-search-results"
                aria-expanded={searchActive && Boolean(normalizedQuery)}
                aria-activedescendant={activeSearchEntry ? sidebarSearchOptionId(activeSearchEntry.id) : undefined}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveSearchIndex(0); }}
                onKeyDown={onSearchKeyDown}
                placeholder="搜索聊天、联系人和设置"
                className="min-w-0 flex-1 bg-transparent text-body-medium text-text-primary outline-none placeholder:text-text-tertiary"
              />
              <CloseButton
                size="2xs"
                aria-label="Clear navigation search"
                onClick={() => deactivateSearch(true)}
                className="bg-background-tertiary-hover"
              />
            </div>
          ) : (
            <button
              ref={searchTriggerRef}
              type="button"
              aria-label="快速搜索"
              title={collapsed ? "快速搜索" : undefined}
              onClick={activateSearch}
              className={cx(
                "flex cursor-pointer items-center gap-2 p-2 hover:bg-background-tertiary-hover/55",
                "transition-[width,border-radius,background-color] duration-300 ease-in-out",
                collapsed
                  ? "w-9 rounded-full bg-background-tertiary-default"
                  : "w-full rounded-full bg-background-tertiary-default",
              )}
            >
              <span className={cx("flex min-w-0 items-center gap-2", !collapsed && "flex-1")}>
                <RiSearchLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                <Collapsible collapsed={collapsed}>
                  <span className="text-body-medium whitespace-nowrap text-text-secondary">
                    快速搜索
                  </span>
                </Collapsible>
              </span>
              <Collapsible collapsed={collapsed}>
                <Kbd>{sidebarQuickSearchShortcut(typeof navigator === "undefined" ? "" : navigator.platform)}</Kbd>
              </Collapsible>
            </button>
          ))}

          {/* Primary nav. The 2px inset is for the expanded rail only: the
              collapsed column is exactly as wide as a 36px item, so padding
              here pushes every item 2px right and the rail's own clip shaves
              that much off its selected fill and hover state. */}
          {searchActive ? normalizedQuery ? (
            <DashboardSidebarSearchResults entries={searchResults} activeIndex={activeSearchIndex} onSelect={chooseSearchResult} />
          ) : <p className="px-2 py-2 text-body-2-regular text-text-tertiary">搜索会话内容、联系人名称和设置</p> : (
            <>
              <nav className={cx("flex w-full flex-col gap-1.5", !collapsed && "px-0.5")}>
                <NavRows items={items} query={normalizedQuery} selected={selected} collapsed={collapsed} />
                {more && <SidebarMoreMenu {...more} collapsed={collapsed} />}
              </nav>
              {children?.(collapsed)}
            </>
          )}
        </div>
      </div>

      <DashboardSidebarFooter collapsed={collapsed} />
    </aside>
    </SidebarResizeFrame>
  ));
}
