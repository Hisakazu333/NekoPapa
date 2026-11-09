# BoardUI Chat Starter 源码

2026-11-08 使用官方命令安装完整免费模板：

```bash
npx -y boardui@latest add agent-chat --yes --overwrite
```

参考页面：https://www.boardui.com/zh-hans/templates/chat-starter

注册表：https://www.boardui.com/r/agent-chat.json

联系人交互参考：https://www.boardui.com/zh-hans/templates/multi-agent-chat 。2026-11-08 实际打开并操作其模型菜单、附件菜单和联系人右键菜单，核对输入栏层级、圆形工具按钮及编辑 / 删除入口；本项目按现有模型执行能力适配，不宣称具备参考模板全部功能。

`src/main.ts` 直接渲染从官方模板适配的 `AgentChat`，`/` 与 `/chat.html` 使用同一个 React + Vite 入口。模板提供组件、主题和聊天基础；当前首页、联系人连续聊天和辅助区布局均已按 NekoPapa 需求修改，不能再用官方预览描述当前页面。旧的 `src/chat/` 自写界面和 `prototypes/chat-shell/` 已删除；此前 DOM 工作台的其他兼容源码仍保留，但不在当前入口使用。

安装时原始 `AgentChat` 的 SHA-256 为 `18732c897e4d07e38d4b40be43faf7bc7f51f26abc4feaf529f53280b4e1dd8e`。当前已按项目需求修改，不能再声称与注册表逐字一致。第三方来源仍保留于此，产品中的示例账号、BoardUI 品牌素材、升级推广、演示导航与脚本聊天均已移除。只保留实际聊天和账号入口使用的组件，删除无引用的展示、图表、认证示例、通知和套餐页面及其素材。

Vite 适配保留 `src/platform/fonts.css`（字体变量）和 `scripts/boardui-chat-api.ts`（GET/POST 与 Vite dev/preview 服务器桥接）。默认模型提示词使用 NekoPapa 身份，联系人请求携带经过校验的联系人上下文。样式已删除未用营销、图表和演示页规则，当前主题模式由本项目设置管理。底部账号菜单沿用 ConfigurationStore，不另造资料存储，也不使用示例姓名、邮箱或虚构登录状态。

当前界面改动：

- 侧栏保留工作台、联系人和底部账号；五位同伴与新增入口位于主区联系人页。
- 工作台首页使用猫图标、衬线问候、大 textarea、工具区和快捷提示；快捷提示只编辑草稿。模式放在输入框下层，与联系人选择同层；工作台默认 Auto，提供 Auto、聊天、学习、Agent，Agent 同时涵盖通用任务与 Coding，不拆成两个模式。自建联系人提供聊天、学习、专业协助；官方人物默认聊天，只提供聊天、学习。
- 联系人页使用紧凑搜索列表、连续消息和矩形 textarea；各自保存当前页面中的草稿与流式状态，已打开组件保持挂载。
- 单聊输入框采用文本在上、附件 / 权限 / 模型 / 发送控件在下的排列；模式与表情位于下层工具栏，权限按钮只管理权限策略。模型使用名称与箭头，发送 / 停止使用圆形按钮。
- Composer 继续复用已引入的 BoardUI Dropdown 基础组件；模型面板按参考页面的 42px 供应商图标栏、紧凑模型行与圆形选中标记适配，支持快速搜索、空状态和管理模型，只读取真实配置与运行模型，不填充演示目录。本项目没有安装完整 BoardUI Pro 的 `ComposerPanel` / `ModelPicker` 源码。
- 模型供应商图标使用在参考页面核实的 BoardUI 静态 SVG：`/composer-panel/models/openai.svg`、`anthropic.svg`、`deepseek.svg`，打包副本位于 `public/boardui/composer-panel/models/`。附件插件图标来自 `/ai-chat/plugin-documents.svg`、`plugin-spreadsheets.svg`、`plugin-presentations.svg` 与 `plugin-codeblocks.svg`，副本位于 `public/boardui/ai-chat/`；均不代表获得完整 Pro 模板源码。
- 工作台与自建联系人的添加菜单保留文件和文件夹、目标、计划模式，以及文档、电子表格、演示文稿和代码块输出选择。官方人物只显示文件资料入口，不提供目标、计划或插件。文件仅暂存当前草稿；Auto 路由、学习、Agent 执行、附件发送和文件生成未接入时明确阻止发送，不以普通聊天替代这些请求。权限策略和本机模型选择仍只保存前端偏好。
- 联系人采用分组标题和现有 BoardUI disclosure 箭头展开 / 收起，平铺聊天行并保存显示偏好；群聊行和标题更多菜单复用既有 Dropdown / AlertDialog 组件完成删除确认、取消及失败重试。
- 自建联系人行支持更多菜单、右键与键盘菜单的编辑 / 删除；删除确认同时清理单聊，保留既有群聊，存储失败按阶段显示原记录保留或历史待清理，并明确重试。
- 自建联系人资料面板支持本机头像导入、裁剪预览、更换与移除，保存 / 取消复用联系人草稿；列表与单聊读取同一保存结果。头像不随模型请求上传，官方人物资料仍只读。
- 工作台右侧历史辅助区使用可拖动分隔条；联系人按稳定 contact.id 继续最近会话，保留原 thread.id。
- 共享 ChatHistoryStore 按 ID 合并工作台与联系人历史，兼容读取旧历史；设置有 27 个分类，未接入能力只保存配置。
- 设置页按官方 `settings-modal` 区块组合：`settings-rows.tsx` 的 `SettingsRow` 增加 `labelId` / `descriptionId` / `error` / `stacked`；`settings-record-rows.tsx` 改编自官方 Tools 页的 ServerTile / ServerRow / ServerMenu / NewServerRow（方块颜色改用 Chip 状态色，状态点只表示未接入）；`radio-card.tsx` 的说明由截断改为换行。未安装官方 `file-upload`：它模拟上传进度，与真实状态要求冲突，数据页导入区只沿用其空闲外观。

未配置模型时，探针返回 `configured: false`，界面保留草稿输入并禁用发送，不生成脚本回复。真实调用路径需要 Vite 服务器环境变量，本机模型配置记录尚未驱动此路由；本轮没有据此宣称已经完成真实提供方问答验收。

官方人物的人设由 Java 后端负责，桌面端不按人物简介拼装替代人设。官方服务状态独立于通用模型配置，尚未接入时返回明确不可用状态；工作台和联系人页均禁用官方人物发送并保留草稿。自建联系人仍沿用用户配置的提示词。

聊天正文使用浏览器本机存储，读取失败阻止覆盖、保存失败可重试；这不代表已获得数据库或完成原生多窗口验证。Vite 静态构建产物本身不包含 API 服务器，Tauri 安装包仍需常驻服务接入与独立验收。云账号认证、Live2D、Pi 和工具执行尚未接入。DeepTutor 仅完成独立后端候选评估，没有安装、运行或接入。

当前操作见 [导航职责](../../docs/navigation-map.md)，设置范围见 [设置清单](../../docs/settings-map.md)，教育方向见 [个人自学规划](../../docs/self-learning-plan.md)。
