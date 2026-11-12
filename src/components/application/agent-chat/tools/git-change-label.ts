import type { ChangeKind } from "@/app/projects/project-workspace";
import type { ChipColor } from "@/components/base/badges/chip";

/** The letter, name and chip color of each Git change kind, shared by 更改 and the 文件 tree. */
export const CHANGE_LABEL: Record<ChangeKind, [letter: string, name: string, color: ChipColor]> = {
  modified: ["M", "已修改", "blue"], added: ["A", "新增", "lime"], deleted: ["D", "已删除", "rose"], renamed: ["R", "重命名", "purple"],
  untracked: ["U", "未跟踪", "lime"], conflicted: ["!", "冲突", "orange"], typechange: ["T", "类型变化", "yellow"],
};

/** The file name's text color in the tree, as editors tint changed files. */
export const CHANGE_TEXT: Record<ChangeKind, string> = {
  modified: "text-status-blue-text", added: "text-status-lime-text", deleted: "text-status-rose-text", renamed: "text-status-purple-text",
  untracked: "text-status-lime-text", conflicted: "text-status-orange-text", typechange: "text-status-yellow-text",
};
