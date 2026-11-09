import type { ReactNode, Ref } from "react";
import { AgentChatActions, type AgentChatActionsProps } from "./agent-chat-actions";
import { ChatWorkspaceHeader } from "./chat-workspace-header";

export function createChatWindowChrome({
  title,
  titleRef,
  navOpen,
  onToggleNavigation,
  hasMessages,
  windowToolbar,
  nativeWindow,
  actions,
}: {
  title: string;
  titleRef: Ref<HTMLElement>;
  navOpen: boolean;
  onToggleNavigation: () => void;
  hasMessages: boolean;
  windowToolbar: boolean;
  nativeWindow: boolean;
  actions: Omit<AgentChatActionsProps, "className">;
}): { workspaceHeader: ReactNode; windowActions?: ReactNode } {
  const workspaceHeader = (
    <ChatWorkspaceHeader
      title={title}
      titleRef={titleRef}
      navOpen={navOpen}
      onToggleNavigation={onToggleNavigation}
      frosted={hasMessages}
      {...actions}
      showActions={!windowToolbar}
    />
  );
  const windowActions = windowToolbar ? (
    <>
      <div data-tauri-drag-region={nativeWindow ? "" : undefined} className="h-full min-w-4 flex-1" />
      <AgentChatActions {...actions} />
    </>
  ) : undefined;

  return { workspaceHeader, windowActions };
}
