import type { ConfigurationSchema, ConfigurationField as Field } from "./configuration-types";

const select = (key: string, label: string, initial: string, options: Field["options"], hint = ""): Field => ({ key, label, hint, initial, options, type: "select" });
const toggle = (key: string, label: string, hint: string, initial = false): Field => ({ key, label, hint, initial, type: "boolean" });
const text = (key: string, label: string, hint: string, maxLength = 500, initial = ""): Field => ({ key, label, hint, initial, maxLength, type: "text" });

export const codingConfiguration: readonly ConfigurationSchema[] = [
  { id: "coding", effect: "runtime", scope: "Coding 默认值 · Pi 适配层和运行进程尚未接入；不改变已有项目或执行命令。", blocks: [
    { title: "项目与 Pi", fields: [
      text("directory", "默认工作目录", "留空时由新 Coding 会话选择；不会自动绑定已有会话。"),
      text("executable", "Node.js 可执行文件", "留空使用未来随应用提供的运行时。"),
      text("resources", "Pi 资源目录", "存放扩展、技能和提示模板的目录。"),
      select("modelId", "Coding 默认模型", "", [["", "沿用 Agent 默认"]], "来自已保存的模型连接配置。"),
    ] },
    { title: "编辑与验证", fields: [
      toggle("confirmEdits", "写入文件前确认", "交给 Pi 适配层执行。", true),
      toggle("verifyChanges", "修改后运行验证", "按项目定义的验证命令运行。", true),
      { ...text("instructions", "Coding 指令", "补充项目工作习惯；不能取代仓库中的指令。", 12000), type: "textarea" },
    ] },
  ] },
  { id: "review", effect: "runtime", scope: "审查默认值 · Git 服务和审查 Agent 尚未接入，没有自动审查或额度消耗。", blocks: [
    { title: "代码审查", fields: [
      toggle("automatic", "新 PR 的自动审查偏好", "保存为未来新项目的默认配置。"),
      select("trigger", "审查触发条件", "manual", [["manual", "仅手动请求"], ["open", "打开 PR 时"], ["update", "每次更新 PR 时"]]),
      toggle("comprehensive", "继续查找新问题", "由审查 Agent 控制检查轮次。", true),
    ] },
    { title: "安全审查", fields: [
      toggle("security", "包含安全审查", "安全审查服务接入后使用。"),
      select("automaticSeverity", "自动报告的最低严重级别", "high", [["high", "高"], ["medium", "中"], ["low", "低"]]),
      select("manualSeverity", "手动报告的最低严重级别", "medium", [["high", "高"], ["medium", "中"], ["low", "低"]]),
    ] },
  ] },
  { id: "git", effect: "runtime", scope: "Git 默认值 · 当前没有 Git 执行服务；保存不会创建分支、推送或合并 PR。", blocks: [
    { title: "分支与 Pull Request", fields: [
      { ...text("branchPrefix", "分支前缀", "新建分支时使用。", 80, "nekopapa/"), required: true, format: "branch" },
      select("merge", "PR 合并方式", "squash", [["squash", "压缩合并"], ["merge", "合并提交"]]),
      toggle("forceWithLease", "推送时使用 force-with-lease", "由实际推送流程检查并确认。"),
      toggle("draft", "默认创建草稿 PR", "便于先检查变更。", true),
      select("presentation", "审查结果呈现方式", "inline", [["inline", "当前会话"], ["separate", "独立审查会话"]]),
    ] },
    { title: "提交与审查指令", fields: [
      { ...text("commitInstructions", "提交信息指引", "例如语言、格式和说明范围。", 4000), type: "textarea" },
      { ...text("prInstructions", "PR 描述指引", "例如行为变化和验证证据。", 4000), type: "textarea" },
    ] },
  ] },
  { id: "worktrees", effect: "runtime", scope: "工作树默认值 · Git 工作树管理服务尚未接入；不会创建目录或清理磁盘文件。", blocks: [
    { title: "常规", fields: [
      text("root", "工作树根目录", "留空使用未来宿主提供的应用数据目录。"),
      toggle("fetch", "创建前获取上游更新", "由 Git 服务执行。"),
      toggle("cleanup", "自动清理旧工作树", "先保存可恢复快照，再按保留数量清理。"),
      { key: "limit", label: "保留数量", hint: "用于未来的清理规则。", type: "number", initial: 15, min: 1, max: 100, step: 1 },
    ] },
    { title: "环境", fields: [
      { ...text("setup", "环境准备说明", "记录依赖安装或环境需求，不在此页面执行。", 4000), type: "textarea" },
    ] },
  ] },
];
