import {
  RiBookOpenLine, RiCameraLine, RiChatHistoryLine, RiCodeLine,
  RiComputerLine, RiCpuLine, RiDatabase2Line, RiGitBranchLine, RiGitMergeLine,
  RiGlobalLine, RiInformationLine, RiKeyboardLine, RiMagicLine, RiMicLine,
  RiPaletteLine, RiPuzzle2Line, RiRobot2Line, RiSettings6Line, RiShieldCheckLine,
  RiShieldKeyholeLine, RiShieldUserLine, RiStackLine, RiTerminalBoxLine,
  RiTerminalWindowLine, RiToolsLine, RiUserLine, RiWebhookLine,
} from "@remixicon/react";
import type { ConfigurationGroup } from "@/app/configuration-types";

export type SettingsSection = ConfigurationGroup | "model" | "tools" | "skills" | "data" | "connections" | "hooks" | "shortcuts" | "about";

interface SettingsSectionEntry {
  label: string;
  title: string;
  description: string;
  icon: typeof RiUserLine;
}

export const settingsSections: Record<SettingsSection, SettingsSectionEntry> = {
  general: { label: "常规", title: "常规", description: "语言、对话方式、通知与更新。", icon: RiSettings6Line },
  profile: { label: "个人资料", title: "个人资料", description: "你的身份、NekoPapa 账号和本机使用记录。", icon: RiUserLine },
  appearance: { label: "外观", title: "外观偏好", description: "选择当前工作区的主题模式。", icon: RiPaletteLine },
  model: { label: "模型与 API", title: "模型与自定义 API", description: "管理本机模型连接配置。", icon: RiCpuLine },
  agent: { label: "Agent", title: "Agent 默认值", description: "保存新运行的模型、回复和权限偏好。", icon: RiRobot2Line },
  personalization: { label: "个性化", title: "个性化与记忆", description: "保存自定义指令与未来的记忆策略。", icon: RiMagicLine },
  voice: { label: "语音", title: "语音偏好", description: "保存语音输入与聊天的默认配置。", icon: RiMicLine },
  tools: { label: "MCP 与连接器", title: "MCP 与连接器", description: "管理 MCP 服务和连接器配置。", icon: RiToolsLine },
  data: { label: "数据与备份", title: "数据与备份", description: "查看本机存储，导出、校验和恢复设置。", icon: RiDatabase2Line },
  privacy: { label: "隐私", title: "隐私", description: "聊天记录保留与诊断数据。", icon: RiShieldUserLine },
  desktop: { label: "Live2D", title: "Live2D 陪伴窗口", description: "保存未来桌面角色的显示和窗口偏好。", icon: RiBookOpenLine },
  computer: { label: "电脑操作", title: "电脑操作", description: "保存未来电脑操作工具的默认范围。", icon: RiComputerLine },
  history: { label: "活动记录", title: "活动记录", description: "设置未来活动记录服务的采集与保留策略。", icon: RiChatHistoryLine },
  screenshots: { label: "应用快照", title: "应用快照", description: "保存未来快照服务的输出偏好。", icon: RiCameraLine },
  browser: { label: "浏览器", title: "浏览器", description: "保存未来浏览器服务的链接和批注偏好。", icon: RiGlobalLine },
  connections: { label: "设备与 SSH", title: "设备与 SSH", description: "管理远程设备连接信息。", icon: RiTerminalBoxLine },
  coding: { label: "Coding", title: "Coding 默认值", description: "保存 Pi 项目与代码编辑的默认配置。", icon: RiCodeLine },
  permissions: { label: "权限规则", title: "权限规则", description: "Coding 会话的权限模式、命令、文件与网络规则。", icon: RiShieldKeyholeLine },
  context: { label: "上下文与指令", title: "上下文与指令", description: "项目指令、文件范围和上下文压缩。", icon: RiStackLine },
  skills: { label: "技能", title: "技能", description: "管理 Agent 可以按需读取的本地技能目录。", icon: RiPuzzle2Line },
  editor: { label: "编辑器与终端", title: "编辑器与终端", description: "外部编辑器、差异视图和终端偏好。", icon: RiTerminalWindowLine },
  hooks: { label: "生命周期钩子", title: "生命周期钩子", description: "管理未来运行服务的事件与命令配置。", icon: RiWebhookLine },
  review: { label: "代码审查", title: "代码审查", description: "保存代码审查与安全审查的默认配置。", icon: RiShieldCheckLine },
  git: { label: "Git", title: "Git", description: "保存分支、提交和 Pull Request 偏好。", icon: RiGitBranchLine },
  worktrees: { label: "工作树", title: "工作树", description: "保存未来 Git 工作树管理的目录和清理偏好。", icon: RiGitMergeLine },
  shortcuts: { label: "快捷键", title: "快捷键", description: "当前聊天页面已经支持的键盘操作。", icon: RiKeyboardLine },
  about: { label: "关于", title: "关于 NekoPapa", description: "应用版本与项目支持。", icon: RiInformationLine },
};

export const settingsGroups: readonly { label: string; sections: readonly SettingsSection[] }[] = [
  { label: "工作区", sections: ["general", "profile", "appearance", "data", "privacy"] },
  { label: "智能与工具", sections: ["model", "agent", "personalization", "voice", "tools"] },
  { label: "桌面与设备", sections: ["desktop", "computer", "history", "screenshots", "browser", "connections"] },
  { label: "开发", sections: ["coding", "permissions", "context", "skills", "hooks", "editor", "review", "git", "worktrees"] },
  { label: "应用", sections: ["shortcuts", "about"] },
];

/** All settings sections remain discoverable; each page states its execution boundary. */
export const settingsNavigationSections = settingsGroups.flatMap((group) => group.sections);

/** Runtime-only preferences are retained as settings with explicit unavailable states until their services are connected. */
export const deferredSettingsSections: readonly SettingsSection[] = [
  "privacy", "agent", "personalization", "voice", "desktop", "computer", "history", "screenshots", "browser",
  "coding", "permissions", "context", "editor", "review", "git", "worktrees",
];
