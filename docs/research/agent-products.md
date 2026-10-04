# Agent 产品与 Session 管理研究

核对日期：2026-10-04。方法：阅读官方产品文档、官方仓库文档及会话相关源码；没有安装或运行这些竞品，也没有读取它们的用户私有数据。功能描述限于所列来源，不能据此推断未公开的内部数据库或协议。

用户提到的 `deepseekhernes` 本轮按 **DeepSeek Harness** 理解，同时补充 **Hermes Agent**。两者是不同项目，不把 DeepSeek 模型、DeepSeek Harness 与 Hermes 混作一个实现。

## 调研快照

以下 commit 是调研时读取的源码基线，避免之后的 `main` / `master` 更新改变结论。版本号取自该 commit 的源码，不代表 NekoPapa 已安装或验证对应 npm 制品。

| 产品 | 官方入口 / 源码快照 | 本轮可核对的范围 |
| --- | --- | --- |
| ZCode | [官方文档](https://zcode.z.ai/en/docs/welcome) | 桌面任务、分组、工作区、归档、文件引用与自动化；内部存储格式未核实 |
| Kimi Code | [MoonshotAI/kimi-code · 21406fb4](https://github.com/MoonshotAI/kimi-code/tree/21406fb4c805cc8c715e6d1f16ad3fb5f25f4fe3) | 当前 TypeScript 实现；CLI 源码版本 2.1.1、会话目录、回放和导出 |
| Pi | [earendil-works/pi · 76dfb88f](https://github.com/earendil-works/pi/tree/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121) | SDK 源码版本 1.0.1、会话树、运行生命周期、SDK 与 RPC |
| Notion | [官方帮助中心](https://www.notion.com/help) | 侧栏、Agent、页面与 Custom Agent 产品行为；内部落盘格式未公开核实 |
| DeepSeek Harness | [deepseek-ai/deepseek-harness · 5badb150](https://github.com/deepseek-ai/deepseek-harness/tree/5badb15009ae1756c3afe0ae0cef1faafc290ccc) | CLI 源码版本 0.2.1-alpha.1；插件、会话事件持久化与状态投影 |
| Hermes Agent | [NousResearch/hermes-agent · 158fd638](https://github.com/NousResearch/hermes-agent/tree/158fd638da1629c8e62caf9ade1515d162def8ab) | SQLite 会话权威、搜索、归档、回放与导出 |

## 功能和管理方式对照

| 产品 | 主要功能组织 | Session 管理中值得采用的部分 | 本项目的取舍 |
| --- | --- | --- | --- |
| ZCode | 工作区内持续处理编码任务，提供任务与文件查找 | 分组 / 工作区 / 时间线是同一批任务的不同索引；归档可恢复；运行记录能回到会话 | 借鉴收纳与定位，保留自己的双层侧栏；先不做远程控制和完整 ADE |
| Kimi Code | CLI / 客户端围绕持久会话工作 | 每个会话目录独立，回放事件、元数据、子 Agent、日志与任务各有位置 | 借鉴会话资源归属与恢复，暂不集成第二个 Coding 核心 |
| Pi | 可嵌入、可扩展的 Coding harness | 同一 JSONL 内保存树与分支，使用 SessionManager 继续上下文 | 直接用于 Coding；产品管理与 Pi 上下文权威分开 |
| Notion | 页面、资料与 Agent 在工作台中关联 | 分类侧栏、内容视图、聊天、运行 Activity、配置分别组织 | 借鉴内容与成果身份；先做简单页面，后置完整数据库和团队权限 |
| DeepSeek Harness | Cordis 插件组织模型、工具、会话和界面 | 持久日志、读模型与界面分离，单写者、序号和恢复契约明确 | 借鉴事件与恢复边界；普通 Agent 从最小自研实现开始 |
| Hermes | 持续 Agent、跨会话检索与多入口 | 数据库为权威，检索与导出是读能力，历史与当前上下文分别保留 | 借鉴本地索引、记忆来源和导出范围；不引入完整网关体系 |

上表的采用与取舍是 NekoPapa 的设计判断，产品事实的具体依据如下。

## ZCode：任务列表和项目文件属于两种管理对象

官方任务文档提供 Grouped、Workspace、Timeline 三种任务视图，以及创建 / 更新时间排序、拖动、归档、恢复和独立删除。文件树可以查看 Git 状态、预览文件并引用到聊天。自动化定义有自己的运行历史，可以跳回相应会话；重复点击不会启动上一轮尚未结束的任务。[任务与文件管理](https://zcode.z.ai/en/docs/task-management)、[自动化](https://zcode.z.ai/en/docs/automations)。

采用：分组、活动时间、打开标签只是同一 Session 的不同入口；项目目录的文件树与应用会话列表分开。第一版保留人工归档，不直接复制按时间自动归档或删除的策略。

未核实：ZCode 自有会话实际文件位置、内部 JSONL / SQLite schema、存储事务及官方 SDK 接入契约。没有用同名第三方仓库替代官方实现证据。

## Kimi Code：以当前目录和 Wire 回放为准

当前官方文档与源码布局为：

```text
~/.kimi-code/                         # 可由 KIMI_CODE_HOME 指定
├── session_index.jsonl               # 会话定位索引
└── sessions/<workDirKey>/<sessionId>/
    ├── state.json                    # 标题、时间、来源等元数据
    ├── agents/main/wire.jsonl         # 主 Agent 事件与请求记录
    ├── agents/<subagentId>/wire.jsonl # 各 Agent 的独立记录
    ├── tasks/                        # 后台任务状态与输出
    ├── cron/                         # 调度记录
    └── logs/                         # 会话诊断
```

工作目录 bucket 使用可读 slug 与 SHA-256 部分值；不是会话身份。当前文档说明可恢复、压缩、fork 和导出；fork 保留来源但不复制已保存的 goal。ZIP 诊断导出默认还包含全局日志，可以明确排除。[数据位置](https://github.com/MoonshotAI/kimi-code/blob/21406fb4c805cc8c715e6d1f16ad3fb5f25f4fe3/docs/en/configuration/data-locations.md)、[会话指南](https://github.com/MoonshotAI/kimi-code/blob/21406fb4c805cc8c715e6d1f16ad3fb5f25f4fe3/docs/en/guides/sessions.md)。

阅读实现入口：[sessionManager](https://github.com/MoonshotAI/kimi-code/blob/21406fb4c805cc8c715e6d1f16ad3fb5f25f4fe3/packages/agent-core-v2/src/app/sessionManager/sessionManager.ts)、[sessionIndex](https://github.com/MoonshotAI/kimi-code/blob/21406fb4c805cc8c715e6d1f16ad3fb5f25f4fe3/packages/agent-core-v2/src/app/sessionIndex/sessionIndex.ts)、[contextProjector](https://github.com/MoonshotAI/kimi-code/blob/21406fb4c805cc8c715e6d1f16ad3fb5f25f4fe3/packages/agent-core-v2/src/agent/contextProjector/contextProjector.ts)。这些入口分开承担会话定位与上下文重建。

采用：稳定 ID、会话资源隔离、完整回放与模型上下文分开。我们的导出默认限当前对象，诊断包需单独选，避免把其他会话日志混入。早期 `kimi-cli` 文档中的 `~/.kimi/`、`context.jsonl` 与当前版本不同，不能照旧路径设计新集成。

## Pi：Coding 历史权威和会话树

Pi 的当前入口是 [pi.dev](https://pi.dev/)，仓库为 `earendil-works/pi`。SDK 可在 Node.js / Bun 中嵌入 AgentSession，管理模型、工具、会话和资源；CLI 另有 JSON / RPC 方式。源码包 `@earendil-works/pi-coding-agent` 在调研 commit 为 `1.0.1`，`engines.node` 为 `>=22.19.0`。[SDK](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/docs/sdk.md)、[包定义](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/package.json)。

默认文件：

```text
~/.pi/agent/sessions/--<encoded-cwd>--/<timestamp>_<session-id>.jsonl
```

会话 header 记录 ID、版本和 cwd；条目用 `id / parentId` 表达树。分支切换改变活动叶子，压缩影响模型上下文，原历史仍可保留。SDK 的 SessionManager 可明确指定会话目录或打开已有文件。[Session Format](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/docs/session-format.md)、[SessionManager 源码](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/src/core/session-manager.ts)。

运行接入特别需要核对：`message_end` 是单条消息结束，`agent_end` 后可能继续重试或排队任务；当前 SDK 的 `agent_settled` 表示自动后续已收敛。`abort()` 等待回到空闲；`dispose()` 会终止活动工作，不能在关闭标签时调用。切换 AgentSession 后需要重绑订阅。[运行生命周期源码](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/src/core/agent-session.ts)。

采用：SDK 嵌入为首选、官方 RPC 为验证失败后的备选；Pi 写 Coding 历史，NekoPapa 保存归属、运行记录和可重建展示索引。当前项目未安装 SDK，必须在 M0 验证二进制分发、依赖资源、错误、取消及结束事件。

## Notion：成果、会话、运行与配置分别管理

官方侧栏将 Home、AI 对话、会议、Inbox 等分开，每类有自己的列表和底部创建入口；收藏、折叠、拖动和显示数量用来控制密度。AI 历史可以继续并显示未读，页面是独立的长期内容。[侧栏导航](https://www.notion.com/help/navigate-with-the-sidebar)。

Notion Agent 可以基于有权访问的资料创建和编辑页面 / 数据库。Custom Agent 将聊天、运行活动和配置分开，支持明确的触发与周期任务，以及配置版本恢复。[Notion Agent](https://www.notion.com/help/notion-agent)、[Custom Agents](https://www.notion.com/help/custom-agents)。

采用：会话表达交流，Run 表达执行，页面表达可继续编辑的成果。工作流复制时只复制定义和可访问引用，运行记录重新开始。账号、权限、配置、内容视图不塞到同一个品牌下拉菜单。

未核实：Notion 内部 Session 序列化、桌面缓存、服务端存储 schema 和私有运行 API。NekoPapa 的本地 SQLite / 文件方案是自身提议，不称作 Notion 的实现方式。Notion 的页面 Trash 与我们优先使用会话归档的语义不同，不直接套用。

## DeepSeek Harness：持久化和界面投影分开

官方将模型、工具、会话、存储、循环和 UI 做成 Cordis 插件；产品仍为开发者预览，接口会演进。[官方介绍](https://deepseek.com/harness/en/)。

会话日志通过 Persistence Handle 读写，区分 append 接受与 flush 持久化，维护单写者和连续事件序号。JSONL 后端使用独立会话目录，可压缩并保留历史格式代际；恢复完整有效记录，不把中断的一整轮历史截掉。[持久化契约](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/subsystems/persistence.md)、[JSONL 后端](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/session/session-persistence-jsonl/README.md)。

其 Projection 由宿主处理已提交事件，再向客户端提供带水位的读模型；缓存不替代权威日志。[Session Projections](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/subsystems/session-projection.md)。

采用：持久化确认、事件序号、快照加增量和可恢复投影。不直接搬入插件框架和所有功能，也不把普通 Agent 改成另一套 Coding harness。存储格式版本看 [状态说明](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/session-format-status.md)，不把某个示例路径里的旧版本当作永远的当前格式。

## Hermes Agent：数据库是会话权威，JSONL 可以是导出

当前 Hermes 以 home / profile 下的 `state.db` 保存会话、消息和相关状态，SQLite WAL 支持并发读取，FTS 支持跨会话检索；旧 JSONL 不再是主要权威。网关 `sessions.json` 是路由兼容镜像，不是会话全文列表。[存储设计](https://github.com/NousResearch/hermes-agent/blob/158fd638da1629c8e62caf9ade1515d162def8ab/website/docs/developer-guide/session-storage.md)。

会话管理提供查找、归档、导出与清理。备份可含已压缩或撤回的历史，而可阅读分享格式有不同范围；导出与删除需明确区分。[会话管理](https://github.com/NousResearch/hermes-agent/blob/158fd638da1629c8e62caf9ade1515d162def8ab/website/docs/user-guide/sessions.md)。

采用：SQLite 管普通消息与产品元数据，导出格式和当前模型上下文分别定义；中文搜索在真实语料上验证。不会复制自动保留期清理或网关架构，初期不自动物理删除用户会话。

## 对 NekoPapa 的实施结论

以下为研究后的项目提议，技术验证通过前保持“计划”状态。

| 决策 | 对应任务 | 原因与影响 |
| --- | --- | --- |
| 保留一个 Coding 核心：Pi | RT-02、PI-01–PI-04 | 用户路线已确定；其余 Coding 产品用于借鉴，不同时嵌入 |
| Rust 拥有应用数据库，Node.js 运行两种 Agent | RT-01、RT-03、DATA-01 | 数据不依赖 WebView 生命周期；客户端不直接操作 SDK 或密钥 |
| 普通会话权威在 SQLite；Coding 历史权威在 Pi | DATA-02、PI-02 | 不维护两份可写 Coding transcript；产品元数据必须独立备份 |
| Session、Run、View、Memory、Artifact 分开 | DATA-02、CHAT-02、DESK-02、FLOW-01 | 关闭、归档、取消、压缩与成果保存不能互相替代 |
| 输入请求、运行事件与持久化确认有 ID 和序号 | RT-03、DATA-03 | 重连、多窗口、重试和崩溃恢复不会重复创建输入或假完成 |
| 迁移先备份且保持已有内容 ID | DATA-04 | 当前索引还没有正文；不能丢导航，也不能生成假聊天 |
| 导出默认限单个对象，备份与分享各有范围 | DATA-05、PI-04 | 全局诊断、密钥、隐藏分支及工具输出不能默默混入分享 |
| 先一个可用工作流，再扩展触发器 | FLOW-02、AUTO-01 | 先证明真实结果、取消和幂等，再做模板与定时管理 |

## 仍需接入实验回答的问题

- Pi SDK 的实际 npm 制品、Node.js 版本、动态扩展与资源能否随 `.app` 一起运行，安装后的机器没有系统 Node 时是否可用。
- SDK 运行结束、重试、停止和请求关联在固定版本上的具体顺序；跨数据库与 Pi 文件中断时如何核对，不能承诺跨介质恰好一次执行。
- 普通模型首个提供方的流式协议、超时、错误和凭据读取；没有依据预先固定模型价格或上下文限额。
- 用户正式 Live2D 模型与 SDK 的透明渲染、许可和分发条件。
- 实际会话规模、中文检索、大输出与恢复耗时。验收使用明确的合成基线，不引用竞品性能当成本项目性能。

后续设计见 [架构](../architecture.md)、[会话与文件管理](../session-storage.md)，实施顺序见 [迭代计划](../iteration-plan.md)。
