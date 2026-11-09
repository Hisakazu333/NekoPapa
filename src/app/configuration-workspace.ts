import type { ConfigurationSchema, ConfigurationField as Field } from "./configuration-types";

const select = (key: string, label: string, initial: string, options: Field["options"], hint = "", control: Field["control"] = "select"): Field => ({ key, label, hint, initial, options, type: "select", control });
const toggle = (key: string, label: string, hint: string, initial = false): Field => ({ key, label, hint, initial, type: "boolean", control: "switch" });

/** Workspace-wide preferences: conversation behaviour, notifications, updates and privacy. */
export const workspaceConfiguration: readonly ConfigurationSchema[] = [
  // Conversation settings take effect immediately; the desktop blocks wait for the Tauri host.
  { id: "general", effect: "immediate", scope: "常规 · 新对话与输入设置保存后立即生效。", blocks: [
    { title: "新建对话", fields: [
      { ...select("defaultMode", "默认模式", "auto", [["auto", "Auto"], ["chat", "聊天"], ["study", "学习"], ["agent", "Agent"]]), optionHints: {
        auto: "根据任务选择聊天、学习或 Agent。自动路由服务接入前，Auto 模式不能发送。",
        chat: "普通对话，连接模型后即可使用。",
        study: "讲解、练习与复习。学习服务接入前不能发送。",
        agent: "通用任务与 Coding。执行服务接入前不能发送。",
      } },
      { ...select("projectFolder", "项目文件夹", "inherit", [["inherit", "沿用当前项目"], ["none", "不使用项目文件夹"]]), optionHints: {
        inherit: "在某个项目里新建对话时，新对话仍归入该项目。",
        none: "新对话默认不归入项目；可在首页工具栏或侧栏项目中选择。",
      } },
      { ...select("startup", "启动时打开", "new", [["new", "空白对话"], ["last", "最近的对话"]]), optionHints: { new: "每次启动都从空白对话开始。", last: "打开最近更新的工作台对话；没有对话时从空白对话开始。" } },
    ] },
    { title: "输入", fields: [
      { ...select("sendKey", "发送消息", "enter", [["enter", "Enter 发送"], ["mod-enter", "⌘ / Ctrl + Enter 发送"]]), optionHints: { enter: "Shift + Enter 换行。适用于工作台和联系人聊天。", "mod-enter": "Enter 换行，⌘ / Ctrl + Enter 发送。适合输入多行代码或笔记。" } },
    ] },
    { title: "通知", pending: "系统通知需要桌面宿主支持，当前只保存偏好，不会申请通知权限。", fields: [
      toggle("notifyComplete", "回复或任务完成时通知", "长时间的回复、学习任务或 Coding 运行结束后提醒。"),
      toggle("notifyApproval", "需要确认时通知", "Agent 等待你批准工具调用或文件修改时提醒。", true),
      toggle("notifyBackgroundOnly", "仅在窗口不在前台时通知", "正在查看 NekoPapa 时不重复提醒。", true),
      toggle("completionSound", "完成提示音", "完成时播放提示音。"),
    ] },
    { title: "启动与更新", pending: "登录项、退出确认和自动更新需要桌面宿主支持，当前只保存偏好。", fields: [
      toggle("launchAtLogin", "登录时启动", "登录系统后自动打开 NekoPapa。"),
      toggle("confirmQuit", "退出前确认", "有回复或任务正在运行时先询问。", true),
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
