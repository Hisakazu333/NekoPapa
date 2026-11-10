import type { RefObject } from "react";
import type { UIMessage } from "ai";
import type { Project } from "@/app/projects/projects";
import type { ThreadUsage } from "@/app/usage/thread-usage";
import type { AgentChatHistoryProps } from "./agent-chat-history";
import { ChatBrowserPanel } from "./chat-browser-panel";
import { ChatSidePanel } from "./chat-side-panel";
import type { ChatBrowser } from "./use-chat-browser";
import type { useBrowserDrag } from "./use-browser-drag";
import type { useBrowserPlacement } from "./use-browser-placement";

/** The browser and work panel share the auxiliary area. */
export function ChatAuxiliaryPanel({
  project, messages, messageAt, scrollRef, placement, browser, browserDrag, browserLabel, history, usage,
}: {
  project?: Project;
  messages: UIMessage[];
  messageAt: Record<string, number>;
  scrollRef: RefObject<HTMLDivElement | null>;
  placement: ReturnType<typeof useBrowserPlacement>;
  browser: ChatBrowser;
  browserDrag: ReturnType<typeof useBrowserDrag>;
  browserLabel: string;
  history: Omit<AgentChatHistoryProps, "onClose" | "className">;
  usage: ThreadUsage;
}) {
  if (placement.auxiliary === "browser") return <ChatBrowserPanel browser={browser} placement="side" onClose={placement.closeAuxiliary} onMove={placement.moveToTab}
    suspended={browserDrag.drag !== null}
    onMovePointerDown={(event) => browserDrag.begin(event, "side", browserLabel, placement.moveToTab)} />;
  return <ChatSidePanel {...history} project={project} onClose={placement.closeAuxiliary}
    view={placement.panelView} onSelectView={placement.openWorkPanel}
    usage={usage} messages={messages} messageAt={messageAt} scrollRef={scrollRef} />;
}
