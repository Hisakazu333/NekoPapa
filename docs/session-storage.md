# Session 会话与文件管理

更新日期：2026-10-05。状态：设计基线，待 M1 / M4 实现。当前 `nekopapa.workspace-shell.v1` 保存导航索引，`nekopapa.settings.v1` 保存本机设置与配置引用，没有真实正文或 Agent 存储。当前索引有独立的 `archives` 与 `trash`，管理入口在设置的内容管理中；下文数据库 / 文件能力仍待实现。

本机设置由 `ConfigurationStore` 单独拥有，不复制工作台对象。导入 / 恢复默认前保存 `.previous`；损坏设置原文保存为 `.recovery` 后才能写入。API 记录只有服务地址、模型与环境变量名，SSH 只有身份文件路径，不保存实际密钥。云端登录、额度和账单未接入，也不写入本机设置备份。完整边界见 [设置清单](settings-map.md)。

## 数据权威先分清

| 数据 | 计划中的权威来源 | 谁可写 | 可重建范围 |
| --- | --- | --- | --- |
| 分组、标题、归属、收藏、归档、回收站 | 应用 SQLite | Rust 服务 | 从应用备份恢复，不能仅靠 Pi 文件恢复全部 |
| 普通会话消息与运行事件 | 应用 SQLite 事务记录 | Rust 服务接收自研 Agent 事件 | 消息展示表、摘要和搜索索引由应用记录重建 |
| Coding 模型上下文、分支、压缩与 transcript | 应用管理区内的 Pi 文件 | Pi SessionManager，经 Adapter 调用 | Coding 展示 / 搜索投影可从原文件重建 |
| Coding 请求意图、产品 Run、授权与归属 | 应用 SQLite | Rust 服务 | 与 Pi 文件对账；不能把文件修改或外部执行结果猜成成功 |
| 页面正文、记忆、工作流定义 | 应用 SQLite，分别有版本 | Rust 服务 | 从应用备份恢复；文件导出不是另一份写入口 |
| 草稿、标签与布局 | 应用视图状态 / 草稿表 | Rust 服务，前端提交 | 恢复视图不启动模型 |
| 密钥 | OS 凭据服务 | Rust 凭据适配器 | 不通过会话导出恢复；重新配置 |

SQLite 不是 Pi transcript 的第二份权威。Coding 的消息表、活动摘要和全文索引均标记 `derived + projectionVersion`；不向它们提供“编辑后写回 Pi”的通用接口。

普通模式以应用事件和消息事务为权威，消息展示表随同一事务更新；不得出现“用户输入显示已保存，实际只在 Node 内存”的状态。

## 身份和时间

已有普通 / Coding 内容的 `WorkspaceItem.id` 迁移后继续作为应用 `sessionId`。页面 ID 同样保留。新对象使用随机 UUID；旧合法 ID 不为了符合新格式而重写。文件路径使用另行校验的 storage key，不把未经处理的旧 ID 或标题拼到路径中。

每次被接受的输入创建一个 `runId`，重试有新 Run 并指向 `retryOfRunId`，同一个重复 `requestId` 只查询原 Run。角色 `lumia`、项目 `projectId`、Pi 原生 `engineSessionId`、消息 `messageId`、工具调用 `toolCallId` 都是独立身份。

`createdAt`、`lastActivityAt`、`lastViewedAt`、`archivedAt` 和 `deletedAt` 各自含义不同。旧记录缺少事件时间时保持空值，另记 `importedAt`；不能用迁移时间制造“今天有回复”。排序使用宿主序号和明确的手动顺序，时间只用于显示及按日期查询。

## 应用数据目录

由 Tauri 宿主解析平台应用数据目录，并传给 Node，禁止以运行时 cwd 推断。当前 application identifier 为 `app.nekopapa.desktop`。首个 macOS 验证目标类似 `~/Library/Application Support/app.nekopapa.desktop/`，以实际 Tauri resolver 返回值为准，不把示例绝对路径写死到服务。

```text
<appData>/
├── workspace.sqlite               # 产品对象、普通消息、Run、草稿、索引
├── workspace.sqlite-wal / -shm    # SQLite 运行时文件，不单独复制当备份
├── runtime/
│   └── pi-agent/                  # 应用专用 Pi 配置 / 资源区，凭据采用适配
├── sessions/
│   └── <safe-session-key>/
│       ├── pi/                    # 仅 Coding；Pi 管理的原始 JSONL
│       └── resources/             # 此会话拥有的引用快照与媒体
├── attachments/<sha256>/          # 内容寻址附件；DB 记录所有权及引用
├── runs/<runId>/                  # 大输出、验证结果与文件差异证据
├── backups/<backupId>/            # 一致性备份和 manifest
├── recovery/<recoveryId>/         # 损坏 / 迁移前的原始材料与恢复报告
├── exports/                      # 用户明确导出的文件，非运行时权威
└── logs/                         # 有界诊断日志，默认不记录完整提示或密钥
```

运行期文件置于应用数据目录；源码仓库、用户项目和导出目录是三种不同位置。归档不移动 `sessions` 文件，不破坏 Pi 绑定路径；导出也不把原始运行文件搬走。

测试与浏览器调试用独立临时根，标记测试 profile，不能指向用户原生 appData。浏览器不直接写本机数据库；需要 Agent 调试时使用明确的开发桥接与独立数据根，默认预览仍可只验证界面。

## 数据模型与约束

这是表级设计，具体 SQL 和依赖版本在 DATA-01 中提交，不能据此宣称已创建 schema。

| 表 / 数据集合 | 主要字段 | 约束与用途 |
| --- | --- | --- |
| `schema_migrations` | version、checksum、appliedAt | 分步事务迁移，版本前进明确 |
| `content_items` / `groups` | id、kind、title、groupId、orderKey、lifecycle、revision | 普通 / Coding / 页面共享导航身份；Coding 归属只能是项目 |
| `sessions` | contentId、mode、companionId、createdAt、lastActivityAt | mode 创建后不变；普通可关联角色 |
| `project_bindings` | projectId、canonicalPath、grantId、bindingRevision | 收纳组与目录绑定分开，校验存在与访问范围 |
| `pi_bindings` | sessionId、engineSessionId、fileRelativePath、cwd、sdkVersion、bindingState | 指向应用管理的 Pi 原文件，未绑定旧条目可保留 |
| `runs` | id、sessionId、requestId、status、configSnapshot、retryOf、startedAt、finishedAt、error | requestId 唯一；每个 Session 最多一个非终态 Run |
| `run_events` | eventId、sessionId、runId、seq、type、payload、sourceId | Session seq 唯一连续，重复源事件拒绝重复写入 |
| `messages` | id、sessionId、runId、role、contentBlocks、status、replyTo、answerRevision、sourceEntryId、revision | 普通事务提交 / Coding 投影；delta 更新同一 message，答案修订明确关联原输入 |
| `approvals` / `tool_executions` | runId、toolCallId、inputHash、decision、revision、effectState | 绑定实际参数和策略；外部动作结果未知时不能重放 |
| `favorites` / `activity_read_state` | contentId、orderKey / lastReadSeq、manualUnreadSeq | 收藏和置顶分开；未读由实际水位派生 |
| `archive_batches` / `archive_members` | batchId、objectId、priorGroup、priorOrder、priorFavorites | 保留本次归档影响集，恢复不覆盖后来的操作 |
| `trash_batches` / `trash_members` | batchId、objectId、deletedAt、sourceLifecycle、sourceArchiveId、priorGroup、priorOrder、priorFavorites | 删除影响集独立保存；归档来源恢复至同一归档记录，常用来源恢复原位置 |
| `view_state` / `drafts` | windowKind、contentId、tabs、activeId、layout / text、revision | 布局与内容分开；草稿保存失败不丢输入 |
| `artifacts` / `artifact_revisions` | id、body、revision、sourceSession、sourceRun、sourceMessage | 可编辑成果；按 expectedRevision 保存 |
| `memories` | id、text、scope、source、confirmedAt、revision、deletedAt | 查询只返回有效且有权限的记忆 |
| `workflow_definitions` / `workflow_runs` / `node_runs` | targetSessionId、runId、definitionVersion、inputSnapshot、nodeId、attempt、outputRef | workflow_runs 关联同一产品 Run，不另建执行队列；定义修改不影响旧 Run |
| `command_outbox` / `cleanup_jobs` | operationId、target、state、error | DB 与进程 / 文件之间的可恢复操作记录 |

`content_items.lifecycle` 区分 active / archived / trashed。归档与删除影响集可以保存同一父组不同时期的快照，但每个内容 ID 只能处于一个集合；恢复子项不能因父组快照重复而丢弃有效内容。

页面、记忆和工作流表按 M3 / M5 / M6 加入；M1 不建立一批没有消费者的表。产品元数据备份不可省略，即使 Coding 投影可从 Pi 文件重建。

## Run 状态机

```text
accepted → preparing → running → completed / failed
                         │
                         ├→ waiting → running
                         └→ cancelling → cancelled

任意非终态 ──进程死亡 / 应用强退──→ interrupted
```

accepted 说明输入已经提交，preparing 可校验模型和读取上下文。waiting 专指一个实际未决授权或明确的工具等待，需带 reason / approval ID；网络超时不能长期冒充“等待用户”。正常停止先进入 cancelling，取消尚未开始的 Run 也可进入 cancelled。

终态为 completed、failed、cancelled、interrupted。只有收到确认的收敛结果或宿主核实中断后进入终态；终态事件和错误信息提交后才能显示已结束。停止是尽力取消，之前的工具副作用保持实际发生的状态。

当前 `SessionActivity.status` 只有 idle / running / waiting / completed / failed。它是旧 UI 投影，M1 / M2 扩展投影或提供明确的取消 / 中断展示，不能把 interrupted 映射成成功，也不能用 idle 假装运行恢复。

## 输入、流式与读状态

- 接受普通输入时，同一事务写 requestId、用户消息、Run 和 outbox；事务失败返回 Rejected，保留草稿，不发模型请求。
- 同一个 Session 的消息按顺序处理；首版生成中不接受第二个隐式 Run。以后加入 steer / follow-up 时显式标记语义和请求归属。
- 回复 delta 合并到同一 message，周期提交可恢复片段。最终消息、事件水位、Run 终态和活动摘要在同一提交中收敛。
- “已保存”只显示到 durable watermark；重连后丢弃旧水位重复事件，发现序号缺口先补取。前端合帧不改变持久化确认。
- 磁盘满或 DB 写失败时暂停后续执行并提示存储失败，不在未保存状态下继续无限生成；保留已提交前缀和内存草稿，提供导出恢复。
- 进入会话只能将已展示的水位标为已读，不能把尚未送达的后续回复一起读掉。用户手动标未读另有 marker。

消息 final、单工具完成和整个 Run 完成是不同事件。活动侧栏显示来自真实消息 / Run 的摘要与状态；打开标签和重命名不会伪造模型活动时间。

## Pi 创建、恢复与两种存储对账

1. 产品 Session 首先存在于 DB，绑定状态为 unbound / preparing。旧 Coding 条目保持 unbound，要求用户选择有效项目目录，不捏造 Pi 文件。
2. Rust 记录待建绑定操作；Node 在专属目录通过 SDK 创建 SessionManager，获取原生 ID 和文件身份后确认绑定。文件尚未物化时保持 preparing，按验证过的 SDK 行为处理空会话，不手写假 header。
3. 开始运行时 DB 记录 request intent 和 Run；Adapter 通过受支持的 custom entry / 扩展或确定的源 ID 关联请求，Pi 管理实际用户消息。该关联方式须在 RT-02 / PI-02 验证，不能靠比较文本去重。
4. Pi 成功写入、应用投影还未提交而崩溃：重新打开同一文件，按源 entry ID / 文件版本与活动分支重建投影；保留 NekoPapa 元数据。
5. DB 已记录请求但 Pi 是否收到无法确认：将 Run 标为 interrupted / outcome-unknown，展示核对或重试入口；不自动再次发送，避免重复工具执行。
6. SDK / 会话文件格式不兼容时拒绝写入，保留原件与绑定，提示升级或导出。外部原文件丢失时保留索引并提供重新定位 / 导入，不自动创建空文件覆盖历史。

应用索引的 `lastIndexedEntryId` / active branch / projectionVersion 必须与 Pi 文件读取结果匹配。发生分支切换或上下文编辑时，不依赖文件 mtime 或追加偏移假定消息一直线性增长。

Pi 原文件只由 Adapter 使用 SDK 写；搜索与展示读路径不能偷偷迁移或修复外部文件。升级前备份应用库与托管文件，使用固定格式样例验证 SDK 迁移。依据：[Pi 会话格式](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/packages/coding-agent/docs/session-format.md)。

## 分支、压缩和重新生成

Pi 树导航继续由 Pi 的活动叶子决定；完整历史和模型当前上下文分别展示。Coding 首次接入就要正确读取已有分支；高级树浏览器可以延后，但不能把其他分支拼进下一次请求。

普通会话先采用线性历史与独立重试记录。M2 只重试最新一轮，关联原用户消息 / Run，不追加第二次相同输入；旧答案保留为历史修订，新答案成功后才切换当前答案。下一次模型上下文只采用当前已完成答案，不把多次重试、失败或中断片段全部拼接；重试该轮时排除该轮的旧答案。较早位置的重新生成与分支 UI 后置。

压缩产生带来源范围、配置版本与时间的摘要；原消息仍可阅读和导出，摘要不自动成为长期记忆。

fork 创建新 Session ID、记录 parentSessionId 与来源切点，不复制活跃 Run、未决授权、调度定义或凭据。进入新分支与新会话都不回滚已经发生的代码修改或外部写入。

## 归档、删除、恢复与永久清除

归档事务保存本次 batch 的对象集合、原位置和收藏，改变 lifecycle，并收起关联视图。文件不移动，Run 不取消，记忆与独立成果不级联归档。恢复按该 batch 处理，缺少父组时使用明确恢复位置；不会恢复用户后来独立归档的其他对象。

删除先将本次对象集合移入回收站，保存原位置、排序、收藏、人物及来源状态；标签、最近访问与打开历史引用同步移除。分组只包含当前成员，不重复处理独立归档 / 删除的子项。常用来源恢复至原位置，归档来源恢复至原归档记录与时间；设置内管理列表恢复不自动打开标签或启动模型。当前索引层已实现该流程，运行中 / 等待处理会话拒绝删除；服务接入后扩展为拒绝所有非终态 Run。删除与归档均不清理磁盘目录或独立成果。

真实执行接入后，**活跃或待处理 Run 必须跨归档可达**：活动侧栏保留单独的运行 / 需要处理区，归档会话可只读打开并操作相应 Run。归档状态保留；新回复不自动取消人工归档。归档搜索与正文检索的范围明确区分。

永久清除是 DATA-05 的独立管理动作，默认不自动触发，不等同回收站操作。条件：对象在回收站、无非终态 Run、用户能看到要清除的会话 / 附件 / 应用记录范围。保留独立成果和已确认记忆，解除其来源链接并显示来源已清除；需要清除它们须另选对象。

DB 先提交待清理标记及 cleanup job，再删除仅由该对象拥有的托管文件，失败可恢复重试。共享附件按引用数处理；外部 Pi 原件和项目目录永不作为应用垃圾清理目标。删除后的本地记录、既有导出、备份和已发模型请求分别说明，不宣称物理介质或外部服务已被擦除。

## 从 localStorage 迁移

1. 迁移只从当前原生 WebView 读 `nekopapa.workspace-shell.v1` 及已有 recovery 数据。浏览器来源不自动合并；另提供用户选择的 JSON 导入。
2. 原文保存到 recovery 目录并记 SHA-256、来源、导入时间与迁移版本，成功备份后才解析。
3. 事务导入分组、有效内容、收藏、顺序、归档 / 回收站批次、删除来源和活动字段，保留原 ID。系统 / 分组占位不是真实 Session；无归属有效内容进入恢复组，写迁移报告。
4. 普通和页面条目正文为空；Coding unbound。缺少历史时间维持空值，旧索引中的运行状态若没有实际 Run 证据，显示为历史索引提示，不宣称仍在执行。
5. 迁移 marker 按源数据 hash 和版本去重，重复启动不重复导入。校验 active + archived + trashed 数量、引用、收藏位置和标签映射后才切换写入口。
6. 保留旧 localStorage 和原始备份，迁移失败则不启用新 writer。切换成功后 SQLite 为唯一写入口；不能双写旧 JSON 作为永久同步方案。

要回退旧版本，使用迁移前快照在独立数据根恢复；不能把已在新版本产生的真实正文压回只支持索引的旧格式。保留导出新数据和继续使用新版本的选择。

## 搜索、分页、导出与备份

列表先查询元数据和活动投影，按页加载，不逐个读取全部 Pi 文件。正文搜索只索引持久消息；角色、工具调用与来源能区分，中文在独立语料上验证。Pi 索引落后时显示重建状态，不能把没搜到解释为记录已丢失。

| 操作 | 范围 | 计划行为 |
| --- | --- | --- |
| 可读分享 | 当前会话、选定消息或页面 | Markdown；说明是否包含工具输出与所选分支；默认不含其他分支、凭据和全局诊断 |
| 单会话可恢复导出 | 会话元数据、原历史、来源和可选附件 | manifest + 普通 JSONL / Coding 原 Pi 文件；保留格式与 SDK 版本，说明隐藏历史也可能包含 |
| 工作台备份 | 应用库、托管 Pi 文件、资源和 manifest | 冻结写入，确认所有 writer 空闲并完成持久化，再取 DB 与托管文件一致副本 |
| 诊断包 | 用户选定对象的错误与运行诊断 | 单独入口、可预览 / 脱敏；全局日志默认排除 |
| 导入 | 用户选定导出包 | 校验版本、校验和、大小、路径、ID 冲突与引用；同 ID 不覆盖原对象，重映射并保留来源 |

共享 / 导出默认写用户选择的路径，落盘成功才提示完成。导出与备份不是自动删除授权。SQLite 在线备份不能通过单独复制 `.sqlite` 而漏掉 WAL。

首版完整备份分两步：先阻止新 Run 和其他内容修改，等待现有运行自然结束；等待期间仍接收该 Run 的事件与停止请求，用户也可取消备份。确认 Pi idle、普通事件已提交后，再冻结全部数据 writer，在写锁覆盖期间使用 SQLite backup API 和托管文件复制，生成版本、对象、资源及校验和 manifest，最后释放写锁。不能假设 Pi 已有可用的暂停 / checkpoint API。未来允许活动中快照前，须单独验证跨介质协议；恢复旧快照中的非终态 Run 时标记 interrupted，不自动重放。

附件复制先写临时文件、校验、原子发布，再提交 DB 引用；未引用临时文件进入 cleanup。上传或引用资源限当前会话与授权范围，路径中 `..`、符号链接逃逸与超大包不能绕过管理根。

## 故障恢复与规模验收

启动恢复对非终态 Run 核对进程与写者身份，旧 PID 不直接视为存活任务。无法确认的工具结果显示 unknown，不重放有副作用的节点。损坏库先保存原件、只读诊断和可恢复导出；不能删除后生成示例数据。

首轮测试基线为 1,000 个内容索引、100,000 条普通消息、20 个含分支 / 压缩的 Pi 样例及一个大工具输出。这是计划测试规模，不是当前性能承诺。验证分页、搜索、索引重建和首屏是否避免全量历史扫描，测量结果写入验收记录后再设性能目标。

测试场景与证据格式见 [验收与交付](acceptance.md)，具体任务为 DATA-01–DATA-05、CHAT-02 / CHAT-03、PI-02 / PI-04。
