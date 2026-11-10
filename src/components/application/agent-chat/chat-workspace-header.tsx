import type { Ref } from "react";
import { ChevronRightIcon, FolderIcon, MenuIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { IconButton } from "@/components/base/buttons/icon-button";
import { cx } from "@/utils/cx";
import { AgentChatActions, type AgentChatActionsProps } from "./agent-chat-actions";

export interface ChatWorkspaceHeaderProps extends AgentChatActionsProps {
  title: string;
  titleRef: Ref<HTMLElement>;
  navOpen: boolean;
  onToggleNavigation?: () => void;
  frosted: boolean;
  workspaceLabel?: string;
  showActions?: boolean;
  /**
   * The desktop title bar already shows the open chat as a tab, so the
   * breadcrumb would only repeat it; only the narrow-window navigation
   * toggle stays.
   */
  compact?: boolean;
}

export function ChatWorkspaceHeader({
  title, titleRef, navOpen, onToggleNavigation, frosted, workspaceLabel = "工作台", showActions = true, compact = false, ...actions
}: ChatWorkspaceHeaderProps) {
  if (compact) return onToggleNavigation ? (
    <IconButton
      icon={navOpen ? XIcon : MenuIcon}
      size="small"
      aria-label={navOpen ? "关闭导航" : "打开导航"}
      onClick={onToggleNavigation}
      className="absolute start-3 top-3 z-10 lg:hidden"
    />
  ) : null;
  return (
    <header
      className={cx(
        "absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 border-b px-5 transition-colors",
        frosted
          ? "border-separator-border bg-white/70 backdrop-blur-[20px] dark:bg-black/40"
          : "border-transparent",
      )}
    >
      {onToggleNavigation && <IconButton
        icon={navOpen ? XIcon : MenuIcon}
        size="small"
        aria-label={navOpen ? "关闭导航" : "打开导航"}
        onClick={onToggleNavigation}
        className="lg:hidden"
      />}
      <nav ref={titleRef} aria-label="当前位置" className="min-w-0 shrink">
        <ol className="flex min-w-0 items-center gap-2 text-body-medium sm:gap-3">
          <li className="flex shrink-0 items-center gap-2 text-text-tertiary">
            <FolderIcon className="size-[18px] shrink-0" aria-hidden />
            <span className="max-w-28 truncate" title={workspaceLabel}>{workspaceLabel}</span>
          </li>
          <li className="shrink-0 text-text-tertiary" aria-hidden>
            <ChevronRightIcon className="size-[18px]" />
          </li>
          <li aria-current="page" title={title} className="min-w-0 truncate text-text-secondary">
            {title}
          </li>
        </ol>
      </nav>
      {showActions && <AgentChatActions {...actions} className="ms-auto" />}
    </header>
  );
}
