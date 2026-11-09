import type { ConfigurationSchema, ConfigurationField as Field } from "./configuration-types";

const select = (key: string, label: string, initial: string, options: Field["options"], hint = "", control: Field["control"] = "select"): Field => ({ key, label, hint, initial, options, type: "select", control });
const toggle = (key: string, label: string, hint: string, initial = false): Field => ({ key, label, hint, initial, type: "boolean", control: "switch" });
const tags = (key: string, label: string, hint: string, initial = ""): Field => ({ key, label, hint, initial, type: "textarea", control: "tags", maxLength: 4000 });
const number = (key: string, label: string, hint: string, initial: number, min: number, max: number, unit?: string): Field => ({ key, label, hint, initial, min, max, step: 1, type: "number", control: "number", unit });

/** Coding-session rules a future Pi / executor adapter reads before running tools. */
export const developmentConfiguration: readonly ConfigurationSchema[] = [
  { id: "permissions", effect: "runtime", scope: "Coding 权限规则 · 执行器尚未接入；规则只作为默认值保存，不会授予或撤销任何权限。", blocks: [
    { title: "默认模式", fields: [
      { ...select("mode", "权限模式", "ask", [["ask", "每次询问"], ["acceptEdits", "自动接受编辑"], ["plan", "仅计划"]]),
        optionHints: { ask: "读取以外的操作都先询问。", acceptEdits: "工作目录内的文件修改直接应用，命令仍然询问。", plan: "只分析和提出计划，不修改文件或运行命令。" } },
      toggle("sandbox", "在沙箱中运行命令", "限制命令只能访问工作目录和允许的网络。", true),
    ] },
    { title: "命令规则", fields: [
      tags("allow", "允许的命令", "匹配的命令直接运行，例如 npm run test。"),
      tags("ask", "需要确认的命令", "匹配的命令总是先询问，例如 git push。", "git push"),
      tags("deny", "禁止的命令", "匹配的命令不会运行，例如 rm -rf。", "rm -rf"),
    ] },
    { title: "文件与网络", fields: [
      tags("directories", "额外可访问目录", "工作目录以外允许读写的路径。"),
      tags("protected", "受保护的文件", "不允许读取或修改的路径模式。", ".env\n*.pem\n*.key"),
      tags("domains", "允许访问的网络域名", "沙箱内命令可以访问的域名。"),
    ] },
  ] },
  { id: "context", effect: "runtime", scope: "上下文与指令 · Pi 适配层尚未接入；这些规则不会读取项目文件。", blocks: [
    { title: "项目指令", fields: [
      toggle("projectInstructions", "读取项目指令文件", "从工作目录读取 AGENTS.md 或 CLAUDE.md。", true),
      tags("extraInstructions", "额外指令文件", "相对工作目录的路径，例如 docs/CONVENTIONS.md。"),
      toggle("gitStatus", "附带 Git 状态", "新会话开始时提供当前分支和变更摘要。", true),
    ] },
    { title: "文件范围", fields: [
      toggle("respectGitignore", "遵循 .gitignore", "搜索和读取时跳过被忽略的文件。", true),
      tags("ignore", "额外忽略的文件", "路径或通配符，例如 dist、*.log。", "node_modules\ndist"),
    ] },
    { title: "压缩", fields: [
      toggle("autoCompact", "自动压缩上下文", "接近上下文上限时总结较早的对话。", true),
      { key: "compactThreshold", label: "压缩阈值", hint: "上下文使用达到该比例时压缩。", type: "number", control: "slider", initial: 85, min: 50, max: 95, step: 5, unit: "%" },
    ] },
  ] },
  { id: "editor", effect: "runtime", scope: "编辑器与终端 · 文件打开和终端服务尚未接入；保存不会启动编辑器或 Shell。", blocks: [
    { title: "编辑器", fields: [
      select("external", "外部编辑器", "system", [["system", "系统默认"], ["vscode", "VS Code"], ["cursor", "Cursor"], ["zed", "Zed"], ["jetbrains", "JetBrains IDE"], ["xcode", "Xcode"]], "从变更和文件链接打开时使用。"),
      { ...select("diff", "差异视图", "unified", [["unified", "统一"], ["split", "并排"]], "", "segmented"), optionHints: { unified: "增删内容上下排列。", split: "修改前后左右对照。" } },
      toggle("wrap", "自动换行", "长行在差异和文件预览中换行。", true),
      toggle("whitespace", "显示空白字符变化", "在差异中标出缩进和行尾空格。"),
    ] },
    { title: "终端", fields: [
      select("shell", "Shell", "system", [["system", "系统默认"], ["zsh", "zsh"], ["bash", "bash"], ["fish", "fish"], ["pwsh", "PowerShell"]], "Agent 运行命令时使用。"),
      number("fontSize", "终端字号", "内置终端的字号。", 13, 10, 24, " px"),
      number("timeout", "命令超时", "超过时间仍未结束的命令会被停止。", 120, 10, 3600, " 秒"),
    ] },
  ] },
];
