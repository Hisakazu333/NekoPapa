# NekoPapa 产品基线

本目录把 `prototype/desktop-app/` 中的设计原型转化为可追踪的产品意图和验收输入。NekoPapa 是唯一产品名；NekoCore-Nano 与 Native Stage 是外部运行时边界，不是第二套界面品牌。原型页面描述“希望产品如何工作”，不证明代码已经实现、测试已经通过或安装包已经具备相同行为。

## 文档入口

- [原型设计基线](prototype-baseline.md)：`prototype/desktop-app/` 的页面清单、预览方式、判断标签与验收准入。
- [`prototype/desktop-app/`](../../prototype/desktop-app/)：产品 UI 的唯一设计基线。零构建纯静态页面，`serve.sh` 从仓库根起 `http.server` 8123 预览。
- [`proto.css`](../../prototype/desktop-app/assets/proto.css)：设计 token 唯一真相源；[`DESIGN.md`](../../prototype/desktop-app/DESIGN.md)：设计规范与纪律。

## 基线使用规则

1. Issue 必须引用一个或多个具体原型页面文件，不得只写“照着原型做”。
2. 原型中的布局、状态、交互或文案存在冲突时，Issue 必须声明采用哪个页面、哪一部分，以及未采用的候选方案。
3. “实现状态”只能由代码路径、自动化测试和运行时证据共同更新。原型页面本身不能把状态从“未核验”变为“已实现”。
4. 覆盖层与流程串联页只用于发现状态与分支；涉及多状态的页面应先拆成独立 Issue 或明确选定状态。
5. 原型页面内容发生变化时，必须同步更新 [原型设计基线](prototype-baseline.md)、变更原因和受影响 Issue。
6. UI 验收至少覆盖宽窗口、窄窗口、最小支持尺寸和 macOS 原生窗口控制区；不得用整体页面缩放掩盖响应式布局问题。
7. 新界面只使用 NekoPapa；外部仓库名、runtime 名称和内部工程术语不作为第二个产品标题。

## 产品模块与 Issue 切片

| 模块 | 原型范围 | 建议 Issue 切片 | 核心验收边界 |
| --- | --- | --- | --- |
| 应用外壳与导航 | `index.html`、`menubar.html` | `product/shell-native-window-and-navigation` | 使用系统原生窗口控制；主导航始终以窗口中心线居中；左右状态区不挤动导航；窄宽度下有明确降级策略。 |
| 舞台与小屋 | `index.html`、`hut.html`、`pet.html`、`focus.html` | `product/stage-responsive-shell`、`product/stage-overlay-flows` | 背景、Live2D、状态卡、输入栏和侧栏独立布局；窗口拖拽缩放连续；覆盖层不改变底层尺寸；键盘与关闭路径完整。 |
| 对话与流程 | `chat.html`、`learn-flow.html`、`assist-flow.html`、`shot-ask.html`、`drop.html` | `product/conversation-layout`、`product/learning-flow-state-machine` | 会话列表、消息区、详情栏可独立滚动；流程页具备进入、进行、完成、失败和恢复状态。 |
| 学习 | `quiz.html`、`reading.html`、`speaking.html`、`mistakes.html`、`review.html`、`plan.html`、`report.html`、`lib.html` | `product/learning-tasks`、`product/review-and-mistakes`、`product/reporting` | 任务、复习、错题与报告共享可追踪状态模型；统计口径与列表一致；破坏性动作可撤销或二次确认。 |
| 记忆 | `memory.html`、`settings.html#sec-memory` | `product/memory-library`、`product/memory-governance` | 浏览、检索、详情、确认与修正均需可追踪；删除和合并提供确认、来源和恢复策略。 |
| 世界与地点 | `map.html` | `product/world-location-browser` | 地点列表、可达性和人物状态一致；无权限地点有明确反馈。 |
| 设置、账号与订阅 | `settings.html`、`subscribe.html` | `product/settings-information-architecture`、`product/subscription-and-usage` | 本地模式、账号、订阅、隐私与危险操作边界明确；退出、清除本机和删除账号不可混淆。 |

## Issue 必填字段

产品 Issue 至少包含以下字段，缺一项不进入开发：

```markdown
## Product intent
- Prototype pages:
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

1. 新增或修改 `prototype/desktop-app/` 页面时，先遵守 `assets/proto.css` 与 `DESIGN.md` 的 token 和设计纪律。
2. 在 [原型设计基线](prototype-baseline.md) 更新页面清单与可见意图记录，不留指向已删除页面的死链。
3. 标注该页面是主基线、局部状态、覆盖层还是流程串联稿。
4. 关联或创建 Issue，写明采用的状态和明确不采用的状态。
5. 只有完成代码、测试和运行时验证后，才在对应 Issue 中声明实现完成；原型基线不承担实现状态台账职责。
