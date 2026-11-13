# 架构与 Agent 接入

更新日期：2026-11-08。状态：当前 React 界面与后续 Agent 实施基线；2026-11-12 起已有项目工具循环（见“项目工具（当前）”），独立 Agent 进程、子任务与自动路由尚未实现。产品约定见 [产品定义](product.md)，上游依据见 [研究](research/agent-products.md)；旧文档的模式划分以本文最新约定为准。

## 当前架构和缺口

当前 `src/main.ts` 通过 React `createRoot` 装配 `WorkspaceSettingsProvider`、`ConfiguredTheme` 和 `AgentChat`；根路径与 `/chat.html` 共用入口。`src/components/application/agent-chat` 管理工作台，`contacts` 管理联系人视图，`dashboard` 管理共享侧栏与账号入口，`settings` 管理本机设置。界面基于现有 BoardUI 组件与样式，构建仍使用 TypeScript、Vite、npm 和 Tauri 2 / Rust。

`ChatHistoryStore` 按会话 ID 合并保存浏览器聊天历史；联系人、群聊、本机资料和配置各有领域存储，当前草稿与流式状态属于页面。设置中的模型记录尚未绑定桌面执行层，Vite 开发 / 预览服务器的真实模型路由也不等于 Tauri 静态安装包已有常驻模型服务。设置页面边界见 [设置清单](settings-map.md)。

`src/app` 按 [领域目录](../src/app/README.md) 管理共享契约、状态和宿主桥接。历史直接 DOM 导航壳及 `WorkspaceStore` 位于 `src/app/legacy-shell`，只服务历史原型和兼容测试。当前工作台由 React 入口及对应领域所有者驱动。

工作台不提供模式选择，始终自动路由：执行前根据请求、选定项目、资料和授权决定聊天、学习或 Agent / Coding 路径，不扩大工具权限，也不在能力缺失时静默退回普通聊天。联系人单聊保留聊天 / 学习（自建联系人另有专业）模式。工作台输入框只提供权限模式（每次询问 / 自动接受编辑 / 仅计划 / 完全访问），与设置 → 权限规则共用 `src/app/settings/permission-modes.ts`。自动路由与学习执行尚未接入；权限模式在桌面应用的项目对话中决定工具调用是否需要审批（见下节），其他场景只保存，不授予权限。

### 项目工具（当前，2026-11-12）

- 归入项目的工作台对话每次请求带 `workspace: { root, name, permission }`（项目主要文件夹、名称与本对话权限模式，`src/app/agent/agent-request.ts`）；联系人对话不得携带。`chat-handler.ts` 只在运行时提供 `agent` 宿主时装配工具，即桌面应用（`src/platform/desktop-agent-host.ts`）；开发服务器没有宿主，系统提示说明无法访问电脑。运行时契约升为 `RUNTIME_CONTRACT = 2`。
- 工具（`src/app/agent/agent-tools.ts`）：`list_files`、`read_file`（每次 400 行）、`search_files`、`write_file`、`edit_file`（唯一匹配替换）、`run_command`、`update_plan`。循环使用 AI SDK `streamText` 的工具调用、`toolApproval` 与 `isStepCount(30)`；工具执行在窗口内的聊天运行时，文件与命令由 Rust 宿主完成（`agent_tools.rs`、`agent_command.rs`、`agent_diff.rs`），路径一律相对项目根目录并校验不越界。
- 权限：每次询问——读取直接进行，写入与命令需审批；自动接受编辑——写入直接进行，命令需审批；仅计划——只提供读取与计划工具，写入和命令即使被调用也拒绝；完全访问——全部直接进行。审批卡确认或拒绝后，`use-agent-run.ts` 在最后一条回复的审批都已回答时以同样的请求字段继续；拒绝结果作为工具结果交给模型。
- 每次写入前在 `<appData>/data/snapshots/` 保存原内容；改动卡的“撤销”只在文件仍是 Agent 写入后的内容时恢复，否则拒绝，避免覆盖他人的修改。命令在登录 shell 中运行，无输入，默认 120 秒、最多 600 秒超时，停止回复会结束其进程组，每路输出保留前 64 KB。
- 这是第 2 阶段的第一步：独立 Node.js Agent 进程、子任务、终端面板接入与自动路由仍按下文计划实施；当前工具循环不代表这些已完成。

### 代码高亮与长代码渲染（当前，2026-11-13）

- 高亮在 Web Worker 中进行：`src/app/chat/code-highlight.ts` 把文本发给 `code-highlight.worker.ts`，由 `code-highlight-engine.ts` 的单个 Shiki 高亮器（两套主题，语言按需加载）返回词元；没有 Worker 的环境（Node 测试）直接调用同一引擎。Vite 设 `worker.format = "es"`。
- 桌面 CSP 只允许 `script-src 'self'`，不能编译 WebAssembly；Shiki 的 Oniguruma 引擎启动失败时改用其 JavaScript 正则引擎（约慢 3.5 倍，但在 Worker 里不阻塞窗口）。没有为此放宽 CSP。
- 文件预览与差异（`tools/file-text.tsx`）先渲染 300 行，滚到末尾附近（IntersectionObserver，根为该滚动框，提前 800px）每次再加 600 行，上限仍为 20000 行；页面内查找只能找到已渲染的行。
- 流式回复时聊天 SDK 每次更新都浅拷贝消息的全部部件，`AgentToolCard` 按部件各字段是否相同做 memo，`FileText` / `DiffText` 也 memo，已完成的工具卡与其中的长差异不再随每个流式词重渲染。

### 网页批注进入对话与系统提示（当前，2026-11-13）

- 批注不再拼进用户正文：`useChatComposer().takeMessage(text)` 发出两个部件——用户输入（加目标 / 计划说明）的文本部件，和 `data-page-elements` 数据部件（`src/app/browser/page-element-part.ts`，最多 5 个元素，HTML 截到 1500 字符，不带计算样式）。批注随这次发送离开草稿，不再在之后每条消息里重复发送。
- 服务端 `convertToModelMessages` 的 `convertDataPart` 先用 `readPageElementsPart` 重新校验（仅 http(s)、标签名白名单、字段限长），再转成 `[网页标注 n/m]` 文本给模型；用户气泡下方用 `MessagePageElements` 显示批注列表，正文只显示用户输入。旧对话里已拼进正文的批注保持原样。
- 系统提示：工作台对话没有项目时加 `NO_PROJECT_PROMPT`（看不到文件、批注无法对应源码、不得猜路径或内容，需要代码时请用户选项目）；有项目时 `agentSystemPrompt` 要求先按批注的可见文字、aria-label、id 或特征 class 在项目里搜索并读到文件再说位置，搜不到直说，未读过的内容不凭记忆描述。联系人对话不加这两条。
- 批注本身只有网页 DOM，没有源码位置；给开发页面附加“文件:行”需要页面框架侧的支持，尚未实现。

### 对话轨迹（当前，2026-11-13）

- 记录：`chat-handler.ts` 为每次请求建一个 `createTraceRecorder()`（`src/app/agent/trace-recorder.ts`），经 `toUIMessageStream` 的 `messageMetadata` 读取流事件：`start-step` / `finish-step` 记步骤开始、结束、输入 / 输出 Token 与结束原因，`tool-call` 与 `tool-result` / `tool-error` / `tool-output-denied` 记工具调用与回答时间和结果。补丁写入回复的 `metadata.trace = { steps, tools }`，客户端深合并（对象合并、数组替换），所以两者都是以 ID 为键的对象；步骤键带本次请求的开始时间，审批后继续的请求写入同一回复也不冲突。`finish` 仍写用量元数据。随对话一起保存，没有单独存储。
- 投影：`src/app/agent/trajectory.ts` 的 `buildTrajectory(messages, messageAt)` 按 `step-start` 切分回复步骤，第 i 段对应 trace 中按开始时间排第 i 的步骤；模型耗时从步骤开始到步骤结束与首个工具调用中较早者；`readReplyTrace` 丢弃不完整的条目，旧回复没有 trace 时只出行。`filterRows`、`formatDuration`、`placeSegments`（压缩超过 5 秒的空档）供视图使用。界面在 `components/application/agent-chat/trajectory/`，由 `chat-conversation.tsx` 切换。

### 界面插件沙箱视图（当前，2026-11-13）

- 插件页面由 Rust 的 `nekopapa-plugin` 协议（`src-tauri/src/plugin_frame.rs`）只从前端允许过、清单 id 核对过的插件文件夹提供静态文件，每个响应带禁止联网、内联脚本、子框架和表单的 CSP；主窗口 CSP 只为该协议增加 `frame-src`。
- 页面在 `sandbox="allow-scripts"` 的 iframe 中运行，没有 Tauri invoke key（Tauri 只向主框架注入），只能经宿主交给它的 MessagePort 调用 `src/app/plugins/plugin-bridge.ts` 校验过的方法。详见 [插件扩展位](plugin-slots.md) 阶段 3。

联系人是产品中的人物与用户配置对象。自建联系人可配置专业提示词；官方人物提示词由 Java 管理，桌面只持有公开资料，不允许用户编辑，仅用于单人聊天与学习。选中聊天联系人不等于切换后端账号的常驻人物。当前官方聊天服务未接入，不能通过通用模型设置绕过限制，详见 [Java 人物服务](official-companion-service.md)。

项目未建立 Session SQLite 或 Agent 运行进程；桌面工具已有独立窗口与 Tauri 应用数据目录，模型密钥由系统钥匙串管理。账号已按现有 Java API 准备无默认网络 transport 的客户端适配，生产连接未启用，本轮未发真实账号请求。下面的运行桥接仍是计划，不能把浏览器存储或 `WorkspaceStore` 当 Agent 运行时，也不把执行引擎 SDK 放进 WebView。

## 云端服务接入评估（待确认）

账号契约与适配位于 `src/app/account/desktop-account-contract.ts`、`desktop-account-api.ts`，覆盖 Java 桌面扫码启动 / 轮询、账号资料和退出，并解析业务响应与扫码状态。默认实例不提供 transport，因此不会执行 HTTP；当前没有真实登录、原生凭据存储或已确认的产品服务地址。用户已明确要求后端重构期间暂不连接，不能用模拟账号或测试回执呈现登录成功。接口来源、后续接入缺口见 [Java 人物服务](official-companion-service.md)。

建议自定义 API 保持独立使用，官方云端作为主动选择的可选服务。公开客户端按不可信调用方设计：接口地址、客户端 ID 或随安装包分发的固定密钥均不能证明调用者可信；[RFC 8252 §8.5](https://www.rfc-editor.org/rfc/rfc8252#section-8.5) 明确指出原生客户端中的共享固定密钥不能作为保密凭据。用户凭据未来由宿主安全存储，公开云端只接受其授权范围内的短期用户凭证，不向客户端分发内部计费密钥或数据库权限。

建议的调用边界为 `NekoPapa → 独立公开入口 → 有限模型服务 → 私有计费接口`。是否复用身份、钱包和底层模型另行决定；只复用账号不等于共用产品额度、账单或通用后台权限。独立域名或网关本身不是防护完成条件，直接访问来源也必须受同等限制。

资源限制须由服务端执行：入口先验证令牌与产品权限，再按 IP / 账号限制请求频率、并发与输入规模；模型执行需设最大输出、超时和工具步骤，并以服务端实际额度作准入、预留、幂等结算和释放。配额查询应尽量使用受控的只读投影，拒绝的请求不能触发昂贵数据库事务。全局与单账号消费上限、熔断、注册赠送防滥用及必要监测另作服务端验收。上述资源与支出边界符合 [OWASP API4](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) 的建议，不能由 CORS、混淆或客户端开关代替。

2026-10-05 对同级 NekoBuddy 源码的只读核对发现，`NekoAppCommerceController.cloudPointLedger` 的 GET 查询先调用 `CommerceApplicationService.prepareCurrentSnapshot`，后者进入库存和云点准备事务；`AppCloudPointsService.prepare` 包含账号 / 钱包锁及初始化 / 月份更新。若用于公开桌面额度刷新，需要评估缓存、纯查询路径和资源限额。`CloudPointSnapshot` 的月配额字段目前返回零，余额与累计发放也不能替代产品的本期额度。此为接入评估依据，未审计线上网关、限流配置或部署环境，不据此认定现有服务存在可利用漏洞。

账号资料按 `GET /api/app/user/profile` 的实际字段适配；登录返回的普通资产不能代替云点，余额与累计发放也不能推算本期额度。真实连接、会话安全存储、云点账单和服务端防护均另作验收，不由现有客户端契约推定完成。

## 目标进程和模块

```text
主窗口 / Live2D 窗口 / Agent 工作区
                 │ 命令 + 快照 / 事件订阅
                 ▼
Tauri / Rust 宿主
  ├─ Workspace / Session / Run / Artifact 服务
  ├─ SQLite 数据、迁移、备份、凭据引用
  ├─ 运行调度、授权、事件提交与窗口生命周期
  └─ Agent 进程管理
                 │ 私有 stdin / stdout 协议
                 ▼
随应用分发的 Node.js Agent 进程
  ├─ 执行引擎适配层：Agent 会话、模型流与工具循环
  ├─ 工具配置：Coding、资料、网页等受控能力
  ├─ 学习编排 / 可选 DeepTutor worker 适配
  └─ 共享工具 / Workflow 执行服务（后续）
                 │
          模型 API / 已注册工具 / 可选 Python 学习服务
```

这是逻辑结构，不代表进程已经创建。Rust 是应用产品数据的唯一写入服务；执行引擎通过自己的 SessionManager 写其会话上下文，Rust 只写对应的产品元数据与可重建投影。普通聊天和学习产品记录由 Rust 管理，Node 不另存第二份权威 transcript。官方人物经 Java 执行的边界独立，不交给本地执行引擎 生成替代人设。

学习编排参考 DeepTutor 的资料版本、解释引用、题目、作答和反馈状态；需要其能力时才通过适配器启动或连接独立 Python worker / 服务，共用产品 Run、取消、事件和成果契约。首条短文本学习流程不强制安装整套 DeepTutor，不移植其 Next.js 前端，也不默认随桌面包携带完整 Python 依赖。资料和教学数据所有权、上游固定源码见 [DeepTutor 接入评估](deeptutor-integration.md)。

| 模块 | 责任 | 不承担的责任 |
| --- | --- | --- |
| 前端 Shell | 现有侧栏、标签、菜单、布局与内容路由 | 不直接启动命令或保存权威聊天 |
| 前端内容模块 | 普通消息、Coding 输出、页面编辑、草稿 | 不根据组件是否挂载取消运行 |
| Rust Session 服务 | 创建、读取、归档、删除至回收站、恢复、导出、迁移 | 不重建执行引擎的模型上下文算法 |
| Rust Run 服务 | 接受请求、状态机、授权、落盘后广播 | 不把收到请求直接标成完成 |
| Rust Process Manager | 启动、握手、健康状态、退出与崩溃处理 | 不无条件重发有副作用的任务 |
| 聊天 / 官方人物适配 | 普通对话、Java 官方人物调用、流式和记忆引用 | 不向官方人物开放用户编辑提示词或 Agent 工具 |
| 执行引擎适配层 | 通用与 Coding 的会话、工具配置、cwd、订阅、取消和投影 | 不维护第二份可写引擎历史，不把全部工具默认放开 |
| 学习编排 / worker 适配 | 资料证据、教学步骤、作答反馈及可选 DeepTutor 服务 | 不自行覆盖产品 Run 状态或用模型自评代替掌握证据 |
| Workflow 服务 | 版本化定义、节点输入输出、幂等与恢复 | 不与聊天工具另建一套授权执行器 |

## 技术决策及验证点

| 决策 | 状态与理由 | 通过条件 |
| --- | --- | --- |
| React + TypeScript + Tauri 2 / Rust | 当前入口，延续现有实现与 BoardUI 组件 | 保留导航与原生窗口回归 |
| 默认 Auto；Agent 统一通用任务与 Coding | 模式约定已确定；执行层待实现，优先共用执行引擎 SDK 并配置提示与工具 | 同一会话身份下执行受授权任务，不增加独立 Coding 顶级模式 |
| Agent 在独立 Node.js 进程 | 计划；SDK 需要 Node，进程不依赖前端标签 | RT-01 验证安装包无系统 Node 也可启动 |
| SDK 嵌入优先，官方 RPC 备选 | 计划；SDK 更适合 TypeScript 适配 | RT-02 验证订阅、恢复、资源加载与取消；备选保持同一应用协议 |
| Rust SQLite 单写服务 | 计划；产品对象需要事务、多窗口和查询 | DATA-01 验证迁移、错误与备份；不让多个窗口直接打开 DB |
| 产品记录在 SQLite，引擎上下文在原文件 | 计划；避免两份可写 Agent 模型上下文 | DATA-02 / CODE-02 验证关联、恢复和索引重建 |
| 本地优先，不依赖登录 | 产品首版范围 | 账号仍未接入时可配置自己的模型连接；本地数据不会被虚构账号覆盖 |

**执行引擎尚未选定。** 2026-11-10 按用户决定移除原 Pi 方案，后续另行评估执行引擎（候选的 Coding harness 尚未核查）。本文的适配层、会话文件与运行事件按引擎无关的契约描述；选定后在此记录版本、包名、Node 要求和许可证，并补充具体生命周期接口。

候选引擎需能整体替换 system prompt、自选工具与资源加载，以便同一执行层兼做通用任务与 Coding，不因引擎名称含 Coding 就另建一套框架。MCP、工具搜索等能力需显式装配，不能把命令行默认加载视为 SDK 已接通；网页检索、文档解析和产物导出仍需实现或接入受控工具。

Tauri 官方提供 [Node.js sidecar 示例](https://v2.tauri.app/learn/sidecar-nodejs/)和 [sidecar 分发说明](https://v2.tauri.app/develop/sidecar/)。本项目要验证的是包含执行引擎的真实依赖和资源，不把简单脚本打包成功当成 SDK 已可分发。候选方案为随包分发 Node 可执行文件、构建后的 JS 与必要资源；SEA / 单文件方案在扩展加载和资源兼容通过后再选。

## 侧栏与后端重构期间的实施顺序

侧栏建议保持工作台、联系人两个稳定入口，在其下增加“项目 → 会话”的收纳。项目可绑定本机目录、资料与模型偏好；最近会话仍以原 ID 打开，移动分组不创建副本。运行中、等待确认、失败是会话状态，产物进入项目内部；不再增加 Coding 顶级模式或重复的任务入口。无目录的资料整理也能属于项目，不能照搬参考模板而强制把所有项目叫作代码仓库。**这是待实现建议，当前侧栏尚无项目树。**

Java 重构期间优先完成三条可独立验收的本机流程，真实模型使用用户自己的配置；缺少配置时保留草稿并说明依赖，不生成样例结果：

1. **本机 runtime 与 Coding。** 安装包在没有全局 Node / 执行引擎 的机器启动随包进程；用户选择独立测试项目，提交修改要求，查看文件读取、改动与测试结果，允许或拒绝命令并可取消，重启后能按同一会话继续。先验收握手、凭据边界和会话恢复，再放开写入；失败保留已有改动与运行记录，不自动重跑外部动作。
2. **通用资料任务。** 复用已通过验收的 Coding 执行层与权限路径，用户选定资料、提出整理要求，Agent 读取授权范围并生成可打开的成果，保留来源与运行记录。拒绝文件访问、取消或导出失败时有明确状态和重试路径；无需切换到独立 Coding 模式，也不依赖官方账号。
3. **学习解释、题目、作答、反馈与笔记。** 先支持目标与短文本版本，显示有出处的解释，出一道题后等待学员独立作答，再保存对应题目 / 作答 ID 的反馈与笔记。评价失败重试不新增作答；资料更版保留原证据。DeepTutor worker 是后续能力适配，官方人物表达仍等待 Java 接通，不能将通用学习执行冒充官方人物服务。

上述为实施与验收顺序，当前尚未交付这些运行流程。每条均应覆盖成功、拒绝、取消、失败恢复和持久化证据，不能以按钮或进程启动单独宣布完成。

## 应用命令和事件契约

计划定义 `protocolVersion: 1`，在握手和每个 envelope 校验。Tauri 只暴露有类型、有输入校验的命令；不向 WebView 提供任意进程启动入口。Node stdout 只写协议帧，诊断写 stderr，字符串中的换行通过 JSON 转义。

| 消息 | 必需标识 | 语义 |
| --- | --- | --- |
| Command | `requestId`、`command`、`protocolVersion`；有对象时带 `sessionId` | 用户的操作请求，重复 requestId 查询原结果，不重新执行 |
| Accepted / Rejected | `requestId`；接受运行时带 `runId` | 只有应用输入事务提交后才接受；拒绝保留草稿并给出可处理错误 |
| Run Event | `eventId`、`sessionId`、`runId`、`seq`、`type`、`occurredAt`、`payload` | `seq` 是宿主提交的单 Session 连续序号；源事件另带 adapter 序号或引擎的 entry ID |
| Snapshot | `sessionId`、`asOfSeq`、`projectionVersion`、当前消息 / Run 摘要 | 反映同一提交水位，前端从下一序号接增量 |
| Approval Decision | `approvalId`、`runId`、`decision`、`expectedRevision` | 只对尚待确认的相同操作生效，重复或过期决定不能执行两次 |

命令集合首先覆盖 Session 创建 / 打开 / 改名 / 移动 / 归档 / 删除 / 恢复、Run 启动 / 取消、快照 / 历史分页 / 事件补取、布局与草稿。后续才加入记忆、Artifact、Workflow 和触发器命令。

事件首先覆盖 `run.started`、`message.delta`、`message.final`、`tool.started`、`tool.finished`、`approval.requested`、`run.cancelling`、`run.finished`、`run.interrupted`。大文件与长日志返回资源 ID、预览、长度及截断标记，正文分页读取，不把全部工具输出推入每个窗口。

运行状态的权威定义见 [会话文档](session-storage.md)。未知事件或较新的协议不能悄悄解释成完成；返回不兼容错误并保留记录。

## 一次输入如何闭环

1. 前端提交带 `requestId` 的输入、Session ID、模式、配置版本和选定项目 / 资料 ID。归档会话先恢复才能新发消息；Auto 先选定并记录执行路径，Agent 按目标加载通用或 Coding 工具，官方人物只接受聊天 / 学习。
2. Rust 校验会话、模式、并发与配置，事务保存用户消息、Run、配置快照和待分发记录，然后返回 Accepted。
3. Node 读取该 Run 的冻结输入，组装上下文并调用模型。它以同一 `runId` 返回流式、错误或工具事件。
4. Rust 去重、按序保存可恢复消息片段 / 事件与投影，然后广播。前端可合帧绘制，但“已保存”的反馈只对应持久化确认。
5. 单条消息结束更新 message；整个 Run 收敛后更新最终状态、活动时间和未读。后台会话完成不切换用户当前标签。
6. 连接中断后先拿快照和补取事件。若 Agent 进程已死亡，将 Run 标记 interrupted，保留已接受输入和回复片段；用户决定重试，不能自动生成第二条相同输入。

长请求用滑动窗口记录上下文预算，压缩摘要与原消息分开；不能为维持运行而删除可阅读的历史。具体流式持久化界限由 RT-03 / CHAT-03 的故障测试冻结。

M2 重试限最新一轮，当前答案修订与旧答案分别保存；上下文只采用当前已完成答案，重试不把旧答案再次喂入同一轮。规则见会话文档，不依靠 UI 隐藏旧消息实现。

## 执行引擎适配层的接入边界

以 `Map<sessionId, AgentSessionHandle>` 维护活跃实例。打开后台标签或改变侧栏分类仅查询，不调用引擎的新建 / 切换会话接口；一个会话不能被多个实例同时写。闲置实例可释放，下一次明确发送时从绑定文件重建。

创建必须显式传入 canonical cwd、应用独立的引擎配置 / 会话目录、会话管理、模型设置与受控资源加载器；不默认借用用户全局配置目录里的扩展、凭据和会话。导入外部会话文件时复制到应用管理区，原文件保持外部所有权。

先订阅事件再提交请求。以引擎的消息完成事件作为消息提交；不能把低层“Agent 结束”事件直接当作产品成功，需结合请求结果、停止意图和实际错误决定最终状态，无模型请求的扩展命令也要核对处理路径。请求停止后确认引擎空闲才结束取消；关闭标签不销毁实例。具体事件名在选定引擎后补充。

执行引擎自行保存模型上下文，应用 DB 保存请求意图、运行控制和展示投影。跨两个介质的恢复与对账在 [会话文档](session-storage.md)定义，不保证崩溃后所有模型或外部工具恰好执行一次。

同一个项目目录的写操作先串行化。移动 Coding 条目到另一产品分组只改变收纳；目录绑定保持原值。改工作目录须创建新 Coding 会话，选定摘要可引用过去会话，不能静默把旧上下文带到另一代码库。

## 调度、工具和授权

首版每个 Session 同时只允许一个活跃 Run，界面在生成中提供停止；不先实现隐式排队。不同 Session 的并发由宿主限制，M0 以两条受控测试 Run 验证隔离，实际默认值在性能验证后记录。

工具注册表声明工具名、输入输出 schema、读取 / 写入 / 外部动作、取消、幂等和所需资料范围。模型无法自行注册 Shell。执行引擎的 cwd 是路径基准，不是 OS 沙盒；扩展与引擎同进程运行，拥有相同系统权限，因此只加载审核过的扩展。宿主与引擎扩展必须落实产品授权，覆盖动态工具、MCP 和嵌套调用；工具 annotations 只是提示，未覆盖的路径禁止作为“受控模式”发布。

待确认记录包含实际操作、目标、参数摘要、输入 hash、策略版本和 Run ID。确认后由同一执行服务继续，两个窗口点确认通过 revision 拒绝第二次执行。已经授权的匹配范围可在本次运行复用；参数、目标或策略变化后重新判断。外部写入失败若结果不明，先核对结果，不自动再次执行。

普通工作流调用同一工具注册表、Run 服务、授权和成果存储，节点不能绕过聊天工具策略。技能、提示模板与可执行扩展分别登记，安装可执行扩展不等于只加载一段文字。

工作流执行必须指定其 Session 与能力范围，节点使用同一 Run；模型节点不再次调用用户输入的 Run 创建入口。周期配置持久化 targetSessionId，目标归档、失效或已有非终态 Run 时跳过并记录原因，不自动恢复归档、新建会话或叠加执行。

## 凭据和多窗口

本机数据文件夹（`src-tauri/src/app_data.rs`）位于系统应用数据目录，分为 `data/`（本机数据库 `workspace.sqlite`，目前存聊天记录，见 [本机数据模型](local-data-model.md)）、`files/`（附件与生成文件，预留）、`cache/`（可清理）和 `logs/`（预留）。前端只能按 `STORES` 白名单中的名称读写，不能传路径；聊天记录由 `chat_db.rs` 存入 SQLite：每次保存在一个事务中只重写内容有变化的会话，并同步重建消息文本行与 FTS5（trigram）全文索引；首次打开数据库时导入旧的 `data/chat-threads.json` 并将其改名为 `.migrated` 备份。快速搜索在桌面应用中经 `app_data_search` 查询全文索引。`src/platform/app-data-bridge.ts` 在渲染前读取文件并在首次启动时从 WebView 存储迁移，`app-data-storage.ts` 以同步 `Storage` 形态提供内存读取与按顺序写盘，聊天历史的读取门禁、重试与跨入口处理保持不变；读取失败时历史不可写，写盘失败显示为聊天历史错误。浏览器预览不安装文件存储，继续使用 localStorage。

模型配置存储 provider、base URL、model ID、credentialRef 和能力信息；密钥由 Rust 的系统凭据适配器管理，首个目标为 macOS Keychain，其他平台另验收。Node 只获得当次所需凭据，前端显示连接状态与遮罩值；日志、导出和 localStorage 不存明文密钥。

每个窗口首次订阅获取同一快照，再接收增量。读水位缺口时补取或重新取快照；前端不各自计算 Run 状态。Live2D 只观察选定会话 / Run 和展示偏好，不读完整个人历史；工作区对多个运行按需查询。窗口间命令返回同一对象身份。

宿主关闭时停止接受输入，撤销未执行的确认，通知 Agent 取消并等待落盘；超时强制结束进程须记录 interrupted，启动后显示恢复入口。Node 意外退出影响活跃 Run，不影响数据库中已有消息与导航。

## 计划目录与代码拆分

以下为后续新增模块的位置建议，**新增运行模块当前尚不存在**；复用已有 React 组件与领域模块，不为了计划先创建空目录。

```text
src/
  app/                         # 保留现有导航，不一次性重写
  desktop/                     # 类型化 IPC、订阅、快照和窗口桥接
  features/chat/               # 普通消息与输入
  features/agent/              # 通用与 Coding 的工具过程、变更和输出
  features/learning/           # 资料、题目、作答、反馈与笔记
  features/companion/          # Live2D 与角色反馈
  features/artifacts/          # 页面编辑
  shared/contracts/            # 协议与领域 DTO
agent-runtime/
  src/chat/                    # 普通聊天与 Java 官方人物适配
  src/engine/                  # 统一 Agent 的执行引擎适配层与扩展
  src/learning/                # 教学编排与可选 DeepTutor worker 适配
  src/tools/                   # Coding、资料与网页工具执行
  src/workflows/               # 节点执行
src-tauri/src/
  storage/                     # SQLite、迁移与备份
  services/                    # Workspace、Session、Run、Artifact
  agent_process/               # Agent 进程启动与协议
  credentials/                 # 系统凭据
  windows/                     # 三种窗口生命周期
tests/
  contracts/ storage/ runtime/ # 未来测试，与现有测试并存
```

构建把 `agent-runtime` 与前端隔开，执行引擎及 Node 模块不能进入 Vite WebView bundle。新增包管理、构建命令及资源路径在 M0 验证后写回 README。

代码拆分遵循 [仓库迭代约定](../AGENTS.md)。2026-10-04 顶部栏迭代已将原 900 行控制器、777 行状态模块和 960 行工作台测试按职责拆分；该轮结束时控制器为 355 行、领域状态为 438 行，原有 71 项测试完整保留，新增场景后共 85 项。此为历史整理记录，当前行数与测试数量以本轮检查为准。菜单弹窗、内容动作、类型、存储和迁移已有独立模块，测试按行为拆分。新增模块仍默认 500 行档，不向控制器集中 Agent 或存储逻辑。

## 升级与回退

协议、DB schema、普通消息格式、执行引擎 SDK / 原文件格式与投影版本分别记录，不共用一个 app version 代替。宿主握手拒绝不兼容 Agent 包。Schema 迁移失败不覆盖旧库；应用版本回退时不能用旧 writer 打开新 schema，先导出或恢复独立备份。

执行引擎升级需用固定样例覆盖通用与 Coding 会话历史、分支、压缩、错误、取消、扩展与文件恢复；结果不通过时保留旧锁定版本及资源，不在用户已有会话上试升级。

对应任务见 [开发清单](iteration-backlog.md)，故障、事件和原生包验收见 [验收与交付](acceptance.md)。
