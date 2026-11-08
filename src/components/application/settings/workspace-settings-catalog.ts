import {
  RiBookOpenLine, RiCameraLine, RiChatHistoryLine, RiCodeLine,
  RiComputerLine, RiCpuLine, RiDatabase2Line, RiGitBranchLine, RiGitMergeLine,
  RiGlobalLine, RiInformationLine, RiKeyboardLine, RiMagicLine, RiMicLine,
  RiPaletteLine, RiRobot2Line, RiSettings6Line, RiShieldCheckLine,
  RiTerminalBoxLine, RiToolsLine, RiUserLine, RiWebhookLine,
} from "@remixicon/react";
import type { ConfigurationGroup } from "@/app/configuration-types";

export type SettingsSection = ConfigurationGroup | "general" | "model" | "tools" | "data" | "connections" | "hooks" | "shortcuts" | "about";

interface SettingsSectionEntry {
  label: string;
  title: string;
  description: string;
  icon: typeof RiUserLine;
}

export const settingsSections: Record<SettingsSection, SettingsSectionEntry> = {
  general: { label: "常规", title: "常规", description: "查看本机工作区，并管理常用设置。", icon: RiSettings6Line },
  profile: { label: "个人资料", title: "个人资料", description: "名称和介绍保存在本机，与在线账号独立。", icon: RiUserLine },
  appearance: { label: "外观", title: "外观偏好", description: "选择当前工作区的主题模式。", icon: RiPaletteLine },
  model: { label: "模型与 API", title: "模型与自定义 API", description: "管理本机模型连接配置。", icon: RiCpuLine },
  agent: { label: "Agent", title: "Agent 默认值", description: "保存新运行的模型、回复和权限偏好。", icon: RiRobot2Line },
  personalization: { label: "个性化", title: "个性化与记忆", description: "保存自定义指令与未来的记忆策略。", icon: RiMagicLine },
  voice: { label: "语音", title: "语音偏好", description: "保存语音输入与聊天的默认配置。", icon: RiMicLine },
  tools: { label: "工具与技能", title: "工具与技能", description: "管理 MCP、技能目录和连接器配置。", icon: RiToolsLine },
  data: { label: "数据与备份", title: "数据与备份", description: "导出、校验和恢复 NekoPapa 本机设置。", icon: RiDatabase2Line },
  desktop: { label: "Live2D", title: "Live2D 陪伴窗口", description: "保存未来桌面角色的显示和窗口偏好。", icon: RiBookOpenLine },
  computer: { label: "电脑操作", title: "电脑操作", description: "保存未来电脑操作工具的默认范围。", icon: RiComputerLine },
  history: { label: "活动记录", title: "活动记录", description: "设置未来活动记录服务的采集与保留策略。", icon: RiChatHistoryLine },
  screenshots: { label: "应用快照", title: "应用快照", description: "保存未来快照服务的输出偏好。", icon: RiCameraLine },
  browser: { label: "浏览器", title: "浏览器", description: "保存未来浏览器服务的链接和批注偏好。", icon: RiGlobalLine },
  connections: { label: "设备与 SSH", title: "设备与 SSH", description: "管理远程设备连接信息。", icon: RiTerminalBoxLine },
  coding: { label: "Coding", title: "Coding 默认值", description: "保存 Pi 项目与代码编辑的默认配置。", icon: RiCodeLine },
  hooks: { label: "生命周期钩子", title: "生命周期钩子", description: "管理未来运行服务的事件与命令配置。", icon: RiWebhookLine },
  review: { label: "代码审查", title: "代码审查", description: "保存代码审查与安全审查的默认配置。", icon: RiShieldCheckLine },
  git: { label: "Git", title: "Git", description: "保存分支、提交和 Pull Request 偏好。", icon: RiGitBranchLine },
  worktrees: { label: "工作树", title: "工作树", description: "保存未来 Git 工作树管理的目录和清理偏好。", icon: RiGitMergeLine },
  shortcuts: { label: "快捷键", title: "快捷键", description: "当前聊天页面已经支持的键盘操作。", icon: RiKeyboardLine },
  about: { label: "关于", title: "关于 NekoPapa", description: "应用版本与项目支持。", icon: RiInformationLine },
};

export const settingsGroups: readonly { label: string; sections: readonly SettingsSection[] }[] = [
  { label: "工作区", sections: ["general", "profile", "appearance", "data"] },
  { label: "智能与工具", sections: ["model", "agent", "personalization", "voice", "tools"] },
  { label: "桌面与设备", sections: ["desktop", "computer", "history", "screenshots", "browser", "connections"] },
  { label: "开发", sections: ["coding", "hooks", "review", "git", "worktrees"] },
  { label: "应用", sections: ["shortcuts", "about"] },
];
