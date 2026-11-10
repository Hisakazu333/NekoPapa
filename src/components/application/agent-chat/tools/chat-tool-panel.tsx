import { useCallback, useState, type ReactNode, type RefObject } from "react";
import { GitBranchIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOL_ICONS as icons } from "./chat-tool-icons";
import type { UIMessage } from "ai";
import { CHAT_TOOL_LABELS, CHAT_TOOLS, type ChatTool } from "@/app/chat/chat-tools";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import type { Project } from "@/app/projects/projects";
import { ChatOutlineView } from "./chat-outline-view";
import { ProjectChangesView } from "./project-changes-view";
import { ProjectFilesView } from "./project-files-view";
import { TerminalView } from "./terminal-view";
import { NoProjectMessage, ToolPanelFrame } from "./tool-panel-frame";


/**
 * The work panel's tools. 终端 / 更改 / 文件 work in
 * the chat's project, in its primary folder; 目录 lists the open chat.
 */
export function ChatToolPanel({ tool, project, messages, messageAt, scrollRef, onSwitch }: {
  tool: ChatTool;
  project?: Project;
  messages: UIMessage[];
  messageAt: Record<string, number>;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Switches the area to another panel; each keeps its own state (the terminal keeps running). */
  onSwitch: (tool: ChatTool) => void;
}) {
  // Views publish their own header actions (刷新, 清屏, …) and the branch.
  const [actions, setActions] = useState<{ tool: ChatTool; node: ReactNode }>();
  const [branch, setBranch] = useState<string>();
  const root = project?.folders[0];
  const onActions = useCallback((node: ReactNode) => setActions({ tool, node }), [tool]);

  const detail = tool === "outline" ? undefined : tool === "terminal" && !project ? "主目录" : project && <span translate="no" title={root}>
    {project.name}
    {tool === "changes" && branch && <span className="ms-1.5 inline-flex items-center gap-0.5 align-bottom"><GitBranchIcon className="size-3.5" aria-hidden />{branch}</span>}
  </span>;

  let body: ReactNode;
  if (tool === "outline") body = <ChatOutlineView messages={messages} messageAt={messageAt} scrollRef={scrollRef} />;
  else if (tool === "terminal") body = <TerminalView key={root ?? "~"} cwd={root} onActions={onActions} />;
  else if (!root) body = <NoProjectMessage what={tool === "files" ? "文件" : "Git 更改"} />;
  else if (tool === "changes") body = <ProjectChangesView key={root} root={root} onActions={onActions} onBranch={setBranch} />;
  else body = <ProjectFilesView key={project!.id} folders={project!.folders} onActions={onActions} />;

  const tabs = <SegmentedControl aria-label="切换工具" selectedKeys={[tool]} className="shrink-0"
    onSelectionChange={(keys) => { const next = Array.from(keys)[0] as ChatTool | undefined; if (next && next !== tool) onSwitch(next); }}>
    {CHAT_TOOLS.map((id) => {
      const TabIcon = icons[id];
      return <SegmentedControlItem key={id} id={id} aria-label={CHAT_TOOL_LABELS[id]} className="gap-1 px-2 py-0.5 text-caption-1-medium">
        <TabIcon className="size-3.5 shrink-0" aria-hidden /><span className="hidden @[440px]:inline">{CHAT_TOOL_LABELS[id]}</span>
      </SegmentedControlItem>;
    })}
  </SegmentedControl>;

  return <ToolPanelFrame title={CHAT_TOOL_LABELS[tool]} tabs={tabs} detail={detail}
    actions={actions?.tool === tool && (tool === "terminal" || root) ? actions.node : undefined}>
    {body}
  </ToolPanelFrame>;
}
