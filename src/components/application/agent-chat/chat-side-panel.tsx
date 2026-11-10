import { useState, type ComponentType } from "react";
import { BookOpenIcon, FileTextIcon, FolderIcon, GitBranchIcon, MessagesSquareIcon, NotebookPenIcon, SquareTerminalIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOL_LABELS, type ChatTool } from "@/app/chat-tools";
import { resolveProject } from "@/app/projects";
import { useProjects } from "@/hooks/use-projects";
import { StatusDot } from "@/components/base/badges/status-dot";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { AgentChatHistory, type AgentChatHistoryProps } from "./agent-chat-history";
import { ChatEnvironment } from "./tools/chat-environment";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
type PanelTab = "history" | "code" | "study";
const CODE_TOOLS: { tool: ChatTool; icon: Icon; description: string }[] = [
  { tool: "changes", icon: FileTextIcon, description: "项目主要文件夹里未提交的 Git 更改与差异。" },
  { tool: "files", icon: FolderIcon, description: "浏览项目文件，只读预览文本内容。" },
  { tool: "terminal", icon: SquareTerminalIcon, description: "在项目文件夹中打开本机 shell（桌面应用）。" },
];
const TABS: { id: PanelTab; label: string }[] = [{ id: "history", label: "历史" }, { id: "code", label: "代码" }, { id: "study", label: "资料" }];

function Planned({ status, detail, items }: { status: string; detail: string; items: { icon: Icon; title: string; description: string }[] }) {
  return <div className="flex flex-col gap-3">
    <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-background-primary-default p-3">
      <StatusDot color="yellow" className="mt-1" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body-medium text-text-primary">{status}</p>
        <p className="text-body-2-regular text-text-secondary">{detail}</p>
      </div>
    </div>
    <ul className="flex flex-col">
      {items.map(({ icon: ItemIcon, title, description }) => <li key={title} className="flex items-start gap-2.5 px-1 py-2">
        <ItemIcon className="mt-0.5 size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="text-body-2-medium text-text-primary">{title}</span>
          <span className="text-caption-1-regular text-text-tertiary">{description}</span>
        </span>
      </li>)}
    </ul>
  </div>;
}

/**
 * The chat's side panel, after the code panel in BoardUI's AI Chat template:
 * 历史 lists saved chats; 代码 shows the chat's project and opens its real
 * 更改 / 文件 / 终端 tools, while the Coding agent itself is still pending;
 * 资料 waits for the NekoBuddy backend. Nothing here shows sample files or notes.
 */
export function ChatSidePanel({ project, onClose, onOpenTool, ...history }: Omit<AgentChatHistoryProps, "onClose" | "className"> & {
  project?: string;
  onClose: () => void;
  /** Opens a title-bar tool (更改 / 文件 / 终端) in place of this panel. */
  onOpenTool?: (tool: ChatTool) => void;
}) {
  const [tab, setTab] = useState<PanelTab>("history");
  const { projects } = useProjects();
  const resolvedProject = resolveProject(projects, project);
  return <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-3xl bg-background-secondary-default p-3">
    <div className="flex items-center justify-between gap-2">
      <PillTabList aria-label="工作面板" className="flex gap-0.5">
        {TABS.map(({ id, label }) => <PillTab key={id} variant="gray" isSelected={tab === id} onSelect={() => setTab(id)}>{label}</PillTab>)}
      </PillTabList>
      <button type="button" onClick={onClose} aria-label="关闭辅助工作区" title="关闭辅助工作区"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <XIcon className="size-5" aria-hidden />
      </button>
    </div>
    {tab === "history" && <AgentChatHistory {...history} className="min-h-0 w-full flex-1 rounded-none bg-transparent p-0" />}
    {tab === "code" && <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <ChatEnvironment project={resolvedProject} onOpenChanges={onOpenTool && (() => onOpenTool("changes"))} />
      {onOpenTool && <ul aria-label="项目工具" className="flex flex-col gap-1">
        {CODE_TOOLS.map(({ tool, icon: Icon, description }) => <li key={tool}>
          <button type="button" onClick={() => onOpenTool(tool)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-2xl bg-background-primary-default p-3 text-start outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            <Icon className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body-medium text-text-primary">{CHAT_TOOL_LABELS[tool]}</span>
              <span className="block text-caption-1-regular text-text-tertiary">{description}</span>
            </span>
          </button>
        </li>)}
      </ul>}
      <Planned status="Coding 智能体尚未接入" detail="接入后，Agent 模式在项目文件夹里读写代码，这里显示它做了什么。上面的工具只读取项目文件和 Git 状态；终端运行你自己输入的命令。" items={[
        { icon: GitBranchIcon, title: "Agent 的修改", description: "本次对话由 Agent 修改的文件，以及保留或撤销。" },
        { icon: SquareTerminalIcon, title: "Agent 的命令", description: "Agent 运行的命令与输出，例如测试和构建。" },
      ]} />
    </div>}
    {tab === "study" && <div className="min-h-0 flex-1 overflow-y-auto">
      <Planned status="NekoBuddy 后端未连接" detail="学习与知识库由 NekoBuddy 后端提供。接入后，这里跟随当前对话显示相关资料与学习进度；当前不会上传或读取资料。" items={[
        { icon: BookOpenIcon, title: "引用资料", description: "回答引用的知识库原文，并标明出处。" },
        { icon: NotebookPenIcon, title: "学习笔记", description: "从对话整理的要点、错题与复习计划。" },
        { icon: MessagesSquareIcon, title: "练习", description: "围绕当前主题出题、批改，并记录掌握情况。" },
      ]} />
    </div>}
  </div>;
}
