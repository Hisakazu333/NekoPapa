import type { ComponentType } from "react";
import {
  RiBook2Line, RiBookOpenLine, RiDraftLine, RiFileList2Line, RiFolder3Line, RiGitRepositoryLine,
  RiGraduationCapLine, RiQuestionAnswerLine, RiRoadMapLine, RiSearchLine, RiTaskLine, RiUploadCloud2Line,
} from "@remixicon/react";
import type { BackendWorkspacePage } from "@/components/application/dashboard/workspace-page";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
export interface PlannedCapability { icon: Icon; title: string; description: string }
export interface WorkspacePageContent { title: string; icon: Icon; intro: string; status: string; planned: readonly PlannedCapability[] }

/**
 * Copy for sidebar pages backed by the NekoBuddy backend. Capabilities are
 * listed as plans; none of them works until the backend is connected.
 */
export const workspacePageContent: Record<BackendWorkspacePage, WorkspacePageContent> = {
  learning: {
    title: "学习", icon: RiGraduationCapLine,
    intro: "围绕你的资料制定学习计划、讲解知识点并安排练习。",
    status: "学习资料、计划和进度由 NekoBuddy 后端保存。当前客户端没有连接后端，不会创建学习计划或题目。",
    planned: [
      { icon: RiRoadMapLine, title: "引导学习", description: "按主题拆分学习路径，一步步讲解并检查理解。" },
      { icon: RiQuestionAnswerLine, title: "练习与测验", description: "根据资料出题、批改，并记录掌握情况。" },
      { icon: RiDraftLine, title: "学习笔记", description: "整理要点、错题和复习计划。" },
    ],
  },
  knowledge: {
    title: "知识库", icon: RiBook2Line,
    intro: "集中保存课本、讲义、笔记和文档，供聊天与学习检索引用。",
    status: "资料上传、解析和检索由 NekoBuddy 后端负责。当前客户端没有连接后端，不会上传或读取任何文件。",
    planned: [
      { icon: RiUploadCloud2Line, title: "上传资料", description: "导入 PDF、Markdown、网页等资料并自动解析。" },
      { icon: RiSearchLine, title: "检索与引用", description: "回答时引用资料原文，并标明出处。" },
      { icon: RiBookOpenLine, title: "分组管理", description: "按课程、项目或主题整理资料。" },
    ],
  },
  projects: {
    title: "项目", icon: RiFolder3Line,
    intro: "把相关的对话、资料和任务归到同一个项目里。",
    status: "项目及其成员、资料和进度由 NekoBuddy 后端保存。当前客户端没有连接后端，不会创建项目。",
    planned: [
      { icon: RiFileList2Line, title: "项目概览", description: "汇总项目说明、最近对话和关联资料。" },
      { icon: RiTaskLine, title: "任务与进度", description: "拆分目标并跟踪完成情况。" },
      { icon: RiGitRepositoryLine, title: "代码项目", description: "关联本地工作目录，供未来的 Coding 会话使用。" },
    ],
  },
};
