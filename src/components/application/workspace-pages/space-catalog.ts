import type { ComponentType } from "react";
import { FileIcon, FileTextIcon, FolderIcon, ImageIcon, LayoutGridIcon, MessageCircleIcon, StickyNoteIcon, Trash2Icon } from "@/components/foundations/icons/app-icons";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/**
 * 空间 groups everything NekoPapa keeps for you, in the spirit of a document
 * library. The categories and scopes below are the planned structure; no data
 * source is connected yet, so every list renders its empty state.
 */
export type SpaceCategory = "all" | "chats" | "projects" | "files" | "creations" | "images" | "notes" | "trash";
export type SpaceScope = "recent" | "starred" | "local" | "cloud";

export interface SpaceCategoryInfo { label: string; icon: Icon; contents: string }

export const spaceCategories: Record<SpaceCategory, SpaceCategoryInfo> = {
  all: { label: "全部", icon: LayoutGridIcon, contents: "对话、项目、文件和生成的内容" },
  chats: { label: "对话", icon: MessageCircleIcon, contents: "工作台与联系人的对话记录" },
  projects: { label: "项目", icon: FolderIcon, contents: "本地项目及其源文件夹" },
  files: { label: "文件", icon: FileIcon, contents: "发送给同伴的文件和文件夹" },
  creations: { label: "生成内容", icon: FileTextIcon, contents: "对话中生成的文档、表格、演示文稿和代码" },
  images: { label: "图像", icon: ImageIcon, contents: "对话里的图片与生成的图像" },
  notes: { label: "笔记", icon: StickyNoteIcon, contents: "学习笔记与收藏的回答" },
  trash: { label: "回收站", icon: Trash2Icon, contents: "删除的内容，可在这里恢复或彻底删除" },
};

/** Library categories in the rail; the trash sits apart at the bottom. */
export const spaceLibrary: readonly SpaceCategory[] = ["all", "chats", "projects", "files", "creations", "images", "notes"];

export const spaceScopes: readonly { id: SpaceScope; label: string }[] = [
  { id: "recent", label: "最近" },
  { id: "starred", label: "收藏" },
  { id: "local", label: "本机" },
  { id: "cloud", label: "云端" },
];

/** What an empty list says: what will appear there, and why nothing does yet. */
export function spaceEmptyState(category: SpaceCategory, scope: SpaceScope): { title: string; description: string } {
  const { label, contents } = spaceCategories[category];
  const title = category === "all" ? "空间里还没有内容" : `还没有${label}`;
  if (category === "trash") return { title: "回收站是空的", description: "接入后，删除的内容会先放到这里，可以恢复或彻底删除。" };
  if (scope === "cloud") return { title, description: "云端内容需要登录 NekoPapa 账号同步，账号服务暂未开放。" };
  if (scope === "starred") return { title, description: `接入后，你收藏的${contents}会显示在这里。` };
  return { title, description: `接入后，${contents}会显示在这里。` };
}
