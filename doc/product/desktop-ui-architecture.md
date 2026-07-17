# NekoPapa 桌面 UI 架构与验收规范

状态：现行产品与工程规范

本文件定义桌面窗口、全局导航、页面工作区和小屋场景的坐标边界。它把 `img/` 原型转化为可测试规则，不把原型图当作功能完成证据。

## 设计事实来源

界面工作按以下顺序取证：

1. [原型资产基线](prototype-baseline.md)定义目标页面、候选状态和验收锚点
2. 当前源代码和运行时截图定义已经实现的行为
3. GitHub Issue 选择采用的原型状态、范围和非目标
4. Pull Request 记录窗口矩阵、自动检查和运行时证据

`P-028` 是当前唯一的 `1624 x 969` 宽窗口原型参考画布，不等于 WebView viewport。其余
`1024 x 1024` 图片多数是展示画布，也不能把图片像素直接当成应用 viewport。运行时验收
必须分别记录 OS 外框、Tauri inner size 和 WebView viewport。

原型中的旧品牌文案属于 legacy 债务。新界面只使用 NekoPapa；NNA / NekoCore-Nano 不作为第二个产品标题。

## 窗口分层

桌面主窗口分为三个稳定层级：

```text
Operating system title bar
└── WebView application shell
    ├── Global navigation
    ├── Page workspace
    └── Global overlay root
```

### 原生标题栏

Tauri 使用系统原生标题栏。关闭、最小化、最大化、窗口拖动和边框 resize 由操作系统处理，不由 React 页面绘制。

原生窗口控件必须位于应用内容外。React 不得伪造 macOS traffic lights、Windows caption buttons 或一套跨平台通用关闭按钮。

### 全局导航

全局导航属于 app shell，不属于任何页面。它必须满足以下规则：

- 导航中心与 WebView viewport 的水平中心重合
- 左侧状态和右侧操作区域宽度变化时，导航中心不移动
- 页面切换、连续 resize 和系统显示缩放不会改变导航的坐标系
- 导航不参与小屋场景 zoom，也不接受页面容器的 `transform: scale(...)`
- 空间不足时使用明确的 compact 或 overflow 方案，不压缩到文字重叠

推荐使用对称三列 grid：`minmax(left_min, 1fr) auto minmax(right_min, 1fr)`。验收时比较导航 bounding box 中心与 viewport 中心，差值不得超过 1 CSS px。

### 页面工作区

页面工作区位于全局导航下方。每个页面拥有自己的 grid、滚动和断点，不得修改 app shell 高度或全局导航位置。

页面级侧栏、详情面板和工具栏可以折叠。它们不能通过缩放整个页面来适配窗口，也不能把原生标题栏或全局导航包进自己的裁剪区域。

### 全局覆盖层

Modal、dialog、toast 和阻断式确认挂载到 app shell 的 overlay root。覆盖层以 viewport 为定位基准，不改变底层页面尺寸。

页面 popover 可以锚定触发控件。涉及账号删除、外部写入、权限升级和不可逆操作时，必须使用可聚焦、可取消的 modal。

## 坐标系统

NekoPapa 同时使用四个坐标系统：

| 坐标系统 | Owner | 可以缩放 | 不得包含 |
| --- | --- | --- | --- |
| OS window | Tauri/操作系统 | 系统 DPI | React 窗口按钮 |
| App shell | React shell | 不整体缩放 | 小屋 scene transform |
| Page workspace | React feature | 响应式重排 | 原生标题栏、全局导航 |
| Live2D canvas | Web/Native renderer | 模型与画布变换 | 账号、导航、页面状态 |

CSS 应优先使用 grid、flex、container query、`minmax()` 和受约束的绝对定位。`transform` 只用于场景、角色或不参与文本布局的视觉层。

不要用 viewport 宽度缩放字体。导航、表单、菜单和按钮保持可读字号与稳定 hit target。

## 小屋页面

小屋由五个互不拥有尺寸的层组成：

```text
Home workspace
├── Background scene
├── Embedded Live2D canvas
├── Left status stack
├── Right action and context stacks
└── Bottom composer and scene controls
```

### Scene resize

背景使用受控 crop，例如 `background-size: cover`，并为关键主体定义 focal point。Live2D canvas 根据 workspace 和 device pixel ratio 更新 renderer，不通过缩放 DOM 祖先来改变尺寸。

连续 resize 必须满足：

- 背景、角色、状态卡和输入栏不闪白
- 角色 anchor 不在相邻帧跳变
- 左右面板不把角色推出 scene 中心
- canvas 不重复创建 WebGL context
- resize listener、observer 和 animation frame 在卸载时清理

### Scene zoom

如果小屋提供 zoom，zoom 只改变 scene camera 或 Live2D model transform。zoom 控件位于未缩放的 page toolbar 或 overlay controls 中。

zoom 不得改变：

- 原生标题栏和窗口边框
- 全局导航中心
- 页面工具栏与输入控件字号
- Modal 的 viewport 定位

### Window resize and page drag

窗口边框 resize 由操作系统处理。场景内对象拖拽只修改对象或 camera 状态，不接管窗口 resize hit zone。

页面需要拖动画布时，必须区分点击、对象拖拽、camera pan 和 Live2D hit test。pointer capture 在结束、取消、窗口失焦和组件卸载时释放。

### Prototype data

小屋原型中的天气、身体状态、日程、记忆和在线状态是产品 intent。当前没有真实 owner
的值必须在 adapter、contract 或页面状态说明中标记为 fixture、preview 或 simulated；
页面可以继续使用 mock 数据，但不能把 mock 来源写成已接入的实时服务。后端接入时替换
adapter 与 DTO，不在页面组件中散落数据源判断。

## 其他产品页面

对话、记忆、世界、Agent 和设置页面采用工作台布局，而不是移动端页面或大卡片落地页。

### 对话与通话

会话列表、消息区和详情栏拥有独立滚动。窄窗口明确选择折叠栏、抽屉或单栏 drill-in，不同时压缩三栏。

通话实现前先定义呼叫、接通、静音、设备切换、失败、重连和挂断状态。原型波形不证明音频链路存在。

### 记忆

列表选择、详情、筛选、批量操作和修正历史共享一个可追踪状态模型。删除、合并和覆盖必须提供确认、来源和恢复策略。

### 世界

地点浏览和场景编辑器是两个 surface。编辑器需要独立的选择、缩放、吸附、锁定、撤销、保存和预览状态。

### Agent

任务、能力和自动化页面必须显示权限、执行状态、失败恢复和审计。高风险外部动作在运行前显式确认。

### 设置与账号

设置使用清晰的信息架构，不把功能描述当作页面内容。退出登录、清除本机数据和永久删除账号必须是三种不同操作。

## 组件所有权

当前文件结构仍按 `pages/`、`components/` 和全局 styles 组织。目标结构按 feature 收敛，但只有实现和测试出现时才创建目录。

```text
features/home/
├── model.ts
├── port.ts
├── controller.ts
├── HomePage.tsx
├── components/
└── home.css
```

- `model.ts` 保存纯状态和转换
- `port.ts` 声明页面需要的桌面或服务能力
- `controller.ts` 编排异步 action 和错误状态
- React view 只消费 view state 并发出 user intent
- Tauri command 名和 raw payload 集中在 platform adapter
- Cubism Web 类型集中在 Live2D integration adapter

## 视觉系统

原型使用浅色工作台和克制的珊瑚红强调色。实现应保持信息密度与扫描效率，不把每个 section 包成浮动大卡片。

界面遵循以下约束：

- 页面 section 使用无框布局，card 只用于重复条目、工具面板和 modal
- card radius 不超过 8 px，除非原型基线明确要求
- 图标按钮使用 Lucide 或平台标准 glyph，并提供 accessible name
- 二元设置使用 toggle 或 checkbox，模式使用 segmented control，数值使用 input、slider 或 stepper
- 文字不与图标、按钮、状态或相邻内容重叠
- 字间距保持 `0`，字体大小不随 viewport 宽度连续缩放
- 动画支持 `prefers-reduced-motion`，隐藏页面暂停非必要动画和 Live2D render loop

## 可访问性

每个交互都必须满足：

- 键盘可达，焦点顺序与视觉顺序一致
- Icon-only button 有 `aria-label` 和 tooltip
- Modal 建立 focus trap，关闭后焦点返回触发控件
- 状态不只通过颜色表达
- 错误信息说明失败动作和恢复方式
- 对比度、缩放文本和 reduced motion 进入验收证据

## Viewport 验收矩阵

最低支持窗口来自 Tauri 配置：`1024 x 720`。UI 变更至少验证以下 viewport：

| Viewport | 目的 |
| --- | --- |
| `1024 x 720` | 最小支持窗口 |
| `1280 x 800` | 窄桌面工作区 |
| `1440 x 900` | 默认窗口 |
| `1600 x 900` | 宽桌面 WebView viewport；与 `P-028` 参考画布分开记录 |
| `1920 x 1080` | 宽桌面与两侧余量 |

macOS 至少记录 1x/2x display scale。Windows 至少记录 100%、125%、150% 和 200%。没有对应平台环境时写 `not verified`，不能用另一平台结果替代。

每个 viewport 都要检查：

- 原生标题栏位于应用内容外
- 全局导航按 viewport 中心居中
- 左右状态区不会挤动导航
- 页面没有水平溢出、裁切或文字重叠
- 小屋角色、背景、面板和输入栏保持可用
- 连续 resize 不出现空白 canvas 或事件失效

## 验证层级

UI Pull Request 按以下层级记录证据：

1. TypeScript check 和 production build
2. Component/state tests，当前仍需补齐测试框架
3. Playwright viewport screenshots 和 DOM geometry assertions，当前仍需落地
4. Tauri runtime screenshot/video，包含窗口尺寸、平台和 display scale
5. Native Stage runtime evidence，若改动涉及独立桌面窗口

浏览器截图不能证明原生标题栏、sidecar 或 Native Stage。单张静态截图不能证明 resize、drag 或动画顺滑。

## 当前实现与目标差距

最新 `main` 已使用原生标题栏，并删除 React 自定义窗口按钮。全局导航使用对称三列 grid，符合居中方向。

以下差距仍需通过 Issue 和独立 PR 处理：

- 缺少导航中心的自动 geometry assertion
- 缺少小屋关键 viewport screenshot tests
- 小屋多列 overlay 在连续窄化时仍需要运行时验证
- Live2D resize、device pixel ratio、隐藏暂停和 context cleanup 缺少自动测试
- `App.tsx` 仍集中拥有页面选择、Stage 状态和跨页消息编排
- 原型中的对话、记忆、世界和 Agent 流程没有完整服务 owner

任何改动先引用 `P-xxx` 和 GitHub Issue，再提交前后证据。不要在治理或文档 PR 中顺手修改当前 UI 行为。
