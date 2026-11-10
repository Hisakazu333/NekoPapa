# 当前客户端设计系统

更新日期：2026-11-08。本文约束当前 React 客户端的视觉来源和页面边界，具体功能与验收分别见 [导航职责](navigation-map.md)、[设置清单](settings-map.md) 和 [验收记录](navigation-contract.md)。

## 真实入口与依据

当前客户端使用 React 19、TypeScript、Vite、Tailwind CSS 4 和 Tauri 2，入口为 [main.ts](../src/main.ts)。核查时锁文件中的 React / React DOM 为 19.3.1，Tailwind CSS 为 4.3.5，React Aria Components 为 1.22.1。后续精确版本继续以 [package-lock.json](../package-lock.json) 为准。

界面沿用仓库已经引入并适配的 BoardUI 组件、语义 token 与图标。来源和修改边界见 [BoardUI 源码说明](../src/components/boardui-source.md)；免费 Chat Starter 源码与参考 Pro 模板的交互借鉴须区分，不把参考网站可见效果说成已经安装了全部模板。
仓库当前已有 BoardUI 初始化基础：Tailwind v4、主题样式、`cx()`、React Aria 及基础组件均已接入。无需再次运行项目初始化；后续先查组件目录，只安装实际缺少且获授权的组件源码。

用户明确的产品要求决定页面与操作；实际 token 定义决定颜色、文字、圆角与阴影。需求与实现不一致时修正实现并同步当前文档。`src/app` 中保留的旧 DOM 导航、历史原型与旧验收记录只用于兼容和追溯，不决定当前页面入口。模板注释中的 Figma 或 Next.js 环境名称也不能代替本仓库实际的 Vite 字体与构建配置。

## 主题 Token 来源

颜色、字体族、圆角、阴影等共享视觉值由下列主题文件定义；组件可以组合这些 token，页面也可以保留完成布局所需的局部尺寸和样式。局部 CSS 不属于全局 token，也不应复制主题中的语义值。

- [globals.css](../src/styles/globals.css)：样式入口，导入 Tailwind、主题和排版；定义 `.dark` 策略、基础规则及共享动效。
- [theme.css](../src/styles/theme.css)：基元覆盖、`accent-*` 色阶、字体族、圆角、阴影；用 `@theme inline` 把语义变量导出为 Tailwind 工具类，并实现主按钮渐变等共享样式。
- [theme-light.css](../src/styles/theme-light.css)：`:root` 下的浅色语义颜色；同一组定义也挂在 `.light` 上，用于在深色文档里局部呈现浅色主题（目前只有外观设置的主题预览），与 `.dark` 对称，不是另一套 token。
- [theme-dark.css](../src/styles/theme-dark.css)：`.dark` 下覆盖同名语义颜色及阴影。
- [typography.css](../src/styles/typography.css)：字号、行高、字距和字重组合。`text-body-medium` 等类一次应用整套排版。
- [fonts.css](../src/platform/fonts.css)：本地打包 Inter Variable 与 JetBrains Mono Variable，并设置 `--font-inter`、`--font-mono-source`。当前使用 Fontsource，未使用 `next/font`。

本项目没有另外一套独立的 NekoPapa 颜色包。新页面直接消费这些现有定义，不能在页面、组件或文档中复制一套同名颜色值。浅深色通过同名语义变量切换，组件优先使用语义类，避免逐页编写 `dark:` 配色。

## 常用视觉契约

背景按用途使用 `bg-background-full`、`bg-background-primary-default`、`bg-background-secondary-default` 等；文字使用 `text-text-primary`、`text-text-secondary`、`text-text-tertiary`，图标使用 `text-foreground-icon-primary` 或 `text-foreground-icon-secondary`。边框与焦点分别使用 `border-border-button-default`、`border-separator-border`、`ring-border-focus-ring` 等语义类。状态应选择对应错误、禁用或成功语义，不能仅靠透明度伪装为不可用。

强调色由 `accent-50` 至 `accent-950` 管理，当前默认引用鼠尾草绿色阶。账号菜单“偏好”提供鼠尾草绿、蓝色、紫色和暖橙色；`ConfiguredTheme` 将选中的色阶应用到根节点，BoardUI 的主按钮、侧栏选中态、焦点环和其他引用 accent token 的交互状态随之更新。静态 ramp 位于 [appearance-accent.css](../src/styles/appearance-accent.css)，保证 Tailwind 构建保留全部选择；内容状态、图表等已有专用颜色继续保持原色。设置“外观 → 主题”不新增 token：所有文字、背景、边框和图标语义色都引用中性色阶，主题只在根节点内联重建 `--color-neutral-50…950`（较亮一端为 50、较暗一端为 950，中间按默认色阶的亮度位置用 `color-mix(in oklab)` 插值，见 [appearance-themes.ts](../src/app/appearance-themes.ts)），并提供强调色；状态色、错误色和 `white` / `black` 不随主题变化，所以浅色主题下少数直接使用白色的表面仍为白色。

圆角与尺寸按现有组件使用。已定义的补充圆角为 `rounded-2lg`（10px）和 `rounded-2-5xl`（20px）；其他常规值沿用 Tailwind 默认档位。常规按钮由组件统一提供 medium / small / xs 的高度、圆角、图标和文字，不在调用处手工拼出第二种相似按钮。菜单表面与行间距由 [menu-styles.ts](../src/components/base/dropdown/menu-styles.ts) 共享，包含 `rounded-2xl`、边框、`shadow-dropdown` 和展开动效。

正文和控件使用 Inter 的系统回退栈，中文由可用系统字体回退；代码使用 JetBrains Mono 的等宽回退栈。正文 `text-body-*` 为 14 / 20，辅助正文 `text-body-2-*` 为 13 / 18，说明 `text-caption-1-*` 为 12 / 16；标题使用对应 `text-title-*` 或 `text-display-*`。当前工作台问候的衬线字体与自适应字号来自 [chat-home.css](../src/styles/chat-home.css)，是该区域已有的展示样式，不把整套控件改成衬线。首页按自身宽度（容器查询，`cqi`）而非窗口宽度缩放：内容最宽 768px，问候 28–40px，猫图标为问候字号的 1.3 倍；宽度不足 560px 时改用紧凑间距并隐藏“给你一点灵感”标签。

图表与统计使用已有 chart 语义：空格子、空闲日和占比轨道用 `bg-chart-track`，单一数值的深浅用 `accent-*`（个人资料与消耗统计的热力图）；分类系列用 `--color-chart-1` 至 `--color-chart-9`（桑基图来源按位置取色），中性节点用 `chart-neutral`。统计卡在 `@container` 内按卡片宽度换列（如 `@2xl:grid-cols-4`），不要用视口断点，设置弹窗内的宽度远小于视口。

通知（toast）区域带 `data-react-aria-top-layer`，这是 React Aria 为 toast 保留的顶层标记：设置等弹窗打开时，弹窗外的内容会被设为 `inert`，只有顶层元素保持可点，点击它也不会被当作点在弹窗外。新增类似的全局浮层时沿用该标记，不要用提高 z-index 代替。

现有首页仍有专用 CSS 尺寸与阴影，它们是已适配布局的实现事实，不能称为全部 token 化。扩展共享视觉时先检查现有组件是否已经覆盖；确需新增语义时，在主题及浅深色定义中统一加入并验证使用者，不能从这些专用值无限派生页面变体。

## 组件、图标与资源

按钮、输入、选择、菜单、模态框、提示和确认框优先复用 [base](../src/components/base) 下现有组件。组件基于当前锁定的 React Aria 与 React 版本；页面负责组合与业务状态，基础组件负责外观、键盘语义及焦点行为。菜单与选择列表的语义不同，不能只因样式相近就互换。

运行类设置在 schema 中显式声明 `control`（`input`、`textarea`、`select`、`segmented`、`switch`、`number`、`slider`、`directory` 或 `tags`），值校验仍由字段 `type` 负责；渲染器不通过字段名或选项文字长度猜测组件。普通枚举使用 BoardUI `Select`，互斥且选项有限的策略才使用 `SegmentedControl`，整数计数用 `NumberField`，连续范围用 `Slider`。配置块统一按设置页面配方渲染为分区标题 + 卡片行，不再声明布局变体；集合编辑和通用保存状态继续复用同一配置面板。

侧栏“最近对话”参照 BoardUI 侧栏的存储库树：文件夹行使用 `RiFolder3Line` / 展开时 `RiFolderOpenLine`，子对话缩进并以 `border-border-button-default` 引导线连接，单行标题右侧是 `bg-background-tertiary-default` 的时间徽标；悬停时徽标淡出，行 `…` 菜单在同一位置出现。项目行悬停显示 `RiMoreFill` “…”菜单（BoardUI Dropdown，与对话行菜单同宽同内边距，移除项为错误色）与新建对话图标，置顶项目名称后跟 `RiPushpinFill` 小图标。“编辑项目”使用 BoardUI Modal（md）：名称 Input 带文件夹前置图标，源文件夹为 `rounded-2xl border-border-button-default` 的分隔列表，主要文件夹用描边标签、其余用 secondary xs“设为主要”按钮，页脚左侧“移除本地项目”为错误色 secondary 按钮。首页工具栏的项目选择复用 `chat-home__toolbar-button` 触发样式与 BoardUI Popover，列表行与联系人菜单保持同一尺寸和选中勾选图标，第二行显示主要文件夹的 Git 分支（`RiGitBranchLine`）。

普通功能图标沿用 `@remixicon/react`，尺寸由对应组件决定。展开箭头使用仓库现有 [chevrons.tsx](../src/components/foundations/icons/chevrons.tsx)。模型供应商和附件插件使用已核实并随包保存的 BoardUI SVG，资源来源与路径见源码说明；装饰插画、Logo、人物头像与 Live2D 模型各有资源所有者，不能把供应商品牌图标当作普通功能图标替代。

输入框参照 BoardUI Composer Panel（Pro，未安装源码）：上方一条 `bg-background-secondary-default` 托盘放模式菜单、项目目录与不可发送原因，下方 `rounded-3xl` 卡片放草稿摘要、textarea 与附件 / 权限 / 模型 / 表情 / 发送按钮，托盘以负外边距衬在卡片后面。联系人单聊（`contacts/contact-composer.tsx`）已采用该结构。

## 登录与设置的页面职责

登录是独立应用页面，从账号菜单的登录动作进入；页面沿用同一背景、排版、按钮、图标和主题，卡片使用官方安装的 `auth/auth-card.tsx`（本项目增加 `form` 插槽，替换示例的邮箱表单、社交登录与注册切换）。登录不作为设置分类，不嵌入设置弹窗，也不另开桌面窗口。`AccountPageProvider` 以 `#login` 和浏览器历史管理页面状态；登录页显示时 AgentChat 保持挂载并设为不可交互。返回原工作台或联系人时保留会话、草稿与对象身份，并把焦点交回有效入口。

设置负责本机资料、外观、模型与 API、工具、备份及其他真实配置。登录身份与本机资料独立，修改本机姓名不代表已登录。后端重构期间账号传输保持关闭；登录页面显示真实未开放状态，不渲染可扫描的假二维码，不制造余额、头像、登录用户或登录成功。扫码、过期、取消、错误和重试状态在实际认证服务接入后按契约逐项验收。

“设置”只在账号菜单中出现一次（账号组：登录、本机资料、设置），侧栏底部只保留账号按钮。账号菜单“偏好”的外观行使用调色盘图标与“外观”标签，右侧是跟随系统、浅色、深色三个图标的 BoardUI SegmentedControl；强调色在下一行以色样提供选择，并用可访问名称标明颜色，不使用 emoji。主题和强调色均使用同一份本机外观配置：改变选择后立即保存并作用于整个界面，跟随系统会响应操作系统的明暗模式；重启后从配置恢复。语言使用已安装的 BoardUI `Select`，选项使用 SVG 国旗。支持语言与实际翻译范围一致，不填充尚未实现的语言。

主题模式改变时，以该 SegmentedControl 当前焦点选项的中心为键盘操作起点，以实际点击位置为指针操作起点，使用 820ms 圆形扩展揭示新主题。BoardUI 分段控件的滑动选中指示器继续保留其自身短过渡。主题捕获期间冻结其他色彩过渡，避免揭示内容混合新旧调色板。浏览器不支持 View Transitions、捕获失败或系统启用了减少动态效果时，主题仍即时应用；快速连续操作以最近一次选择为准，旧动画或迟到回调不能覆盖新状态。强调色选择不会启动主题圆形动画。

标题栏右侧工具按钮依次为目录、终端、更改、浏览器、文件与“插件与工具”（拼图图标，BoardUI Popover）：弹层分两块：上方“DeepSeek Harness 插件”说明 dsh 插件是 TypeScript / JavaScript 模块（导出 `apply(ctx)`，由 Cordis 配置加载），与技能、MCP 不同，执行层接入前不会加载；下方两个按钮分别进入设置“开发 → Cordis 插件”和打开 GitHub 搜索；下方“MCP、技能与连接器”只列出设置“MCP 与连接器”“技能”中实际保存的配置并标“未运行”，说明 Coding 执行层尚未接入，底部两个按钮进入对应设置页；“在 GitHub 搜索 DeepSeek Harness 插件”按钮只在系统浏览器中打开 GitHub 仓库搜索（桌面版经 `open_external_url` 命令，仅接受 http(s)），应用内不抓取、不展示搜索结果，也不需要 GitHub 授权；没有配置时显示空状态，不生成示例条目。

macOS 交通灯和窗口控制由系统绘制。Overlay 标题栏使用独立的 40px 工具行：交通灯右侧安全区之后直接是返回、前进、新建对话，空白拖动区设置 `data-tauri-drag-region`，工具按钮不设置拖动属性；聊天页把分享和更多操作放进这条窗口栏，工作台与对话标题路径保留在聊天面板顶部；联系人页不重复显示聊天标题。工作区从标题栏下方开始；标题栏不再重复 NekoPapa 图标和名称，品牌识别只保留在侧栏顶部。完整浏览器页面也在应用顶部左侧显示返回、前进和新建对话，不仿制系统窗口按钮；路径继续放在聊天面板顶部。嵌入式模板预览不额外增加应用工具栏，沿用面板内标题及操作。窗口栏的返回、前进、新建对话与右侧分享、更多操作共用 [toolbar-icon-button.tsx](../src/components/application/dashboard/toolbar-icon-button.tsx) 的轻量图标按钮（沿用 BoardUI Chat Starter 头部操作的 28px、`rounded-md`、次级图标色与悬停底色，补充焦点环），导航按钮附 BoardUI `Tooltip`，有快捷键的按钮在提示中附 BoardUI `Kbd`（如“隐藏侧栏 ⌘B”）；标题栏最左侧是隐藏 / 显示侧栏按钮，与返回、前进之间以分隔线区分；聊天页的新建对话加号放在对话标签之后；右侧的目录 / 终端 / 更改 / 浏览器 / 文件是同款按钮的开关版本 `ToolbarToggleButton`（React Aria ToggleButton，选中时用悬停底色），对应面板共用 [tool-panel-frame.tsx](../src/components/application/agent-chat/tools/tool-panel-frame.tsx) 的标题行（图标、名称、项目与分支、操作、关闭）与居中说明；差异的增删行使用 `status-lime` / `status-rose` 语义色，文件状态用 BoardUI `Chip`，终端配色在运行时取自主题 token；前进与新建之间以分隔线区分；不在窗口栏使用带边框阴影的 `IconButton`。新建对话由窗口栏加号和聊天历史面板共同提供，搜索继续由侧栏快速搜索和系统快捷键提供。涉及这些区域时必须检查原生配置并在 Tauri 实测；浏览器布局验收仅证明 Web 页面。

## 每轮交付检查

1. 从真实入口走完进入、返回、取消与失败恢复，检查原会话和未提交草稿。
2. 检查浅色、深色、可用窄窗口、键盘焦点和减少动态效果偏好；清楚记录实际通过的层次。
3. 核对新页面是否复用既有 token、组件和图标，并处理受影响的错误或禁用状态。
4. 当前设计与导航 / 设置说明同步维护；历史行为明确标为历史，规划明确标为待实现。
5. 运行仓库要求的测试、构建与差异检查，不能用文档声明或历史截图替代本轮结果。

## 设置页面配方（2026-11-09）

设置页按 BoardUI `settings-modal` 区块组织，不再使用整页表单或卡片式单选 / 开关：

- 表单页：每个配置块是 `SettingsSectionLabel` + `SettingsCard`，字段是 `SettingsRow`（左侧标签与说明，右侧紧凑控件）。开关用 `Switch`，短选项（标签合计不超过 10 字）用 `SegmentedControl`，其余选项用紧凑 `Select`；数字、滑块、目录、长文本与标签列表分别用 `NumberField`、`Slider`、输入 + 选择、`Textarea`、`TagGroup`。所选选项的说明（`optionHints`）显示在该行说明里。
- 列表页（模型、MCP 与连接器、技能、Cordis 插件、设备、钩子）：沿用官方 Tools 页的字母方块行、`…` 下拉菜单（编辑 / 删除）、虚线新增行和空状态卡片；方块颜色复用 Chip 状态色，状态点只表示“服务未接入”，不显示伪造的已连接状态。MCP 页用 `PillTab` 按类型筛选。
- 常规页顶部为本机资料卡（参照官方 General 页的方案卡），数据页参照官方 Storage 页的总量卡与数据表。官方 `FileUpload` 会模拟上传进度，因此导入区只采用其空闲外观，状态以真实读取与校验结果为准。
