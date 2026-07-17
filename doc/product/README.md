# NekoPapa 产品基线

本目录把 `img/` 中的产品原型转化为可追踪的产品意图和验收输入。NekoPapa 是产品名；Nekonano-Aether（NNA）与 NekoCore-Nano 是同一底层体系的工程名与核心名。原型图描述“希望产品如何工作”，不证明代码已经实现、测试已经通过或安装包已经具备相同行为。

## 文档入口

- [原型资产基线](prototype-baseline.md)：48 张原型图的逐项清单、SHA-256、尺寸、重复关系、页面判断与验收锚点。
- [`img/` 原始资产](../../img/)：产品意图的原始视觉来源。文件名是资产身份，不应在未更新基线的情况下重命名或替换。

## 基线使用规则

1. Issue 必须引用一个或多个 `P-xxx` 原型 ID，不得只写“照着原型做”。
2. 原型中的布局、状态、交互或文案存在冲突时，Issue 必须声明采用哪张图、哪一部分，以及未采用的候选方案。
3. “实现状态”只能由代码路径、自动化测试和运行时证据共同更新。原型图本身不能把状态从“未核验”变为“已实现”。
4. 组合稿和候选矩阵只用于发现状态与分支，不作为逐像素验收基准；应先拆成独立 Issue 或明确选定稿。
5. 同一文件的内容发生变化时，必须同步更新 SHA-256、尺寸、变更原因和受影响 Issue。
6. UI 验收至少覆盖宽窗口、窄窗口、最小支持尺寸和 macOS 原生窗口控制区；不得用整体页面缩放掩盖响应式布局问题。
7. 原型画面中的 `OpenNeko` 文案是 legacy 品牌债务，不进入当前产品验收；新界面只使用 NekoPapa。

## 产品模块与 Issue 切片

| 模块 | 原型范围 | 建议 Issue 切片 | 核心验收边界 |
| --- | --- | --- | --- |
| 应用外壳与导航 | 所有全页原型 | `product/shell-native-window-and-navigation` | 使用系统原生窗口控制；主导航始终以窗口中心线居中；左右状态区不挤动导航；窄宽度下有明确降级策略。 |
| 舞台与小屋 | `P-006`、`P-013`、`P-028`、`P-032`、`P-035`、`P-036`、`P-041`、`P-047` | `product/stage-responsive-shell`、`product/stage-overlay-flows` | 背景、Live2D、状态卡、输入栏和侧栏独立布局；窗口拖拽缩放连续；覆盖层不改变底层尺寸；键盘与关闭路径完整。 |
| 对话与通话 | `P-008`、`P-011`、`P-019`、`P-031`、`P-037` | `product/conversation-layout`、`product/voice-call-state-machine` | 会话列表、消息区、详情栏可独立滚动；通话具备呼叫、接通、静音、挂断、失败和恢复状态。 |
| 记忆 | `P-001`、`P-012`、`P-018`、`P-021`、`P-030`、`P-033`、`P-034`、`P-038`、`P-039`、`P-042` | `product/memory-library`、`product/memory-governance`、`product/memory-import-export` | 浏览、检索、详情、确认、合并、修正、导出均需可追踪；破坏性动作可撤销或二次确认；处理进度和失败可恢复。 |
| 世界与地点 | `P-023`、`P-045`、`P-048` | `product/world-location-browser`、`product/world-scene-editor` | 地点列表、可达性、对象热点和人物状态一致；编辑器保存、撤销、预览、对象锁定与校验有明确反馈。 |
| Agent 与自动化 | `P-009`、`P-017`、`P-020`、`P-022`、`P-024`、`P-025`、`P-027`、`P-029`、`P-040`、`P-044` | `product/agent-capabilities-and-permissions`、`product/agent-task-lifecycle`、`product/automation-rules` | 权限最小化；任务需有草稿、确认、运行、暂停、失败、恢复和审计；高风险外部动作必须显式确认。 |
| 设置、账号与设备 | `P-002`、`P-003`、`P-004`、`P-005`、`P-007`、`P-010`、`P-014`、`P-015`、`P-016`、`P-026`、`P-043`、`P-046` | `product/settings-information-architecture`、`product/auth-and-device-sync`、`product/destructive-account-actions` | 本地模式、登录、设备同步、冲突、订阅、隐私与危险操作边界明确；退出、清除本机和删除账号不可混淆。 |

## Issue 必填字段

产品 Issue 至少包含以下字段，缺一项不进入开发：

```markdown
## Product intent
- Prototype IDs:
- Adopted screen/state:
- Rejected or deferred variants:

## Scope
- In scope:
- Out of scope:
- Target code owners/modules:

## State model
- Entry conditions:
- Loading/empty/success/error/offline states:
- Persistence and recovery:
- Destructive or external side effects:

## Acceptance criteria
- [ ] Functional behavior is observable and testable.
- [ ] Narrow, wide, and minimum supported window sizes are covered.
- [ ] Keyboard focus, screen-reader labels, reduced motion, and contrast are checked.
- [ ] Navigation remains centered independently of left/right status content.
- [ ] Native macOS window controls remain outside application content.
- [ ] Automated tests and runtime evidence are linked.

## Verification evidence
- Code paths:
- Automated tests:
- Runtime screenshots/video:
- Known gaps:
```

## 原型变更流程

1. 新增或替换图片后运行 SHA-256 与像素尺寸清点。
2. 在 [原型资产基线](prototype-baseline.md) 分配新 ID 或更新原记录，不复用已删除 ID。
3. 标注该图是单页基准、局部状态、弹窗覆盖、候选矩阵还是组合说明稿。
4. 关联或创建 Issue，写明采用的状态和明确不采用的状态。
5. 只有完成代码、测试和运行时验证后，才在对应 Issue 中声明实现完成；资产目录不承担实现状态台账职责。
