import { useCallback, useState, type ReactNode, type RefObject } from "react";
import { RiFileList3Line, RiFolder3Line, RiGitBranchLine, RiListUnordered, RiTerminalBoxLine } from "@remixicon/react";
import type { UIMessage } from "ai";
import { CHAT_TOOL_LABELS, type ChatTool } from "@/app/chat-tools";
import type { Project } from "@/app/projects";
import { ChatOutlineView } from "./chat-outline-view";
import { ProjectChangesView } from "./project-changes-view";
import { ProjectFilesView } from "./project-files-view";
import { TerminalView } from "./terminal-view";
import { NoProjectMessage, ToolPanelFrame } from "./tool-panel-frame";

const icons = { outline: RiListUnordered, terminal: RiTerminalBoxLine, changes: RiFileList3Line, files: RiFolder3Line } as const;

/**
 * The panel a title-bar tool opens beside the chat. 终端 / 更改 / 文件 work in
 * the chat's project, in its primary folder; 目录 lists the open chat.
 */
export function ChatToolPanel({ tool, project, messages, messageAt, scrollRef, onClose }: {
  tool: ChatTool;
  project?: Project;
  messages: UIMessage[];
  messageAt: Record<string, number>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  // Views publish their own header actions (刷新, 清屏, …) and the branch.
  const [actions, setActions] = useState<{ tool: ChatTool; node: ReactNode }>();
  const [branch, setBranch] = useState<string>();
  const root = project?.folders[0];
  const onActions = useCallback((node: ReactNode) => setActions({ tool, node }), [tool]);

  const detail = tool === "outline" ? undefined : tool === "terminal" && !project ? "主目录" : project && <span translate="no" title={root}>
    {project.name}
    {tool === "changes" && branch && <span className="ms-1.5 inline-flex items-center gap-0.5 align-bottom"><RiGitBranchLine className="size-3.5" aria-hidden />{branch}</span>}
  </span>;

  let body: ReactNode;
  if (tool === "outline") body = <ChatOutlineView messages={messages} messageAt={messageAt} scrollRef={scrollRef} />;
  else if (tool === "terminal") body = <TerminalView key={root ?? "~"} cwd={root} onActions={onActions} />;
  else if (!root) body = <NoProjectMessage what={tool === "files" ? "文件" : "Git 更改"} />;
  else if (tool === "changes") body = <ProjectChangesView key={root} root={root} onActions={onActions} onBranch={setBranch} />;
  else body = <ProjectFilesView key={root} root={root} onActions={onActions} />;

  return <ToolPanelFrame icon={icons[tool]} title={CHAT_TOOL_LABELS[tool]} detail={detail}
    actions={actions?.tool === tool && (tool === "terminal" || root) ? actions.node : undefined} onClose={onClose}>
    {body}
  </ToolPanelFrame>;
}
