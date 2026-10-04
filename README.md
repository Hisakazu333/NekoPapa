# NekoPapa

带桌面角色的个人 Agent 工作台。普通模式做持续的聊天陪伴，Coding 模式集成 Pi；会话、项目和成果在同一个桌面客户端里组织，后续再加入可重复运行的工作流。

**当前版本为 `0.1.0`，已经实现桌面导航壳。聊天正文、模型调用、Pi、Live2D 和工作流还未接入。** 下表和文档中的状态以 2026-10-04 的代码为准，规划不代表已经可用。

## 产品方向

- **普通模式**：自研 TypeScript 陪伴 Agent，从真实聊天、停止与重试、本地历史开始，再加入用户确认的记忆、工具和工作流。
- **Coding 模式**：直接集成 [Pi Coding Agent](https://pi.dev/)，维护适配层和产品扩展。普通会话与 Coding 会话分别管理上下文和工具。
- **主窗口**：Codex 风格双层侧栏，Notion 风格顶部多标签。界面采用紧凑的黑白灰配色，普通聊天借鉴即时通讯的消息排列。
- **桌面角色**：完整 Live2D 显示在独立透明窗口，主窗口使用角色头像；独立 Agent 工作区显示真实运行、步骤和待确认操作。

侧栏、标签、桌面角色和工作区引用同一份会话与运行记录。关闭标签只关闭视图，归档只改变收纳状态；取消运行和退出应用分别处理。具体边界见 [产品定义](docs/product.md)。

## 现在可以做什么

| 能力 | 当前情况 |
| --- | --- |
| 双层侧栏与顶部多标签 | 可用；分类查找与打开内容相互独立，同一内容复用标签 |
| 内侧栏信息组织 | 工作台集中角色、收藏与去重后的最近访问；对话按真实活动时间分组；空间 / 项目各自管理完整目录树 |
| 产品功能预设 | 外侧「更多功能」提供七项用途说明；默认固定桌面陪伴、记忆、工作流，可固定 / 取消并保存偏好，实际能力状态明确标注 |
| 顶部内容与视图操作 | 当前内容菜单、真实详情、完整视图、已打开标签列表可用；名称与数量随当前对象同步 |
| 内容管理 | 新建索引、重命名、移动、收藏、拖动排序、搜索、归档与恢复可用 |
| 会话活动侧栏 | 可用；置顶、未读、真实时间分组及活动更新接口已实现；尚无真实 Agent 事件来源 |
| 布局与窗口 | 可调侧栏宽度、折叠与恢复布局；macOS 原生标题栏和主窗口可用 |
| 人物与账号区域 | 五位正式角色可切换；头像 / 名称打开选择列表，独立按钮开始或继续该角色的普通会话；账号仍为未登录界面 |
| 数据 | 分组、内容索引、归档、标签、布局、当前角色与固定功能偏好保存在 WebView `localStorage`；聊天与页面正文尚无存储 |
| 普通 Agent / Pi Coding | 未实现；现有 Coding 条目尚未绑定磁盘目录 |
| Live2D / 页面编辑 / 工作流 | 未实现；主内容区仍为占位 |

当前数据键为 `nekopapa.workspace-shell.v1`。浏览器预览与原生客户端各有自己的数据；后续通过迁移接入应用数据目录，不能把浏览器中的索引当作已经保存的聊天历史。当前按钮职责和验收证据分别见 [导航矩阵](docs/navigation-map.md)、[导航闭环](docs/navigation-contract.md)。

新工作台从空数据开始。升级会一次性清理未改动的旧开发示例及其导航引用；用户创建、改名、移动或已有实际活动的记录保留，清理不会重新填入示例。详情只展示现有索引与活动信息，Agent 变更、后台进程和资料来源仍待相应模块接入。

功能预设是产品入口说明，不生成示例会话或空标签。角色选择只保存当前偏好，已有会话保留原角色；普通会话创建时绑定所选角色，「继续对话」复用该角色已有的会话 ID。白羽澪和雪代凛音使用官网正式人物图，其余三位标注头像待更新。Agent 工作区预设可进入已有会话活动视图；Live2D、记忆、工作流、定时与模型连接仍待对应模块实现。各按钮的用途、当前动作和交付阶段见 [功能预设](docs/feature-presets.md)。

## 开发与验证

沿用 **TypeScript + Vite + Tauri 2 / Rust**。前端直接使用 TypeScript、CSS 和系统字体，目前没有 React，也没有已安装的 Agent SDK。

开发与重构遵循 [仓库迭代约定](AGENTS.md)：按职责拆分模块，保留导航契约，代码文件采用 500 / 800 / 1000 行分级上限，修改相关流程时落实存量拆分与回归。

需要 Node.js `^20.19.0 || >=22.12.0`、npm、Rust stable 及 [Tauri 平台构建依赖](https://v2.tauri.app/start/prerequisites/)。macOS 需要 Xcode 开发工具。

```bash
npm ci
npm run desktop
```

单独预览界面：

```bash
npm run dev
```

地址为 `http://127.0.0.1:1420`。原生窗口行为需在 Tauri 客户端验证。

```bash
npm run check
npm run test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
npm run desktop:build
```

macOS 应用输出为 `src-tauri/target/release/bundle/macos/NekoPapa.app`。调试包使用 `npm run desktop:build -- --debug`，输出在对应的 `target/debug/bundle/macos/`。当前打包目标为 `.app`，公开发行签名与公证尚未配置。

2026-10-04 顶部栏迭代验证：**85 / 85 测试通过**，TypeScript、Vite 和 macOS 调试包构建通过。已更新 `/Applications/NekoPapa.app`，验证详情开合、完整视图恢复、真实标签列表和旧示例清理；浏览器还验证重命名、收藏、切换、复制 ID 与归档联动。截图和验证边界见 [导航闭环](docs/navigation-contract.md)。当前已验证平台以 macOS Apple Silicon 为主，Windows / Linux 尚未完成验证。

2026-10-04 功能预设迭代：**90 / 90 测试通过**，TypeScript、Vite 和 macOS 调试包构建通过。浏览器验证图钉联动、偏好恢复、角色与活动入口，以及最小 760 × 520 布局；取消全部固定与重启空列表另有状态测试覆盖。已更新 `/Applications/NekoPapa.app` 并严格验证本地签名；本轮原生界面因 Mac 锁屏尚未验证，已运行的旧实例需重启。新增预设不改变内容、标签或会话模式；完整记录见 [导航闭环](docs/navigation-contract.md)。

2026-10-04 侧栏信息组织与角色切换迭代：分支 `codex/sidebar-information-layout`，**104 / 104 测试通过**，`npm run build`、macOS 调试包构建及本地签名验证通过。独立浏览器验证收藏与最近访问去重、真实时间分组、目录定位、人物切换 / 取消、按角色继续原会话、重载恢复，以及 760 × 520 布局。安装版已更新并重启，原生窗口验证五位角色选择、方向键与 Escape、切换后标签不增加、创建取消无记录；主内容模板未扩展。证据与未验证范围见 [导航闭环](docs/navigation-contract.md)。

## 下一步怎么迭代

先验证 Agent 进程和 Pi 接入方式，再建设真正的会话存储。普通陪伴优先成为每天可用的完整流程，随后接入透明桌面角色和 Coding，最后串起页面成果与工作流。

| 阶段 | 交付目标 |
| --- | --- |
| M0 | 验证随桌面应用分发的 Node.js 进程、Pi SDK、事件与取消契约 |
| M1 | 应用数据目录、会话模型、`localStorage` 迁移、恢复与归档闭环 |
| M2 | 普通陪伴 Agent：真实流式聊天、停止、失败重试、重启继续 |
| M3 | Live2D 透明窗口、独立 Agent 工作区、可管理的长期记忆 |
| M4 | Pi Coding：绑定目录，读取、修改、验证、恢复与变更查看 |
| M5 | 可编辑页面成果和第一个普通模式工作流 |
| M6 | 工作流模板、定时触发、按场景接入连接器，以及发行验证 |

M0–M6 是迭代编号，未承诺发布版本或日期。任务依赖、验收和范围取舍见 [迭代计划](docs/iteration-plan.md)；可以直接领取的开发项见 [开发任务清单](docs/iteration-backlog.md)。

研究涵盖 ZCode、Kimi Code、Pi、Notion、DeepSeek Harness 和 Hermes Agent。上游事实、源码快照、会话文件布局及采用理由集中在 [Agent 产品研究](docs/research/agent-products.md)。其中 Pi 调研快照的 SDK 包为 `@earendil-works/pi-coding-agent`，源码版本为 `1.0.1`，要求 Node.js ≥22.19；**这与当前项目允许 Node 20 的范围不同**，M0 必须验证并锁定兼容版本，当前项目依赖尚未变更。

## 文档入口

[文档索引](docs/README.md)列出各文档的用途与维护边界。

| 文档 | 解决的问题 |
| --- | --- |
| [产品定义](docs/product.md) | 陪伴、Coding、窗口、导航和成果分别负责什么 |
| [功能预设](docs/feature-presets.md) | 七个产品功能入口、固定偏好、实际动作与后续接入阶段 |
| [架构与接入](docs/architecture.md) | TypeScript、Rust、Node.js 和两种 Agent 怎么连接 |
| [会话与文件管理](docs/session-storage.md) | 谁保存会话、文件放在哪里、如何迁移、归档和恢复 |
| [迭代计划](docs/iteration-plan.md) | 每轮交付的完整流程、依赖与完成条件 |
| [开发任务清单](docs/iteration-backlog.md) | 具体模块、任务编号和验证要求 |
| [验收与交付](docs/acceptance.md) | 状态、故障、多窗口、打包和数据升级如何验证 |

## 仓库结构

```text
NekoPapa/
├── src/
│   ├── main.ts                  # 前端入口与原生窗口桥接
│   ├── styles.css               # 当前视觉与布局
│   └── app/                     # 导航状态、视图、交互、活动、搜索与动效
├── src-tauri/                   # Rust 宿主、主窗口配置与原生图标
├── public/brand/                # 桌面端 Logo
├── public/characters/           # 人物头像资源
├── tests/                       # 当前导航、搜索与活动回归
├── docs/                        # 产品、研究、技术设计和迭代文档
├── package.json / package-lock.json
└── README.md
```

未来模块目录在架构文档中标为“计划”，按对应迭代建立。用户会话、密钥、运行日志和项目工作目录不存入此源码仓库。

## 许可证与资源

自有代码采用 [Apache License 2.0](LICENSE)。Pi 使用其 [MIT 许可证](https://github.com/earendil-works/pi/blob/76dfb88f63ce51ff2e3fe2ead4fcf1f65f71f121/LICENSE)。桌面 Logo 和人物资源的来源见 [Logo 说明](docs/brand/nekopapa-logo.md)、[人物头像说明](docs/brand/lumia-avatar.md)。Live2D SDK、模型和其他第三方资源在实际接入与分发前记录各自许可；头像可用不代表已有可分发的 Live2D 模型。
