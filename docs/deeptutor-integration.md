# DeepTutor 源码对照与自研学习核心

核查日期：2026-11-08。产品对象为个人自学者，首批场景为大学课程、编程和专业知识。
本次固定到官方提交 [`60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db`](https://github.com/HKUDS/DeepTutor/commit/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db)，提交时间 2026-11-06，版本 [`1.7.2`](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/__version__.py)。
通过官方 API 与固定提交的原始源码核对，未安装、启动或向 NekoPapa 复制 DeepTutor。以下事实不代表其依赖组合、教学质量或性能已经运行验证。

## 我们应该做成什么

NekoPapa 自己实现“**资料有版本，解释有出处，学习者先作答，反馈可核对，之后能够再练**”这一条核心流程。
沿用现有联系人与连续聊天，辅助工作区承载资料、练习和笔记；自己的学习状态、运行契约和数据所有权先确定。
参考 DeepTutor 的资料解析与索引发布、Agent 工具循环、带状态门槛的教学、问题与作答存储、取消和事件恢复。
独立 DeepTutor 服务适配作为后续可选路径，不是自研核心必须先完成的安装步骤。

第一版应能完成：创建目标 → 加入短文本 → 依据选定段落解释 → 生成一道待答题 → 学员提交 → 可追溯反馈 → 保存笔记并安排复习。
完整课程生成、多个联系人自动群聊、论文研究、扫描件 OCR 和代码执行分别后置；模式按钮不能证明执行能力已接入。
产品行为与完整验收见 [个人自学规划](self-learning-plan.md)；本文说明从上游哪段实现借鉴什么，以及由我们哪个边界负责。

当前 DeepTutor 的默认执行路径是 Python 应用服务与运行时，Web API / WebSocket 是入口，Next.js 前端只是使用者之一。
NekoPapa 当前采用 React、Vite 和 Tauri，不需要移植其页面或再运行一套前端。[官方架构](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/docs-for-dev/ARCHITECTURE.md)
当前 Solve 复用普通 Agent 工具循环，教学主线由 Mastery Path 承担；旧介绍中的多个 Solve / Guide Agent 不能直接当作当前代码结构。

## 1. 资料与检索：先形成可靠证据

真实链路为 `KnowledgeBaseInitializer.copy_documents / process_documents → RAGService.initialize / add_documents → 知识库绑定的 pipeline`。
`stage_source` 避免同名文件覆盖；`IndexingRun` 记录各文件与阶段状态，产物通过 provider readiness 检查后才能成为可查询版本，也区分 partial。
文件上传、解析、embedding、索引发布是不同状态，不能只凭前端进度条宣布资料可用。
源码：[initializer.py L155](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/knowledge/initializer.py#L155)、[staging.py L46](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/knowledge/staging.py#L46)、[RAGService L68](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/service.py#L68)、[IndexingRun L134](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/knowledge/indexing_run.py#L134)。

LlamaIndex 路径可采用向量检索，或 BM25 与向量的 reciprocal rank fusion，再选择是否重排。BM25 不可用时会告警并降为向量检索；设置为 hybrid 不能证明实际执行了 hybrid。PageIndex 走 reasoning-as-retrieval，不直接套普通 `search`。
源码：[build_retriever L192](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/retrievers.py#L192)、[RAGService.search L127](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/service.py#L127)。

LlamaIndex 检索结果中的 `answer` 是检索片段拼接，并非已验证正确的最终回答。来源含 `document_key`、`source_digest`、`chunk_id`、页索引 / 页标签、解析器标识、定位状态与证据文本。原文页接口接受 `source_hash`，避免旧引用悄悄打开新版页面。
源码：[_nodes_to_result L440](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/rag/pipelines/llamaindex/pipeline.py#L440)、[kb_source_page L3286](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/routers/knowledge.py#L3286)。

**我们采用的设计：** 资料领域拥有原件、不可变修订、解析与索引任务，学习执行只消费已就绪的证据包。
先支持短文本 / Markdown 和明确选定片段，预算不足时缩小范围；不需要先建设向量数据库。随后加入可定位的文本 PDF，再做检索。
引用绑定 `sourceRevisionId`、片段与定位，不以文件名或展示序号充当身份。新修订重新建索引，旧题目 / 反馈 / 笔记保留原依据；新索引失败不能破坏旧可用版本。

## 2. Solve：受预算约束的工具循环

`DeepSolveCapability.run` 设置解题上下文后运行 `AgenticChatPipeline`；`SolveLoopCapability` 给同一个循环挂入 `solve_plan / solve_finish_step / solve_replan`。步数与重新规划次数有宿主上限，并非多个 UI 角色轮流发言。
源码：[DeepSolveCapability.run L65](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/solve/capability.py#L65)、[SolveLoopCapability L22](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/solve/loop.py#L22)、[SolveReplanTool L228](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/solve/tools.py#L228)。

`SolveSession` 的步骤表在进程内保存，checkpoint 文本帮助循环继续，不等价于跨进程恢复完整规划器。`solve_finish_step` 记录模型提交的总结，返回下一步和 `all_done`，不会因此证明推导正确或学习者已经掌握。
源码：[SolveSession L38](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/solve/session.py#L38)、[SolveFinishStepTool.execute L184](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/solve/tools.py#L184)。

**我们采用的设计：** 多步讲解放在同一个 Run，记录步骤、输入证据、结果、预算和失败。
“给提示”“解释下一步”“查看完整解法”是不同意图；生成完整解法不代替学员作答。首条闭环只需受限解释和出题，数学核验 / 代码测试在后续接真实工具，并分别保存核验结果。

## 3. 教学：模型表达与领域状态分工

`MasteryPathCapability.run` 绑定路径和会话，在路径租约内运行 `MasteryLoopPipeline`。循环每轮重新核对当前目标及资料证据；`outline / study / review` 是会变化的学习会话模式，工具调用仍检查当时模式。值得借鉴的是确定性状态门槛，不能只复制教学提示词。
源码：[MasteryPathCapability L56](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/mastery/capability.py#L56)、[pipeline.py L79](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/mastery/pipeline.py#L79)、[mode.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/mastery/mode.py)。

`scope_snapshot / validate_evidence` 保存和核对知识库、文档、页码、索引版本与目标的指纹，题目另存生成时的证据快照。准备课程资料是明确操作，不应在每轮对话里隐式重复付费检索；缺失、过期或覆盖不足需有状态。
`teaching_guidance` 将学习偏好与掌握证据分开：已经解释、用户沉默、喜欢某种风格都不是答对的证据。
源码：[lesson_evidence.py L270](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/lesson_evidence.py#L270)、[PrepareLessonTool L3865](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/mastery/tools.py#L3865)、[teaching_guidance L110](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/teaching.py#L110)。

**我们采用的设计：** 空间保存目标及版本，讲解与练习绑定目标版本和资料快照。前端选择概览、例子或推导，后端据就绪材料执行。
资料变化后旧题保留历史，不能用失效证据继续判新答案。讲解完成、自评、独立答对、提示后答对和需要再验证分别记录；首版展示证据，不照搬百分比或自动解锁整门课程。

## 4. 出题、评价、复习：接成持久数据闭环

上游存在几条不同路径，不能统称一个“出题批改接口”：

- **Questions**：通常先 explore、plan，再逐题生成；模仿试卷另走分支。结果含题干、答案、解析和题目 ID，主要负责生成。[QuestionPipeline L515](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/agents/question/pipeline.py#L515)
- **Mastery 测验**：`QuizTool / GradeTool → LearningService.grade_interaction` 围绕已存问题 ID 读取题目、答案键，提交真实作答；重放已有判分不新增尝试。[QuizTool L1092](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/capabilities/mastery/tools.py#L1092)、[grade_interaction L1148](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/service.py#L1148)
- **Practice 题库**：客观检查与用户自评分开，提交以 `request_id` 去重并检查版本，保存复习事件与下次时间。当前调度是 SM-2 风格冷启动，不是已拟合的 FSRS 或学习效果证明。[answers.py L9](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/practice/answers.py#L9)、[storage.py L207](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/practice/storage.py#L207)、[scheduler.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/practice/scheduler.py)
- **独立 AI Judge WebSocket**：接收客户端提供的题目、答案键、答案，再流式评价；该路由没有同时形成 Mastery 的持久问题与尝试闭环，不能直接作为正式批改契约。[quiz_judge.py L325](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/routers/quiz_judge.py#L325)

优先采用 Mastery 的提交规则：模型评价在事务外生成，提交前核对问题、目标与状态指纹。客观答案先用确定规则；语义评价要求结构化结果，无法判定或模型输出无效不能保存成假分数。`LearningStore` 负责事务、revision 与事件提交，成功后才通知界面。
源码：[LearningService L3148](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/service.py#L3148)、[semantic_assessment.py L86](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/semantic_assessment.py#L86)、[LearningStore L1230](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/learning/storage.py#L1230)。

**我们采用的设计：** 题目版本、评价标准与答案键由服务保存；前端只收到题面、允许的提示和输入结构。答案键不随完整生成对象提前发给 UI；主动揭示后另记揭示事件。继续答同一题复用题目 ID，换题或改题建立新版本。
真实提交拥有 `attemptId` 和幂等 `requestId`，保存原始答案、提示层级、揭示情况与资料版本。重复传输返回原 attempt，主动再答才建立新 attempt。
反馈独立版本化，允许争议和修正；评价失败的重试只重新评价已存 attempt，不复制学员作答。复习依靠真实 evidence，首版手动设日期；角色好感、聊天轮数、阅读时长和模型自评不进入掌握判断。

## 5. Research：有确认门槛的后台编排

`ResearchPipeline` 先改写、分解问题，未确认 outline 时返回 `outline_preview`。确认后使用 `DynamicTopicQueue`，按配置串行或受限并行调度主题，汇集引用并写报告；子题失败保留 partial 和失败说明。
这里确有后台主题协作，仍不能推导出多个联系人自动加入群聊；整理引用 ID 也不等于引用在语义上确实支持论断。
源码：[ResearchPipeline.run L527](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/agents/research/pipeline.py#L527)、[_drive_queue L1168](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/agents/research/pipeline.py#L1168)、[_write_report L1286](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/agents/research/pipeline.py#L1286)。

**我们采用的设计：** 资料闭环通过后才加入专题研究。用户先确认范围、提纲、工具、预算与资料边界，后台再执行子任务。父 Run 和步骤分别保存结果、引用、失败与取消，报告作为可编辑成果；部分失败不能显示完整成功。

## 6. 运行与事件：恢复观察不等于重新执行

真实链路是 `unified_websocket → TurnApplicationService.start_turn → TurnRequestPreparer.start_turn → TurnExecutor._run_turn → TurnEngine.execute → ChatOrchestrator`。
`turn_runtime.py` 是组合 facade，生命周期与执行在 `services/session/turns/`；`app/engine.py` 是兼容导出，不能据文件名推断实现所有权。
源码：[WebSocket L44](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/routers/unified_ws.py#L44)、[应用服务 L113](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/app/service.py#L113)、[请求准备 L180](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/session/turns/request_preparer.py#L180)、[执行 L142](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/session/turns/executor.py#L142)、[TurnEngine](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/runtime/turn_engine.py)。

v2 协议区分 `session_id`、`turn_id`、事件 `seq`、提交身份和取消 / 回答命令身份。应用服务使用 `client_submission_id` 与请求摘要保留提交关系；订阅重放落盘事件再接实时尾部，丢弃重复水位。
取消确认的 `accepted` 表示命令被接受，不是任务已取消，界面仍等待终态。断开 WebSocket 或关闭视图不能当取消。
源码：[turn_protocol.py](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/api/contracts/turn_protocol.py)、[subscribe_turn L248](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/app/service.py#L248)、[cancel_turn_and_wait L421](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/app/service.py#L421)。

执行器在最终 `done` 可见前刷新持久事件并更新终态；取消路径尽力保存已生成内容，不承诺撤销已有副作用。事件重放也不表示模型调用或内存 Solve 计划能在进程死亡后原样继续。
源码：[完成提交 L1295](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/session/turns/executor.py#L1295)、[取消处理 L1346](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/session/turns/executor.py#L1346)。

**我们采用的设计：** 沿用 [目标运行契约](architecture.md) 与 [会话存储](session-storage.md) 的 Rust 单写、Node 执行与持久事件边界，普通文字学习不强制依赖 Coding 执行层。
`requestId` 对应用户动作，`runId` 对应一次执行，`attemptId` 对应一次学员作答；同 attempt 的判分重试可产生新 run，不能新增作答证据。
事件提交后广播，重连先读快照与缺口；进程死亡标 interrupted，保留已提交前缀，由用户选择重试。
将来若用 DeepTutor adapter，额外保存服务端 session / turn ID 及 turn 内 `seq`，它与我们计划的 Session 事件序号不是同一计数器。

## 7. 持久化：领域状态与聊天呈现分开

上游 SQLite 保存 sessions、messages、turns、turn_events、提交关系、题库与部分 practice 数据；资料、索引、收藏和笔记正文另有文件存储。`notebook_entries` 是题库的历史命名，不是笔记正文。Task board 卡片与会话有关联，卡片状态不是 Run 终态或掌握状态。
源码：[SQLiteSessionStore L245](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/session/sqlite_store.py#L245)、[TaskBoardStore L121](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/deeptutor/services/task_board.py#L121)、[数据路径](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/docs-for-dev/DATA_STORAGE.md)。

**我们采用的职责边界：**

- `LearningSpaceService`：空间、目标版本、资料关联与原会话关联；换联系人不复制学习对象。
- `SourceService`：原件、修订、片段、引用定位和解析 / 索引任务，保留 hash 与就绪状态。
- `StudyService`：当前学习意图、证据包与共享 Run 调用，表达风格来自联系人，权限来自宿主。
- `ExerciseService`：题目版本、私有答案键、原始 attempt、提示 / 揭示与可修订反馈。
- `ReviewService`：概念证据、到期项、人工调整与规则版本，不重写历史 attempt。
- 笔记复用成果 / 正文修订方向，关联来源、题目和作答，不再维护聊天内第二份可写笔记。

这些是计划职责，尚未创建模块。新增实现默认 500 行档，不复制上游数千行 service / storage / tools 文件，也不预建没有使用者的框架。
SQLite 由宿主单写，原件与索引放管理资源目录，执行器只返回结果；保存失败不能显示“已保存”。
现有联系人与聊天 ID 原样迁移，先备份、校验、事务切换，不长期双写 localStorage。若某会话交由 DeepTutor 执行，其服务端保持该会话权威，NekoPapa 保存映射与自身成果，不复制两个可独立修改的 transcript。

## 人物、后台角色与可见群聊

五位官方同伴沿用 `lumia / rinne / iori / shiori / tsumugi` 和既有人设，不编造学科资历。
联系人保存人格、表达与连续对话；检索、讲解、出题、评价、研究是后台职责，同一同伴可使用多种已授权能力。
不要将五位同伴硬绑为五个学科、worker 或资料库；换同伴不代表换账号、学习空间或权限。

可见群聊须另外定义参与者、发言次序、各自上下文、共同资料、用户插话和取消范围，它不是后台并行任务的自然投影。
当前先完成单同伴连续学习。侧栏“联系人”只作为入口，人物列表、搜索和新增在联系人主工作区内，避免将后台角色与人物目录铺回侧栏。

## 实施顺序与交付门槛

以下编号均待实施，记录本规划内的依赖，不替代 [开发任务清单](iteration-backlog.md) 的状态。按门槛推进，不虚构工期。

### EDU-0：真实运行与可恢复存储

依赖普通模型连接、宿主进程 / 协议、Session / Run 与持久化基础，对应 `RT-01 / RT-03`、`DATA-01–04`、`CHAT-01–03` 的相关部分。普通学习底座与 Coding 执行层专用依赖分开；浏览器可先纵向验证，桌面仍需安装包运行与退出验收。
通过条件：两轮真实问答可继续；重复提交不重复执行；停止、断流、保存失败、认证失效和进程退出都有真实状态与恢复入口。

### EDU-1：一份资料的一次学习闭环

依赖 EDU-0。先支持短文本 / Markdown，完成空间目标、资料修订、引用解释、一题一答、评价、笔记和手动复习日期。
运行时按 `questionId + questionRevision` 读取评价依据，前端不提供答案键；只处理明确范围，超预算需缩小资料。
通过条件：原始答案、提示和反馈分别保存；引用打开同一修订；重复提交返回同 attempt；评价失败可重试；重开后全部关联完整。

### EDU-2：可检索资料与来源质量

依赖 EDU-1 的修订 / 定位契约。加入文本 PDF 解析、独立索引任务、混合检索与可选重排；OCR / 图像证据另行验收。
用独立资料与问题集核对期望片段、引用支持关系和无答案问题，记录有效 provider、解析失败、版本切换与检索耗时。
通过条件：新版失败不破坏旧索引；部分失败可定位并重试；没有依据或无法定位时明确说明；引用不能只因模型生成编号就被接受。

### EDU-3：连续课程与复习

依赖真实 attempt、概念与反馈版本。加入诊断、可修改的小目标、依据作答的后续练习与应用内复习。
通过条件：独立完成与提示后完成可区分；跨天再答产生新 attempt；评价可纠正；延期 / 跳过不伪造完成；调度规则和参数单独验证。

### EDU-4：编程实作与专题研究

编程执行依赖 Coding 执行层 / 宿主的目录绑定、授权、真实命令与测试，没有执行器时只承诺阅读分析并标“未运行”。
专题研究依赖可靠检索、预算、提纲确认、子任务取消与 partial 成果，多联系人群聊作为独立产品范围。
通过条件：命令、退出码、测试与改动来自真实结果；研究引用可打开，子题失败不呈现完整成功，取消保留已发生的实际结果。

## 当前基线与未实施范围

[`src/main.ts`](../src/main.ts) 组装 BoardUI 聊天、主题与设置；联系人有本机存储和连续聊天，工作台与联系人历史通过共享存储按 ID 合并。
[`agent-chat.tsx`](../src/components/application/agent-chat/agent-chat.tsx) 当前使用 AI SDK `/api/chat`；[`scripts/boardui-chat-api.ts`](../scripts/boardui-chat-api.ts) 只给 Vite 开发 / 预览服务提供该路由，密钥取服务器环境，已保存模型记录不等于此路由已采用它。
静态构建与 Tauri 安装包尚未因此拥有常驻执行器、SQLite、解析器或学习后端。学习空间、资料修订、出题判分、复习与 DeepTutor adapter 不能据本规划宣称已实现。
后续每阶段记录实际命令、领域测试、独立资料和运行证据；浏览器、Tauri、真实提供方与执行器分层验收。

本轮只引用设计。官方声明采用 [Apache License 2.0](https://github.com/HKUDS/DeepTutor/blob/60fb3bdfddb30b7740c7ce3bd9b28d908f2af6db/LICENSE)；未来实际引入代码时登记固定版本、文件、修改与归属，第三方包 / 模型 / 资料分别核对。更新研究基线时重新检查调用链、协议、存储、模块与迁移，不能只改版本号。
