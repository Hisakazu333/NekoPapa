# 原型设计基线

基线日期：2026-09-04

资产范围：`prototype/desktop-app/`（零构建纯静态 HTML+CSS+JS 设计原型）

## 结论

- `prototype/desktop-app/` 是产品 UI 的唯一设计基线（设计事实来源）。早期 `img/` PNG 截图基线已随旧方案退出删除，不再作为验收依据。
- 原型是零构建静态页面：不依赖打包器，直接用浏览器渲染。Live2D 模型通过相对路径 `../../assets/live2d/hiyori/` 加载，需要 HTTP 预览。
- 设计 token 的唯一真相源是 [`prototype/desktop-app/assets/proto.css`](../../prototype/desktop-app/assets/proto.css)；设计规范与纪律见 [`prototype/desktop-app/DESIGN.md`](../../prototype/desktop-app/DESIGN.md)。所有原型页的新建/修改必须遵守这两个文件。
- 原型可确认信息限于页面中直接可见的布局、组件、状态和文案。数据契约、持久化、权限模型、网络行为、性能指标与功能完成度均不能从原型确认。
- 当前仓库实现为 `app/control-desktop/`（Tauri 2 + React + Rust）；Native Stage 与 NekoCore-Nano 由外部预构建产物接入，本仓库不保存其 C++ 源码。实现状态只能由代码路径、自动化测试、外部产物版本和运行时证据共同确认，原型页面本身不证明任何功能已实现。

## 预览方式

```bash
prototype/desktop-app/serve.sh
```

脚本从仓库根启动 `python3 -m http.server 8123`，原型入口为
`http://127.0.0.1:8123/prototype/desktop-app/`。Live2D 模型经 HTTP 相对路径加载，
直接以 `file://` 打开页面会被浏览器拦截模型加载。

## 页面清单

| 页面 | 文件 | 可见产品意图 |
| --- | --- | --- |
| 主入口 / 舞台 | [`index.html`](../../prototype/desktop-app/index.html) | 桌面舞台主画面、导航与输入栏；`?mode=assist` 辅助模式 |
| 小屋 | [`hut.html`](../../prototype/desktop-app/hut.html) | 小屋场景与角色陪伴 |
| 对话 | [`chat.html`](../../prototype/desktop-app/chat.html) | 会话列表、消息流与会话详情 |
| 学习流程 | [`learn-flow.html`](../../prototype/desktop-app/learn-flow.html) | 学习主流程串联 |
| 辅助流程 | [`assist-flow.html`](../../prototype/desktop-app/assist-flow.html) | 辅助/陪伴任务流程 |
| 测验 | [`quiz.html`](../../prototype/desktop-app/quiz.html) | 测验答题界面 |
| 阅读 | [`reading.html`](../../prototype/desktop-app/reading.html) | 阅读任务界面 |
| 口语 | [`speaking.html`](../../prototype/desktop-app/speaking.html) | 口语练习界面 |
| 记忆 | [`memory.html`](../../prototype/desktop-app/memory.html) | 记忆列表与详情 |
| 错题 | [`mistakes.html`](../../prototype/desktop-app/mistakes.html) | 错题整理与回顾 |
| 复习 | [`review.html`](../../prototype/desktop-app/review.html) | 复习队列与进度 |
| 计划 | [`plan.html`](../../prototype/desktop-app/plan.html) | 学习计划编辑 |
| 报告 | [`report.html`](../../prototype/desktop-app/report.html) | 学习报告与统计 |
| 地图 | [`map.html`](../../prototype/desktop-app/map.html) | 世界/地点浏览 |
| 资料库 | [`lib.html`](../../prototype/desktop-app/lib.html) | 学习资料库 |
| 专注 | [`focus.html`](../../prototype/desktop-app/focus.html) | 专注模式 |
| 宠物 | [`pet.html`](../../prototype/desktop-app/pet.html) | 宠物/角色状态 |
| 菜单栏 | [`menubar.html`](../../prototype/desktop-app/menubar.html) | macOS 菜单栏弹出界面 |
| 设置 | [`settings.html`](../../prototype/desktop-app/settings.html) | 应用设置（含 `#sec-usage`、`#sec-account`、`#sec-avatar`、`#sec-memory`、`?page=pet` 等锚点/子页） |
| 订阅 | [`subscribe.html`](../../prototype/desktop-app/subscribe.html) | 会员方案与用量 |
| 截图提问 | [`shot-ask.html`](../../prototype/desktop-app/shot-ask.html) | 截图问答入口 |
| 拖放 | [`drop.html`](../../prototype/desktop-app/drop.html) | 文件拖放交互 |

页面通过相对 `href` 互相链接；新增或重命名页面时必须同步更新所有入口链接，
并检查不存在指向已删除页面的死链。

## 判断标签

| 标签 | 含义 |
| --- | --- |
| 设计基线 | `prototype/desktop-app/` 中的页面状态是 UI 实现的目标外观，但不代表已实现。 |
| 待确认 | 流程顺序、模块归属或状态机无法仅由原型页面确定，必须在 Issue 中决策。 |
| 覆盖层 | 弹窗、抽屉、菜单等叠加状态，必须与底层页面共同验收。 |

## 基线使用规则

1. Issue 必须引用具体的原型页面文件（如 `prototype/desktop-app/memory.html`），不得只写“照着原型做”。
2. 原型页面与实现存在冲突时，Issue 必须声明采用的页面状态、范围和非目标。
3. “实现状态”只能由代码路径、自动化测试和运行时证据共同更新。原型页面不能把状态从“未核验”变为“已实现”。
4. UI 验收至少覆盖宽窗口、窄窗口、最小支持尺寸和 macOS 原生窗口控制区；不得用整体页面缩放掩盖响应式布局问题。
5. 视觉变更必须遵守 `assets/proto.css` 的 token 与 `DESIGN.md` 的设计纪律；新增 token 先改 `proto.css` 并在 `DESIGN.md` 登记，不在页面内散落硬编码色值。

## 实现状态更新准入

任一原型页面进入实现追踪时，关联 Issue 必须同时记录：

- 采用的原型页面文件、具体状态和明确排除的候选状态；
- 对应代码路径与责任模块；
- 自动化测试名称及通过记录；
- 至少包含宽、窄和最小支持窗口的运行时证据；
- macOS 原生窗口控制、居中导航、左右状态区和缩放拖拽的验收结果；
- 未覆盖状态、已知偏差及后续 Issue。
