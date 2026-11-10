import { useState, type ComponentType } from "react";
import {
  RiBookOpenLine, RiCloseLine, RiDraftLine, RiFileList3Line, RiFolder3Line, RiGitBranchLine, RiQuestionAnswerLine, RiTerminalBoxLine,
} from "@remixicon/react";
import { resolveProject } from "@/app/projects";
import { useProjects } from "@/hooks/use-projects";
import { StatusDot } from "@/components/base/badges/status-dot";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { AgentChatHistory, type AgentChatHistoryProps } from "./agent-chat-history";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
type PanelTab = "history" | "code" | "study";
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

/** The open chat's project, the one real fact the coding view can already show. */
function ProjectSummary({ project }: { project?: string }) {
  const { projects } = useProjects();
  const resolved = resolveProject(projects, project);
  if (!resolved) return <p className="px-1 text-body-2-regular text-text-tertiary">这段对话没有归入项目。在首页或侧栏选择项目后，代码视图会围绕该项目的文件夹工作。</p>;
  return <div className="flex flex-col gap-1 rounded-2xl bg-background-primary-default p-3">
    <p className="flex items-center gap-2 text-body-medium text-text-primary"><RiFolder3Line className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden /><span translate="no" className="truncate">{resolved.name}</span></p>
    {resolved.folders.map((folder, index) => <p key={folder} translate="no" title={folder} className="truncate ps-6 text-caption-1-regular text-text-tertiary">{index === 0 ? "主要 · " : ""}{folder}</p>)}
  </div>;
}

/**
 * The chat's side panel, after the code panel in BoardUI's AI Chat template:
 * 历史 lists saved chats; 代码 and 资料 are where coding and study work will
 * show once those services exist. Until then they say so plainly and show
 * only real facts (the chat's project), never sample files or notes.
 */
export function ChatSidePanel({ project, onClose, ...history }: Omit<AgentChatHistoryProps, "onClose" | "className"> & { project?: string; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>("history");
  return <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-3xl bg-background-secondary-default p-3">
    <div className="flex items-center justify-between gap-2">
      <PillTabList aria-label="工作面板" className="flex gap-0.5">
        {TABS.map(({ id, label }) => <PillTab key={id} variant="gray" isSelected={tab === id} onSelect={() => setTab(id)}>{label}</PillTab>)}
      </PillTabList>
      <button type="button" onClick={onClose} aria-label="关闭辅助工作区" title="关闭辅助工作区"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <RiCloseLine className="size-5" aria-hidden />
      </button>
    </div>
    {tab === "history" && <AgentChatHistory {...history} className="min-h-0 w-full flex-1 rounded-none bg-transparent p-0" />}
    {tab === "code" && <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <ProjectSummary project={project} />
      <Planned status="Coding 智能体尚未接入" detail="接入后，Agent 模式在项目文件夹里读写代码，这里显示它做了什么。当前不会读取或修改任何文件。" items={[
        { icon: RiGitBranchLine, title: "变化", description: "本次对话修改的文件、差异，以及保留或撤销。" },
        { icon: RiFileList3Line, title: "文件", description: "浏览项目文件，打开 Agent 引用的位置。" },
        { icon: RiTerminalBoxLine, title: "终端", description: "Agent 运行的命令与输出，例如测试和构建。" },
      ]} />
    </div>}
    {tab === "study" && <div className="min-h-0 flex-1 overflow-y-auto">
      <Planned status="NekoBuddy 后端未连接" detail="学习与知识库由 NekoBuddy 后端提供。接入后，这里跟随当前对话显示相关资料与学习进度；当前不会上传或读取资料。" items={[
        { icon: RiBookOpenLine, title: "引用资料", description: "回答引用的知识库原文，并标明出处。" },
        { icon: RiDraftLine, title: "学习笔记", description: "从对话整理的要点、错题与复习计划。" },
        { icon: RiQuestionAnswerLine, title: "练习", description: "围绕当前主题出题、批改，并记录掌握情况。" },
      ]} />
    </div>}
  </div>;
}
