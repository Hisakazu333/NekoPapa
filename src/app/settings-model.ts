import type { IconName } from "./icons";

import type { ConfigurationGroup, ConfigurationCollection } from "./configuration-types";
export type SettingsSection = ConfigurationGroup | ConfigurationCollection | "general" | "import" | "characters" | "shortcuts" | "usage" | "account" | "data" | "archive" | "trash" | "about";
export interface SettingsEntry {
  id: SettingsSection;
  title: string;
  group: string;
  icon: IconName;
  description: string;
  keywords: string;
}

export const settingsCatalog: readonly SettingsEntry[] = [
  { id: "general", title: "常规", group: "个人", icon: "settings", description: "让导航适合你的使用习惯。", keywords: "侧栏 宽度 显示数量 人物筛选 固定功能 快捷入口 导航顺序 布局" },
  { id: "import", title: "导入", group: "个人", icon: "arrow", description: "预览并导入 NekoPapa 设置备份。", keywords: "备份 JSON 迁移 恢复 模型 工具 配置" },
  { id: "profile", title: "个人资料", group: "个人", icon: "user", description: "管理保存在本机的个人介绍。", keywords: "名称 账号 简介 网站" },
  { id: "appearance", title: "外观", group: "个人", icon: "layout", description: "选择模式、强调色、字体和动态效果。", keywords: "主题 系统 深色 浅色 密度" },
  { id: "voice", title: "语音", group: "个人", icon: "message", description: "管理语音输入、声音与听写默认值。", keywords: "麦克风 语言 录音 屏幕" },
  { id: "agent", title: "Agent 配置", group: "个人", icon: "tools", description: "配置新运行的模型、回复和工具范围。", keywords: "权限 沙盒 搜索 确认 推理 详细程度" },
  { id: "personalization", title: "个性化", group: "个人", icon: "edit", description: "整理自定义指令、写作偏好和记忆策略。", keywords: "用户 记忆 规则 语气 人物" },
  { id: "shortcuts", title: "键盘快捷键", group: "个人", icon: "keyboard", description: "在内容和工作台之间快速切换。", keywords: "搜索 新建 标签 关闭 恢复 定位 操作" },
  { id: "usage", title: "使用情况", group: "个人", icon: "usage", description: "查看账号云点额度与消耗，管理自定义 API。", keywords: "用量 Token 云点 配额 余额 额度 百分比 账单" },
  { id: "account", title: "账号", group: "个人", icon: "user", description: "查看可选云端账号与模型使用方式。", keywords: "登录 账户 云端 云点 API 配额" },
  { id: "characters", title: "陪伴角色", group: "陪伴", icon: "cat", description: "选择开始新对话时使用的角色。", keywords: "人物 白羽澪 雪代凛音 花篠依織 霧宮栞 黒羽紬" },
  { id: "desktop", title: "Live2D 桌面陪伴", group: "陪伴", icon: "desktop", description: "配置 Live2D 陪伴窗口的显示和交互，预览角色头像尺寸。", keywords: "Live2D 角色 透明 缩放 位置 不透明度" },
  { id: "models", title: "模型与自定义 API", group: "集成", icon: "link", description: "配置你自己的 API 服务地址、模型和凭据引用。", keywords: "API Key OpenAI Anthropic 兼容 本地 默认模型" },
  { id: "extensions", title: "工具集成", group: "集成", icon: "tools", description: "管理 MCP 服务、技能目录和连接器配置。", keywords: "插件 扩展 技能 命令 HTTP" },
  { id: "computer", title: "电脑操控", group: "集成", icon: "desktop", description: "配置应用范围、操作确认和锁屏偏好。", keywords: "权限 应用 控制 授权" },
  { id: "history", title: "电脑历史记录", group: "集成", icon: "clock", description: "配置电脑活动的记录、保留与排除规则。", keywords: "活动 应用 隐私 保留期限" },
  { id: "screenshots", title: "应用快照", group: "集成", icon: "expand", description: "配置快照的发送目标、格式和文本内容。", keywords: "截屏 截图 Live2D 提示音" },
  { id: "browser", title: "浏览器", group: "集成", icon: "home", description: "配置网页、本地地址和批注截图偏好。", keywords: "URL 链接 浏览历史 密码 自动化" },
  { id: "connections", title: "设备与 SSH", group: "集成", icon: "link", description: "管理远程主机、端口和身份文件引用。", keywords: "连接 控制设备 远程 服务器" },
  { id: "coding", title: "Coding 与 Pi", group: "Coding", icon: "code", description: "管理项目目录、Pi 资源和编辑验证默认值。", keywords: "Node 工作区 工具 沙盒 模型" },
  { id: "hooks", title: "钩子", group: "Coding", icon: "workflow", description: "管理运行生命周期的事件、命令与超时配置。", keywords: "执行 事件 扩展 生命周期" },
  { id: "review", title: "代码审查", group: "Coding", icon: "search", description: "配置代码与安全审查的触发和报告规则。", keywords: "PR GitHub 严重级别 自动 手动" },
  { id: "git", title: "Git", group: "Coding", icon: "code", description: "配置分支、Pull Request、提交和审查默认值。", keywords: "前缀 合并 草稿 推送 指令" },
  { id: "worktrees", title: "工作树", group: "Coding", icon: "folder", description: "配置隔离目录、更新、保留数量与环境。", keywords: "Worktrees 清理 Git 项目" },
  { id: "data", title: "数据与备份", group: "内容管理", icon: "book", description: "导出设置和工作台索引，管理本机设置备份。", keywords: "JSON 同步 云端 导入 重置 恢复 保存" },
  { id: "archive", title: "归档", group: "内容管理", icon: "archive", description: "收起暂时不用的内容，需要时再继续。", keywords: "会话 页面 空间 项目 分组 恢复 历史" },
  { id: "trash", title: "回收站", group: "内容管理", icon: "trash", description: "查看已删除的内容，恢复到删除前的位置。", keywords: "删除 恢复 会话 页面 空间 项目 分组" },
  { id: "about", title: "关于 NekoPapa", group: "产品", icon: "help", description: "带桌面角色的个人 Agent 工作台。", keywords: "版本 本地 数据 账号 普通 Coding Pi" },
];

export function settingEntry(id: string): SettingsEntry | undefined {
  return settingsCatalog.find((entry) => entry.id === id);
}

export function searchSettings(query: string): SettingsEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return settingsCatalog.filter((entry) => terms.every((term) => `${entry.title} ${entry.group} ${entry.description} ${entry.keywords}`.toLocaleLowerCase().includes(term)));
}

// Settings is window presentation, independent of content IDs, tabs and workspace history.
export class SettingsNavigation {
  open = false;
  section: SettingsSection = "general";
  query = "";
  private history: SettingsSection[] = [];
  private index = -1;
  get canBack(): boolean { return this.index > 0; }
  get canForward(): boolean { return this.index >= 0 && this.index < this.history.length - 1; }

  enter(section: SettingsSection = "general"): void {
    if (!settingEntry(section)) return;
    if (!this.open) { this.history = []; this.index = -1; }
    this.open = true;
    this.query = "";
    this.select(section);
  }

  select(section: string): boolean {
    const entry = settingEntry(section);
    if (!this.open || !entry || this.history[this.index] === entry.id) return false;
    this.section = entry.id;
    this.history = this.history.slice(0, this.index + 1);
    this.history.push(entry.id);
    this.index = this.history.length - 1;
    return true;
  }

  travel(delta: -1 | 1): boolean {
    if (!this.open || (delta < 0 ? !this.canBack : !this.canForward)) return false;
    this.index += delta;
    this.section = this.history[this.index];
    this.query = "";
    return true;
  }

  close(): void { this.open = false; this.query = ""; }
}

export function settingsShortcuts(mac: boolean): Array<[string, string]> {
  const command = mac ? "⌘" : "Ctrl+";
  const shift = mac ? "⇧" : "Shift+";
  return [
    ["打开设置", `${command},`], ["搜索内容 / 设置", `${command}K`],
    ["新建当前分类内容", `${command}N`], ["新建标签菜单", `${command}T`],
    ["关闭当前标签 / 返回工作台", `${command}W`], ["恢复关闭的标签", `${shift}${command}T`],
    ["展开或收起侧栏", `${command}B`], ["打开或关闭活动视图", `${mac ? "⌥" : "Alt+"}${command}U`],
    ["展开或还原内容区", `${shift}${command}F`], ["打开条目操作", "Shift+F10"],
    ["关闭弹窗 / 退出设置", "Esc"],
  ];
}
