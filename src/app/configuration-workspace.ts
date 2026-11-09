import type { ConfigurationSchema, ConfigurationField as Field } from "./configuration-types";

const select = (key: string, label: string, initial: string, options: Field["options"], hint = "", control: Field["control"] = "select"): Field => ({ key, label, hint, initial, options, type: "select", control });
const toggle = (key: string, label: string, hint: string, initial = false): Field => ({ key, label, hint, initial, type: "boolean", control: "switch" });

/** Workspace-wide preferences: startup, notifications, updates and privacy. */
export const workspaceConfiguration: readonly ConfigurationSchema[] = [
  { id: "general", effect: "runtime", scope: "常规偏好 · 启动、通知和更新服务尚未接入；保存不会申请系统通知权限或检查更新。", blocks: [
    { title: "启动与对话", fields: [
      { ...select("startup", "启动时打开", "new", [["new", "空白对话"], ["last", "上次的会话"]]), optionHints: { new: "每次启动都从空白对话开始。", last: "恢复上次关闭时正在查看的会话。" } },
      { ...select("sendKey", "发送消息", "enter", [["enter", "Enter 发送"], ["mod-enter", "⌘ / Ctrl + Enter 发送"]]), optionHints: { enter: "Shift + Enter 换行。", "mod-enter": "Enter 换行，组合键发送。" } },
      toggle("launchAtLogin", "登录时启动", "由桌面宿主注册登录项。"),
      toggle("confirmQuit", "退出前确认", "有任务正在运行时先询问。", true),
    ] },
    { title: "通知", fields: [
      toggle("notifyApproval", "需要确认时通知", "Agent 等待你批准工具调用或文件修改时提醒。", true),
      toggle("notifyComplete", "任务完成时通知", "运行结束后发送系统通知。"),
      toggle("completionSound", "完成提示音", "任务完成时播放提示音。"),
      toggle("notifyBackgroundOnly", "仅在窗口不在前台时通知", "正在查看 NekoPapa 时不重复提醒。", true),
    ] },
    { title: "更新", fields: [
      toggle("autoUpdate", "自动检查更新", "发现新版本时在账号菜单中提示。", true),
      { ...select("channel", "更新渠道", "stable", [["stable", "稳定版"], ["preview", "预览版"]], "", "segmented"), optionHints: { stable: "经过完整验证的版本。", preview: "更早获得新功能，可能不稳定。" } },
    ] },
  ] },
  { id: "privacy", effect: "runtime", scope: "隐私偏好 · 当前版本不收集或发送使用数据；聊天记录清理服务尚未接入。", blocks: [
    { title: "聊天记录", fields: [
      select("retention", "本机聊天记录保留", "forever", [["forever", "永久保留"], ["90", "90 天"], ["30", "30 天"], ["7", "7 天"]], "超过期限的已归档会话将被清理。"),
      toggle("excludeArchived", "导出时排除已归档会话", "未来导出聊天记录时使用。"),
    ] },
    { title: "诊断", fields: [
      toggle("usageStats", "发送匿名使用统计", "帮助改进 NekoPapa；不包含对话内容。"),
      toggle("crashReports", "发送崩溃报告", "只包含错误堆栈和版本信息。"),
    ] },
  ] },
];
