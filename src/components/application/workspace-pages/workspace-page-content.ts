import type { ComponentType } from "react";
import { BookIcon, BookOpenIcon, CloudUploadIcon, GraduationCapIcon, HouseIcon, MapIcon, MessageCircleIcon, MessagesSquareIcon, NotebookPenIcon, PaletteIcon, SearchIcon } from "@/components/foundations/icons/app-icons";
import type { PendingWorkspacePage } from "@/components/application/dashboard/workspace-page";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
export interface PlannedCapability { icon: Icon; title: string; description: string }
export interface WorkspacePageContent { title: string; icon: Icon; intro: string; statusTitle: string; status: string; planned: readonly PlannedCapability[] }

/**
 * Copy for sidebar pages that cannot work yet. Capabilities are listed as
 * plans; none of them works until its backend or assets are in place.
 */
export const workspacePageContent: Record<PendingWorkspacePage, WorkspacePageContent> = {
  learning: {
    title: "学习", icon: GraduationCapIcon,
    intro: "围绕你的资料制定学习计划、讲解知识点并安排练习。",
    statusTitle: "NekoBuddy 后端未连接",
    status: "学习资料、计划和进度由 NekoBuddy 后端保存。当前客户端没有连接后端，不会创建学习计划或题目。",
    planned: [
      { icon: MapIcon, title: "引导学习", description: "按主题拆分学习路径，一步步讲解并检查理解。" },
      { icon: MessagesSquareIcon, title: "练习与测验", description: "根据资料出题、批改，并记录掌握情况。" },
      { icon: NotebookPenIcon, title: "学习笔记", description: "整理要点、错题和复习计划。" },
    ],
  },
  knowledge: {
    title: "知识库", icon: BookIcon,
    intro: "集中保存课本、讲义、笔记和文档，供聊天与学习检索引用。",
    statusTitle: "NekoBuddy 后端未连接",
    status: "资料上传、解析和检索由 NekoBuddy 后端负责。当前客户端没有连接后端，不会上传或读取任何文件。",
    planned: [
      { icon: CloudUploadIcon, title: "上传资料", description: "导入 PDF、Markdown、网页等资料并自动解析。" },
      { icon: SearchIcon, title: "检索与引用", description: "回答时引用资料原文，并标明出处。" },
      { icon: BookOpenIcon, title: "分组管理", description: "按课程或主题整理资料，并可关联到侧栏中的项目。" },
    ],
  },
  cabin: {
    title: "小屋", icon: HouseIcon,
    intro: "同伴的房间，计划支持布置与互动。",
    statusTitle: "小屋场景尚未开放",
    status: "房间场景、模型与布置尚未接入。",
    planned: [
      { icon: HouseIcon, title: "人物房间", description: "选择同伴，在房间里查看角色与待机动作。" },
      { icon: MessageCircleIcon, title: "互动与聊天", description: "点击、触摸会有反应，可以从小屋直接进入和 TA 的单聊。" },
      { icon: PaletteIcon, title: "房间布置", description: "更换房间背景与摆设，按同伴分别保存。" },
    ],
  },
};
