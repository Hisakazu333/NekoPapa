import type { IconName } from "./icons";

export type FeatureId = "desktop-companion" | "characters" | "memory" | "workflows" | "agent-workspace" | "schedules" | "model-connections";
export interface FeatureDefinition {
  id: FeatureId;
  title: string;
  icon: IconName;
  category: "陪伴" | "执行" | "连接";
  status: "可切换" | "待接入";
  description: string;
  capabilities: string[];
}

// Product entry points describe planned capabilities; they are never content records.
export const featureCatalog: readonly FeatureDefinition[] = [
  { id: "desktop-companion", title: "桌面陪伴", icon: "desktop", category: "陪伴", status: "待接入",
    description: "让角色留在桌面上，陪你聊天，也陪你工作。",
    capabilities: ["透明 Live2D 窗口，可拖动、隐藏和再次唤起", "桌面互动继续已有对话，与主窗口共用会话", "显示角色不重复启动 Agent，隐藏角色不停止运行"] },
  { id: "characters", title: "角色", icon: "cat", category: "陪伴", status: "可切换",
    description: "选择陪伴角色，开始或继续与她的对话。",
    capabilities: ["可选择官网公布的五位角色，新对话绑定所选人物", "切换角色保留正在打开的内容，继续对话复用该人物的会话", "聊天模型与 Live2D 尚未接入；部分角色头像待更新"] },
  { id: "memory", title: "记忆", icon: "book", category: "陪伴", status: "待接入",
    description: "由你决定角色记住什么，让陪伴延续到下一次交流。",
    capabilities: ["确认、查看、修改和删除长期记忆", "按角色整理偏好与重要事实", "与聊天历史、上下文压缩和 Coding 会话分别管理"] },
  { id: "workflows", title: "工作流", icon: "workflow", category: "执行", status: "待接入",
    description: "把常做的事情组织成步骤，让普通陪伴 Agent 也能协助完成工作。",
    capabilities: ["选定资料、整理摘要，再保存为页面", "查看每一步的输入、输出与待确认操作", "失败可处理，重试不重复创建成果"] },
  { id: "agent-workspace", title: "Agent 工作区", icon: "terminal", category: "执行", status: "待接入",
    description: "在独立工作区查看 Agent 的任务、步骤和待确认操作。",
    capabilities: ["普通陪伴与 Pi Coding 的运行分别展示", "工作区与主窗口引用同一次运行", "真实执行信息接入前，可先查看已有会话活动"] },
  { id: "schedules", title: "定时任务", icon: "clock", category: "执行", status: "待接入",
    description: "为需要反复完成的工作设置时间规则。",
    capabilities: ["明确选择会话、工作流与运行时间", "暂停、恢复，并查看实际执行记录", "休眠错过、归档或运行冲突有明确处理结果"] },
  { id: "model-connections", title: "模型与连接", icon: "link", category: "连接", status: "待接入",
    description: "管理普通陪伴与 Coding 使用的模型，以及允许 Agent 访问的工具。",
    capabilities: ["配置模型服务、连接状态与模式选择", "接入工具与资料来源，并管理授权范围", "凭据由系统安全存储管理，不保存在会话索引中"] },
];

export const defaultPinnedFeatures: FeatureId[] = ["desktop-companion", "memory", "workflows"];
export const maxPinnedFeatures = 4;
export function featureById(id: string): FeatureDefinition | undefined { return featureCatalog.find((feature) => feature.id === id); }
export function normalizePinnedFeatures(value: unknown): FeatureId[] {
  if (!Array.isArray(value)) return [...defaultPinnedFeatures];
  return [...new Set(value.filter((id): id is FeatureId => typeof id === "string" && !!featureById(id)))].slice(0, maxPinnedFeatures);
}
