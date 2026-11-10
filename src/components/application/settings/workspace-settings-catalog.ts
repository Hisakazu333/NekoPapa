import { BookOpenIcon, BotIcon, CameraIcon, ChartColumnIcon, CodeIcon, CpuIcon, DatabaseIcon, GitBranchIcon, GitMergeIcon, GlobeIcon, HistoryIcon, InfoIcon, KeyboardIcon, LayersIcon, MicIcon, MonitorIcon, PaletteIcon, PlugIcon, PuzzleIcon, Settings2Icon, ShieldCheckIcon, ShieldEllipsisIcon, ShieldUserIcon, SquareTerminalIcon, TerminalIcon, UserIcon, WandSparklesIcon, WebhookIcon, WrenchIcon } from "@/components/foundations/icons/app-icons";
import type { ConfigurationGroup } from "@/app/settings/configuration-types";

export type SettingsSection = ConfigurationGroup | "model" | "tools" | "skills" | "plugins" | "data" | "connections" | "hooks" | "shortcuts" | "about" | "usage" | "screen-island";

interface SettingsSectionEntry {
  label: string;
  title: string;
  description: string;
  icon: typeof UserIcon;
}

export const settingsSections: Record<SettingsSection, SettingsSectionEntry> = {
  general: { label: "常规", title: "常规", description: "语言、对话方式、通知与更新。", icon: Settings2Icon },
  profile: { label: "个人资料", title: "个人资料", description: "你的身份、NekoPapa 账号和本机活跃记录。", icon: UserIcon },
  usage: { label: "消耗统计", title: "消耗统计", description: "本机记录的 Token 用量、活跃日与流向。", icon: ChartColumnIcon },
  appearance: { label: "外观", title: "外观偏好", description: "选择当前工作区的主题模式。", icon: PaletteIcon },
  model: { label: "模型与 API", title: "模型与自定义 API", description: "管理本机模型连接配置。", icon: CpuIcon },
  agent: { label: "Agent", title: "Agent 默认值", description: "保存新运行的模型、回复和权限偏好。", icon: BotIcon },
  personalization: { label: "个性化", title: "个性化与记忆", description: "保存自定义指令与未来的记忆策略。", icon: WandSparklesIcon },
  voice: { label: "语音", title: "语音偏好", description: "保存语音输入与聊天的默认配置。", icon: MicIcon },
  tools: { label: "MCP 与连接器", title: "MCP 与连接器", description: "管理 MCP 服务和连接器配置。", icon: WrenchIcon },
  "screen-island": { label: "灵动岛", title: "灵动岛", description: "屏幕取材与截图编辑。", icon: CameraIcon },
  desktop: { label: "Live2D 桌宠", title: "Live2D 桌宠", description: "本机模型、账号模型与桌面陪伴。", icon: BookOpenIcon },
  data: { label: "数据与备份", title: "数据与备份", description: "查看本机存储，导出、校验和恢复设置。", icon: DatabaseIcon },
  privacy: { label: "隐私", title: "隐私", description: "聊天记录保留与诊断数据。", icon: ShieldUserIcon },
  computer: { label: "电脑操作", title: "电脑操作", description: "保存未来电脑操作工具的默认范围。", icon: MonitorIcon },
  history: { label: "活动记录", title: "活动记录", description: "设置未来活动记录服务的采集与保留策略。", icon: HistoryIcon },
  screenshots: { label: "应用快照", title: "应用快照", description: "保存未来快照服务的输出偏好。", icon: CameraIcon },
  browser: { label: "浏览器", title: "浏览器", description: "聊天链接的打开位置与内置浏览器的地址栏。", icon: GlobeIcon },
  connections: { label: "设备与 SSH", title: "设备与 SSH", description: "管理远程设备连接信息。", icon: SquareTerminalIcon },
  coding: { label: "Coding", title: "Coding 默认值", description: "保存 Coding 项目与代码编辑的默认配置。", icon: CodeIcon },
  permissions: { label: "权限规则", title: "权限规则", description: "Coding 会话的权限模式、命令、文件与网络规则。", icon: ShieldEllipsisIcon },
  context: { label: "上下文与指令", title: "上下文与指令", description: "项目指令、文件范围和上下文压缩。", icon: LayersIcon },
  skills: { label: "技能", title: "技能", description: "管理 Agent 可以按需读取的本地技能目录。", icon: PuzzleIcon },
  plugins: { label: "Cordis 插件", title: "Cordis 插件", description: "DeepSeek Harness 插件模块与 Cordis 配置条目；执行层接入前不会加载。", icon: PlugIcon },
  editor: { label: "编辑器与终端", title: "编辑器与终端", description: "外部编辑器、差异视图和内置终端。", icon: TerminalIcon },
  hooks: { label: "生命周期钩子", title: "生命周期钩子", description: "管理未来运行服务的事件与命令配置。", icon: WebhookIcon },
  review: { label: "代码审查", title: "代码审查", description: "保存代码审查与安全审查的默认配置。", icon: ShieldCheckIcon },
  git: { label: "Git", title: "Git", description: "保存分支、提交和 Pull Request 偏好。", icon: GitBranchIcon },
  worktrees: { label: "工作树", title: "工作树", description: "保存未来 Git 工作树管理的目录和清理偏好。", icon: GitMergeIcon },
  shortcuts: { label: "快捷键", title: "快捷键", description: "工作台当前支持的键盘操作。", icon: KeyboardIcon },
  about: { label: "关于", title: "关于 NekoPapa", description: "应用版本与项目支持。", icon: InfoIcon },
};

export const settingsGroups: readonly { label: string; sections: readonly SettingsSection[] }[] = [
  { label: "工作区", sections: ["general", "profile", "usage", "appearance", "data", "privacy"] },
  { label: "智能与工具", sections: ["model", "agent", "personalization", "voice", "tools", "screen-island", "desktop"] },
  { label: "桌面与设备", sections: ["computer", "history", "screenshots", "browser", "connections"] },
  { label: "开发", sections: ["coding", "permissions", "context", "skills", "plugins", "hooks", "editor", "review", "git", "worktrees"] },
  { label: "应用", sections: ["shortcuts", "about"] },
];

/** All settings sections remain discoverable; each page states its execution boundary. */
export const settingsNavigationSections = settingsGroups.flatMap((group) => group.sections);

/** Runtime-only preferences are retained as settings with explicit unavailable states until their services are connected. */
export const deferredSettingsSections: readonly SettingsSection[] = [
  "privacy", "agent", "personalization", "voice", "computer", "history", "screenshots", "browser",
  "coding", "permissions", "context", "editor", "review", "git", "worktrees",
];
