import type { ConfigurationSchema, ConfigurationField as Field, ConfigurationCollection } from "./configuration-types";

const text = (key: string, label: string, hint = "", maxLength = 500): Field => ({ key, label, hint, type: "text", initial: "", maxLength });
const select = (key: string, label: string, initial: string, options: Field["options"], hint = ""): Field => ({ key, label, hint, initial, options, type: "select" });
const toggle = (key: string, label: string, hint: string, initial = false): Field => ({ key, label, hint, initial, type: "boolean" });

export const integrationConfiguration: readonly ConfigurationSchema[] = [
  { id: "computer", effect: "runtime", scope: "电脑操作默认值 · 电脑控制服务尚未接入；更改不会取得系统或应用访问权限。", blocks: [
    { title: "操作范围", fields: [
      toggle("enabled", "使用电脑操作工具", "作为未来运行的工具偏好。"),
      { ...text("applications", "允许的应用", "每行一个应用名称或标识，留空不允许任何应用。", 2000), type: "textarea" },
      select("confirmation", "操作确认", "always", [["always", "每次操作确认"], ["changes", "有修改的操作确认"]]),
      toggle("locked", "锁屏时允许操作", "还需宿主支持和单独授权；当前不操作锁定的电脑。"),
    ] },
  ] },
  { id: "history", effect: "runtime", scope: "活动记录策略 · 当前没有电脑活动采集服务，不会读取其他应用或记录屏幕。", blocks: [
    { title: "记录与保留", fields: [
      select("policy", "记录方式", "off", [["off", "关闭"], ["manual", "仅手动提供"]]),
      select("retention", "保留期限", "7", [["7", "7 天"], ["30", "30 天"], ["90", "90 天"]]),
      { ...text("excluded", "排除的应用", "每行一个应用名称，供未来采集服务使用。", 2000), type: "textarea" },
    ] },
  ] },
  { id: "screenshots", effect: "runtime", scope: "应用快照默认值 · 快照服务尚未接入；保存设置不会截屏。", blocks: [
    { title: "快照", fields: [
      select("target", "发送目标", "ask", [["ask", "每次选择"], ["current", "当前会话"], ["mini", "Live2D 陪伴窗口"]]),
      select("format", "图片格式", "png", [["png", "PNG"], ["jpeg", "JPEG"]]),
      toggle("includeText", "包含可访问文本", "需要应用支持可访问文本。", true),
      toggle("sound", "播放提示音", "快照成功时播放。"),
    ] },
  ] },
  { id: "browser", effect: "runtime", scope: "浏览器默认值 · 内置浏览器与自动化服务尚未接入，没有浏览数据或密码记录。", blocks: [
    { title: "链接与浏览", fields: [
      select("webTarget", "网页链接打开位置", "system", [["system", "系统默认浏览器"], ["internal", "内置浏览器"]]),
      select("localTarget", "本地开发地址打开位置", "system", [["system", "系统默认浏览器"], ["internal", "内置浏览器"]]),
      toggle("fullUrl", "显示完整网址", "未来地址栏显示路径、查询参数和片段。"),
      select("annotations", "批注时包含截图", "ask", [["ask", "每次选择"], ["always", "始终包含"], ["never", "不包含"]]),
    ] },
  ] },
];

export interface CollectionSchema { title: string; singular: string; description: string; fields: readonly Field[] }
const name: Field = { ...text("name", "名称", "用于识别这份配置。", 72), required: true };
const environment: Field = { ...text("environment", "凭据环境变量名", "仅保存变量名，不填写 API Key 或密码。", 80), format: "environment" };

export const collectionSchemas: Record<ConfigurationCollection, CollectionSchema> = {
  models: { title: "自定义 API", singular: "API 配置", description: "保存你自己的 API 服务、模型与凭据引用。由 API 提供方计费；模型调用与连接测试待接入。", fields: [
    name,
    select("provider", "接口类型", "compatible", [["compatible", "OpenAI 兼容接口"], ["anthropic", "Anthropic 接口"], ["custom", "其他接口"]]),
    { ...text("endpoint", "服务地址", "完整的 HTTP 或 HTTPS 基础地址，不包含密钥。"), required: true, format: "url" },
    { ...text("model", "模型标识", "填写提供方的实际模型 ID。", 160), required: true },
    environment,
  ] },
  extensions: { title: "工具集成", singular: "工具配置", description: "管理 MCP、技能目录与连接器配置。配置不会启动命令、安装软件或连接外部账号。", fields: [
    name,
    select("kind", "类型", "mcp", [["mcp", "MCP 服务"], ["skill", "技能目录"], ["connector", "连接器"]]),
    select("transport", "传输方式", "stdio", [["stdio", "本地命令 / 目录"], ["http", "HTTP 服务"]]),
    text("command", "命令或目录", "本地 MCP 填写启动命令；技能填写目录。不会在保存时执行。", 2000),
    { ...text("endpoint", "服务地址", "HTTP 服务使用；不填写密码或令牌。"), format: "url" },
    environment,
  ] },
  connections: { title: "设备与 SSH", singular: "设备配置", description: "保存远程设备连接信息。当前没有远程执行服务，不会建立 SSH 连接。", fields: [
    name,
    { ...text("host", "主机地址", "主机名、IPv4 或 IPv6 地址，不包含协议。", 253), required: true, format: "host" },
    { key: "port", label: "端口", hint: "SSH 服务端口。", type: "number", initial: 22, min: 1, max: 65535, step: 1 },
    { ...text("username", "用户名", "远程设备上的用户名。", 80), required: true },
    text("identity", "身份文件路径", "仅保存路径，不读取或导入私钥。", 500),
  ] },
  hooks: { title: "生命周期钩子", singular: "钩子", description: "保存运行事件、命令与超时。当前没有钩子执行器，配置不会运行任何命令。", fields: [
    name,
    select("event", "触发事件", "run-end", [["chat-start", "新会话开始"], ["before-tool", "工具执行前"], ["after-tool", "工具执行后"], ["run-end", "运行结束"]]),
    { ...text("command", "命令", "由未来运行服务调用。", 2000), required: true },
    { key: "timeout", label: "超时（秒）", hint: "超时后由执行器停止钩子。", type: "number", initial: 30, min: 1, max: 300, step: 1 },
  ] },
};
