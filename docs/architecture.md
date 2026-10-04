# 架构与 Agent 接入

更新日期：2026-10-04。状态：提议的实施基线，尚未实现。产品约定见 [产品定义](product.md)，上游依据见 [研究](research/agent-products.md)。

## 当前架构和缺口

当前 `src/main.ts` 装配前端，`src/app/state.ts` 管理导航领域操作，`workspace-storage.ts` 处理 localStorage 读写与恢复，`workspace-migration.ts` 处理旧示例清理。`view.ts` 组装外壳，`sidebar-view.ts` / `sidebar.css` 管理内侧栏呈现，`sidebar-model.ts` 从已有记录派生工作台快捷索引与普通对话分区；`chrome.ts` 管理顶部栏及详情。`controller.ts` 协调事件，`content-actions.ts` 和 `overlays.ts` 分别处理内容动作与菜单弹窗。活动、搜索、拖动和动效分别有模块。Rust 的 `src-tauri/src/lib.rs` 只启动 Tauri，capability 目前仅覆盖主窗口基础能力、拖动和缩放。

当前模块已实现导航壳；下面的 Agent 目标架构仍是计划。详情开合与完整视图由窗口内临时 `ShellPresentation` 管理，不改写保存的侧栏偏好。详情从当前真实对象派生，不保存第二份内容数据或模拟执行信息。

产品功能目录由 `feature-model.ts` 定义，`feature-view.ts` 渲染外栏及用途说明，`feature-actions.ts` 协调预设与固定操作，样式由 `features.css` 管理。固定 ID 属于 `WorkspaceStore` 的导航偏好，由原存储模块校验并保存。预设不建立内容对象；角色和会话活动复用现有操作入口，其余能力等实际服务接入后再启用。

正式角色目录及按角色查找普通会话由 `companion-model.ts` 管理，`companion-view.ts` / `companion.css` 呈现共享头像及选择 / 继续两个入口，`companion-actions.ts` 使用现有菜单处理选择。当前选择属于 `WorkspaceStore.selectedCompanionId` 偏好，由 `workspace-storage.ts` 校验恢复；每条普通会话拥有独立的 `companionId`。选择角色不修改已有会话，创建表单记录打开时的角色，搜索与功能预设调用同一控制器路径。目录中的名字与头像是产品资源，不是预置会话或运行状态。

项目未建立数据库、Agent 进程、模型连接、密钥存储、多窗口或真实 Session 服务。计划中的桥接不能直接把现有 `WorkspaceStore` 当 Agent 运行时，也不把 SDK 放进 WebView。

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
  ├─ Companion Agent：自研上下文、模型流与工具循环
  ├─ Pi Adapter：每个 Coding Session 的 Pi SDK 实例
  └─ 普通工具 / Workflow 执行服务（后续）
                 │
          模型 API / 已注册工具
```

这是逻辑结构，不代表进程已经创建。Rust 是应用数据的唯一写入服务，Node 不另写普通 transcript。Pi 通过自己的 SessionManager 写 Coding 文件；Rust 只写产品元数据与可重建投影。

| 模块 | 责任 | 不承担的责任 |
| --- | --- | --- |
| 前端 Shell | 现有侧栏、标签、菜单、布局与内容路由 | 不直接启动命令或保存权威聊天 |
| 前端内容模块 | 普通消息、Coding 输出、页面编辑、草稿 | 不根据组件是否挂载取消运行 |
| Rust Session 服务 | 创建、读取、归档、恢复、导出、迁移 | 不重建 Pi 模型上下文算法 |
| Rust Run 服务 | 接受请求、状态机、授权、落盘后广播 | 不把收到请求直接标成完成 |
| Rust Process Manager | 启动、握手、健康状态、退出与崩溃处理 | 不无条件重发有副作用的任务 |
| Companion Agent | 角色上下文、普通模型、流式、记忆引用与工具 | 不默认获得 Coding Shell 能力 |
| Pi Adapter | Pi 生命周期、cwd、订阅、取消和投影 | 不维护独立可写 Coding 历史 |
| Workflow 服务 | 版本化定义、节点输入输出、幂等与恢复 | 不与聊天工具另建一套授权执行器 |

## 技术决策及验证点

| 决策 | 状态与理由 | 通过条件 |
| --- | --- | --- |
| TypeScript + Tauri 2 / Rust | 已确定，延续现有实现 | 保留导航与原生窗口回归 |
| 普通模式自研、Coding 集成 Pi | 已确定产品路线 | 两种会话各自管理上下文与工具 |
| Agent 在独立 Node.js 进程 | 计划；SDK 需要 Node，进程不依赖前端标签 | RT-01 验证安装包无系统 Node 也可启动 |
| SDK 嵌入优先，官方 RPC 备选 | 计划；SDK 更适合 TypeScript 适配 | RT-02 验证订阅、恢复、资源加载与取消；备选保持同一应用协议 |
| Rust SQLite 单写服务 | 计划；产品对象需要事务、多窗口和查询 | DATA-01 验证迁移、错误与备份；不让多个窗口直接打开 DB |
| 普通历史在 SQLite，Pi 历史在原文件 | 计划；避免两份可写 Coding 历史 | DATA-02 / PI-02 验证关联、恢复和索引重建 |
| 本地优先，不依赖登录 | 产品首版范围 | 账号仍未接入时可配置自己的模型连接；本地数据不会被虚构账号覆盖 |

Pi 研究 commit 的 SDK 源码为 `1.0.1`，最低 Node ≥22.19；当前项目 `engines` 仍允许 Node 20。M0 先验证受支持的 Node LTS 与实际 npm 制品，再锁定 Agent 包、前端开发环境及分发 runtime，不在文档阶段改版本。依据：[固定包定义](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/package.json)。

Tauri 官方提供 [Node.js sidecar 示例](https://v2.tauri.app/learn/sidecar-nodejs/)和 [sidecar 分发说明](https://v2.tauri.app/develop/sidecar/)。本项目要验证的是包含 Pi 的真实依赖和资源，不把简单脚本打包成功当成 SDK 已可分发。候选方案为随包分发 Node 可执行文件、构建后的 JS 与必要资源；SEA / 单文件方案在扩展加载和资源兼容通过后再选。

## 应用命令和事件契约

计划定义 `protocolVersion: 1`，在握手和每个 envelope 校验。Tauri 只暴露有类型、有输入校验的命令；不向 WebView 提供任意进程启动入口。Node stdout 只写协议帧，诊断写 stderr，字符串中的换行通过 JSON 转义。

| 消息 | 必需标识 | 语义 |
| --- | --- | --- |
| Command | `requestId`、`command`、`protocolVersion`；有对象时带 `sessionId` | 用户的操作请求，重复 requestId 查询原结果，不重新执行 |
| Accepted / Rejected | `requestId`；接受运行时带 `runId` | 只有应用输入事务提交后才接受；拒绝保留草稿并给出可处理错误 |
| Run Event | `eventId`、`sessionId`、`runId`、`seq`、`type`、`occurredAt`、`payload` | `seq` 是宿主提交的单 Session 连续序号；源事件另带 adapter 序号或 Pi entry ID |
| Snapshot | `sessionId`、`asOfSeq`、`projectionVersion`、当前消息 / Run 摘要 | 反映同一提交水位，前端从下一序号接增量 |
| Approval Decision | `approvalId`、`runId`、`decision`、`expectedRevision` | 只对尚待确认的相同操作生效，重复或过期决定不能执行两次 |

命令集合首先覆盖 Session 创建 / 打开 / 改名 / 移动 / 归档 / 恢复、Run 启动 / 取消、快照 / 历史分页 / 事件补取、布局与草稿。后续才加入记忆、Artifact、Workflow 和触发器命令。

事件首先覆盖 `run.started`、`message.delta`、`message.final`、`tool.started`、`tool.finished`、`approval.requested`、`run.cancelling`、`run.finished`、`run.interrupted`。大文件与长日志返回资源 ID、预览、长度及截断标记，正文分页读取，不把全部工具输出推入每个窗口。

运行状态的权威定义见 [会话文档](session-storage.md)。未知事件或较新的协议不能悄悄解释成完成；返回不兼容错误并保留记录。

## 一次普通输入如何闭环

1. 前端提交带 `requestId` 的输入、Session ID、配置版本和选定资料 ID。归档会话先恢复才能新发消息；普通模式不能选择 Coding 执行器。
2. Rust 校验会话、模式、并发与配置，事务保存用户消息、Run、配置快照和待分发记录，然后返回 Accepted。
3. Node 读取该 Run 的冻结输入，组装上下文并调用模型。它以同一 `runId` 返回流式、错误或工具事件。
4. Rust 去重、按序保存可恢复消息片段 / 事件与投影，然后广播。前端可合帧绘制，但“已保存”的反馈只对应持久化确认。
5. 单条消息结束更新 message；整个 Run 收敛后更新最终状态、活动时间和未读。后台会话完成不切换用户当前标签。
6. 连接中断后先拿快照和补取事件。若 Agent 进程已死亡，将 Run 标记 interrupted，保留已接受输入和回复片段；用户决定重试，不能自动生成第二条相同输入。

长请求用滑动窗口记录上下文预算，压缩摘要与原消息分开；不能为维持运行而删除可阅读的历史。具体流式持久化界限由 RT-03 / CHAT-03 的故障测试冻结。

M2 重试限最新一轮，当前答案修订与旧答案分别保存；上下文只采用当前已完成答案，重试不把旧答案再次喂入同一轮。规则见会话文档，不依靠 UI 隐藏旧消息实现。

## Pi Adapter 的接入边界

以 `Map<sessionId, AgentSessionHandle>` 维护活跃实例。打开后台标签或改变侧栏分类仅查询，不调用 Pi 的 newSession / switchSession；一个会话不能被多个实例同时写。闲置实例可释放，下一次明确发送时从绑定文件重建。

创建必须显式传入 canonical cwd、应用独立的 Pi agentDir / sessionDir、SessionManager、模型设置与受控资源加载器；不默认借用用户全局 `~/.pi` 里的扩展、凭据和会话。导入外部 Pi 文件时复制到应用管理区，原文件保持外部所有权。

先订阅再 `prompt()`。适配 `message_end` 为消息提交；不能将低层 `agent_end` 当作产品成功。当前版本需结合 `agent_settled`、`prompt()` 结果、停止意图和实际错误决定最终状态；无模型请求的扩展命令也要核对 handled 路径。调用 `abort()` 后确认 idle 才结束取消；关闭标签不调用 `dispose()`。[SDK 生命周期依据](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/docs/sdk.md)。

Pi 自行保存模型上下文，应用 DB 保存请求意图、运行控制和展示投影。跨两个介质的恢复与对账在 [会话文档](session-storage.md)定义，不保证崩溃后所有模型或外部工具恰好执行一次。

同一个项目目录的写操作先串行化。移动 Coding 条目到另一产品分组只改变收纳；目录绑定保持原值。改工作目录须创建新 Coding 会话，选定摘要可引用过去会话，不能静默把旧上下文带到另一代码库。

## 调度、工具和授权

首版每个 Session 同时只允许一个活跃 Run，界面在生成中提供停止；不先实现隐式排队。不同 Session 的并发由宿主限制，M0 以两条受控测试 Run 验证隔离，实际默认值在性能验证后记录。

工具注册表声明工具名、输入输出 schema、读取 / 写入 / 外部动作、取消、幂等和所需资料范围。普通模型无法自行注册 Shell。Pi 的 cwd 是路径基准，不是 OS 沙盒；宿主与 Pi 扩展必须落实产品授权，包括动态工具加载后的检查，未覆盖的路径禁止作为“受控模式”发布。

待确认记录包含实际操作、目标、参数摘要、输入 hash、策略版本和 Run ID。确认后由同一执行服务继续，两个窗口点确认通过 revision 拒绝第二次执行。已经授权的匹配范围可在本次运行复用；参数、目标或策略变化后重新判断。外部写入失败若结果不明，先核对结果，不自动再次执行。

普通工作流调用同一工具注册表、Run 服务、授权和成果存储，节点不能绕过聊天工具策略。技能、提示模板与可执行扩展分别登记，安装可执行扩展不等于只加载一段文字。

工作流执行必须指定普通 Session，节点使用同一 Run；模型节点不再次调用用户输入的 Run 创建入口。周期配置持久化 targetSessionId，目标归档、失效或已有非终态 Run 时跳过并记录原因，不自动恢复归档、新建会话或叠加执行。

## 凭据和多窗口

模型配置存储 provider、base URL、model ID、credentialRef 和能力信息；密钥由 Rust 的系统凭据适配器管理，首个目标为 macOS Keychain，其他平台另验收。Node 只获得当次所需凭据，前端显示连接状态与遮罩值；日志、导出和 localStorage 不存明文密钥。

每个窗口首次订阅获取同一快照，再接收增量。读水位缺口时补取或重新取快照；前端不各自计算 Run 状态。Live2D 只观察选定会话 / Run 和展示偏好，不读完整个人历史；工作区对多个运行按需查询。窗口间命令返回同一对象身份。

宿主关闭时停止接受输入，撤销未执行的确认，通知 Agent 取消并等待落盘；超时强制结束进程须记录 interrupted，启动后显示恢复入口。Node 意外退出影响活跃 Run，不影响数据库中已有消息与导航。

## 计划目录与代码拆分

以下路径是后续开发位置，**当前尚不存在**；不为了计划先创建空模块。

```text
src/
  app/                         # 保留现有导航，不一次性重写
  desktop/                     # 类型化 IPC、订阅、快照和窗口桥接
  features/chat/               # 普通消息与输入
  features/coding/             # Pi 展示、变更与输出
  features/companion/          # Live2D 与角色反馈
  features/artifacts/          # 页面编辑
  shared/contracts/            # 协议与领域 DTO
agent-runtime/
  src/companion/               # 自研普通 Agent
  src/pi/                      # Pi Adapter 与扩展
  src/tools/                   # 普通工具执行
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

构建把 `agent-runtime` 与前端隔开，Pi 及 Node 模块不能进入 Vite WebView bundle。新增包管理、构建命令及资源路径在 M0 验证后写回 README。

代码拆分遵循 [仓库迭代约定](../AGENTS.md)。2026-10-04 顶部栏迭代已将原 900 行控制器、777 行状态模块和 960 行工作台测试按职责拆分。控制器现为 355 行、领域状态为 438 行；原有 71 项测试完整保留，新增顶部栏与旧示例迁移场景后共 85 项。菜单弹窗、内容动作、类型、存储和迁移已有独立模块，测试按导航、标签、内容、归档、持久化、迁移与排序拆分。新增模块仍默认 500 行档，不向控制器集中 Agent 或存储逻辑。

## 升级与回退

协议、DB schema、普通消息格式、Pi SDK / 原文件格式与投影版本分别记录，不共用一个 app version 代替。宿主握手拒绝不兼容 Agent 包。Schema 迁移失败不覆盖旧库；应用版本回退时不能用旧 writer 打开新 schema，先导出或恢复独立备份。

Pi 升级需用固定样例覆盖普通 Coding 历史、分支、压缩、错误、取消、扩展与文件恢复；结果不通过时保留旧锁定版本及资源，不在用户已有会话上试升级。

对应任务见 [开发清单](iteration-backlog.md)，故障、事件和原生包验收见 [验收与交付](acceptance.md)。
