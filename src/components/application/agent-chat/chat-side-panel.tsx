import type { ComponentType, RefObject } from "react";
import type { UIMessage } from "ai";
import { BookOpenIcon, MessagesSquareIcon, NotebookPenIcon, XIcon } from "@/components/foundations/icons/app-icons";
import { CHAT_TOOLS } from "@/app/chat-tools";
import type { Project } from "@/app/projects";
import type { ThreadUsage } from "@/app/thread-usage";
import { StatusDot } from "@/components/base/badges/status-dot";
import { PillTab, PillTabList } from "@/components/base/tabs/pill-tab";
import { AgentChatHistory, type AgentChatHistoryProps } from "./agent-chat-history";
import { ChatWorkEnvironment } from "./tools/chat-work-environment";
import { ChatToolPanel } from "./tools/chat-tool-panel";
import type { WorkPanelView } from "./use-browser-placement";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
const TABS = [
  { id: "history", label: "历史" },
  { id: "code", label: "代码" },
  { id: "study", label: "资料" },
  { id: "outline", label: "工具" },
] as const;

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
 * The right-hand work panel keeps the same navigation and close control
 * while switching between history, environment, study and project tools.
 */
export function ChatSidePanel({ project, onClose, view, onSelectView, usage, messages, messageAt, scrollRef, ...history }: Omit<AgentChatHistoryProps, "onClose" | "className"> & {
  project?: Project;
  /** The open chat's reported usage, for the 上下文 card. */
  usage: ThreadUsage;
  onClose: () => void;
  view: WorkPanelView;
  onSelectView: (view: WorkPanelView) => void;
  messages: UIMessage[];
  messageAt: Record<string, number>;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const tool = CHAT_TOOLS.find((candidate) => candidate === view);
  return <div className="flex h-full w-full flex-col gap-3 overflow-hidden rounded-3xl bg-background-secondary-default p-3">
    <div className="flex items-center justify-between gap-2">
      <PillTabList aria-label="工作面板" className="flex gap-0.5">
        {TABS.map(({ id, label }) => <PillTab key={id} variant="gray"
          isSelected={id === "outline" ? tool !== undefined : view === id}
          onSelect={() => onSelectView(id === "outline" ? tool ?? id : id)}>{label}</PillTab>)}
      </PillTabList>
      <button type="button" onClick={onClose} aria-label="关闭辅助工作区" title="关闭辅助工作区"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <XIcon className="size-5" aria-hidden />
      </button>
    </div>
    {view === "history" && <AgentChatHistory {...history} className="min-h-0 w-full flex-1 rounded-none bg-transparent p-0" />}
    {view === "code" && <ChatWorkEnvironment project={project} usage={usage} onOpenChanges={() => onSelectView("changes")} />}
    {tool && <ChatToolPanel tool={tool} project={project} messages={messages} messageAt={messageAt} scrollRef={scrollRef} onSwitch={onSelectView} />}
    {view === "study" && <div className="min-h-0 flex-1 overflow-y-auto">
      <Planned status="NekoBuddy 后端未连接" detail="学习与知识库由 NekoBuddy 后端提供。接入后，这里跟随当前对话显示相关资料与学习进度；当前不会上传或读取资料。" items={[
        { icon: BookOpenIcon, title: "引用资料", description: "回答引用的知识库原文，并标明出处。" },
        { icon: NotebookPenIcon, title: "学习笔记", description: "从对话整理的要点、错题与复习计划。" },
        { icon: MessagesSquareIcon, title: "练习", description: "围绕当前主题出题、批改，并记录掌握情况。" },
      ]} />
    </div>}
  </div>;
}
