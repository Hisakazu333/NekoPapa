import type { ConfigurationField as Field, ConfigurationSchema } from "./configuration-types";

const select = (key: string, label: string, initial: string, options: Field["options"], hint = ""): Field => ({ key, label, initial, options, hint, type: "select" });
const toggle = (key: string, label: string, initial: boolean, hint: string): Field => ({ key, label, initial, hint, type: "boolean" });
const text = (key: string, label: string, hint: string, maxLength = 500, initial = ""): Field => ({ key, label, hint, initial, maxLength, type: "text" });

export const personalConfiguration: readonly ConfigurationSchema[] = [
  { id: "profile", effect: "immediate", scope: "本机资料 · 名称用于账号菜单，不关联在线账号。", blocks: [
    { title: "个人资料", fields: [
      { ...text("name", "显示名称", "在本机的个人资料和账号菜单中显示。", 60, "NekoPapa 用户"), required: true },
      { ...text("biography", "关于你", "保存在本机，供你整理个人介绍。", 1000), type: "textarea" },
      { ...text("website", "个人网站", "可选，填写完整的 HTTP 或 HTTPS 地址。"), format: "url" },
    ] },
  ] },
  { id: "appearance", effect: "immediate", scope: "应用外观 · 保存后立即应用于工作台、设置和弹窗。", blocks: [
    { title: "视觉风格", fields: [
      select("mode", "模式", "system", [["system", "跟随系统"], ["light", "浅色"], ["dark", "深色"]]),
      select("accent", "强调色", "green", [["green", "鼠尾草绿"], ["blue", "蓝色"], ["purple", "紫色"], ["orange", "暖橙色"]], "用于开关、选中状态和输入焦点。"),
      select("font", "字体", "system", [["system", "系统字体"], ["serif", "衬线字体"], ["mono", "等宽字体"]]),
      select("density", "设置列表密度", "comfortable", [["comfortable", "舒适"], ["compact", "紧凑"]]),
      toggle("reducedMotion", "减少动态效果", false, "关闭图标反馈动画和界面过渡；系统的减少动态效果偏好仍然有效。"),
    ] },
  ] },
  { id: "voice", effect: "runtime", scope: "语音默认值 · 语音服务和设备访问尚未接入，保存不会申请麦克风或屏幕权限。", blocks: [
    { title: "输入", fields: [
      text("microphone", "麦克风设备", "留空使用系统默认设备；接入语音后核实设备。", 160),
      select("language", "识别语言", "auto", [["auto", "自动检测"], ["zh", "中文"], ["ja", "日语"], ["en", "英语"]]),
    ] },
    { title: "语音聊天与听写", fields: [
      text("voice", "声音标识", "由语音提供方提供的声音 ID，不预置未连接的声音。", 120),
      toggle("screenContext", "在语音中使用屏幕上下文", false, "仅保存偏好；实际使用需要对应服务和系统授权。"),
      toggle("keepRecordings", "保留最近录音", false, "录音服务接入后才会产生记录。"),
    ] },
  ] },
  { id: "agent", effect: "runtime", scope: "新运行默认值 · 当前普通 Agent 尚未接入；已有会话和正在执行的任务不受影响。", blocks: [
    { title: "模型与回复", fields: [
      select("modelSource", "模型来源", "custom", [["custom", "自定义 API"], ["cloud", "官方云端 · 云点（待接入）"]], "自定义 API 独立使用，由提供方计费；官方云端为可选服务，尚未接入。"),
      select("modelId", "自定义 API 配置", "", [["", "暂不指定"]], "选择「模型与自定义 API」中的配置；仅在模型来源为自定义 API 时使用。"),
      select("verbosity", "输出详细程度", "auto", [["auto", "由模型决定"], ["short", "简洁"], ["detailed", "详细"]]),
      select("reasoning", "推理强度偏好", "auto", [["auto", "由模型决定"], ["low", "低"], ["medium", "中"], ["high", "高"]], "是否支持以及实际取值由接入的模型决定。"),
    ] },
    { title: "权限与网络", fields: [
      select("approval", "操作确认", "request", [["always", "每次确认"], ["request", "按操作请求"]], "作为执行器的默认策略；当前不会授予工具权限。"),
      select("sandbox", "文件访问范围", "readonly", [["readonly", "只读"], ["workspace", "当前工作目录"]]),
      select("webSearch", "网页搜索", "off", [["off", "关闭"], ["cached", "优先缓存"], ["live", "实时搜索"]]),
    ] },
  ] },
  { id: "personalization", effect: "runtime", scope: "用户偏好 · 当前保存指令和记忆策略，尚未生成或检索长期记忆。", blocks: [
    { title: "自定义指令", fields: [
      { ...text("instructions", "给 Agent 的指令", "描述称呼、语气、工作习惯和希望遵守的规则。", 12000), type: "textarea" },
      toggle("writingStyle", "参考我的写作偏好", false, "使用明确填写的指令，不会读取其他应用或历史文件。"),
    ] },
    { title: "记忆", fields: [
      select("memory", "记忆策略", "off", [["off", "不创建记忆"], ["ask", "创建前确认"]]),
      select("scope", "记忆范围", "character", [["character", "按角色独立"], ["user", "用户共享"]]),
      toggle("toolMemory", "允许工具结果进入记忆", false, "仍受记忆策略限制；当前没有可清除的记忆记录。"),
    ] },
  ] },
  { id: "desktop", effect: "runtime", scope: "Live2D 默认值 · 模型渲染与原生透明窗口尚未接入；角色头像仅用于尺寸预览。", blocks: [
    { title: "显示", fields: [
      toggle("showOnLaunch", "启动时显示陪伴窗口", false, "原生陪伴窗口接入后使用。"),
      { key: "scale", label: "角色尺寸", hint: "预览与默认缩放比例。", type: "number", initial: 1, min: 0.5, max: 2, step: 0.1 },
      { key: "opacity", label: "不透明度", hint: "预览与窗口默认不透明度（百分比）。", type: "number", initial: 100, min: 30, max: 100, step: 1 },
      select("position", "初始位置", "right", [["right", "屏幕右侧"], ["left", "屏幕左侧"], ["remember", "记住上次位置"]]),
    ] },
    { title: "窗口交互", fields: [
      toggle("alwaysOnTop", "保持在其他窗口上方", false, "仅影响未来的陪伴窗口。"),
      toggle("clickThrough", "鼠标穿透", false, "让鼠标操作窗口后方的内容。"),
      toggle("hideFullscreen", "全屏时隐藏", true, "避免遮挡全屏应用。"),
    ] },
  ] },
];
