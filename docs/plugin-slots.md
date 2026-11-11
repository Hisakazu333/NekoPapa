# 插件扩展位设计方案

更新日期：2026-11-11。本文是**设计草案**，没有对应的运行时代码：当前客户端没有任何 UI 扩展位、插件注册表或插件加载器，下文的清单格式、接口和存储键都是拟定内容，实现时以届时源码和本文修订为准。Agent 运行时与 Coding 执行层仍未接入，本文不改变这一事实。

依据的当前事实见 [导航职责](navigation-map.md)、[设置分类与接入清单](settings-map.md)、[当前设计系统](design-system.md) 与 [Agent 产品研究](research/agent-products.md)；迭代约束见 [AGENTS.md](../AGENTS.md)。

## 目标与不做的事

目标：以后客户端的多个位置可以由插件扩展，也可以由用户自己调整（隐藏、排序、固定），参照 DeepSeek Harness 把模型、工具、会话和界面都组织成插件的思路——插件可以向会话视图标签、侧栏、输入区工具条、模型菜单、设置分类等位置注册视图和命令。

不做：

- 不搬入 Cordis 或 DeepSeek Harness 的插件框架。研究结论已写明“借鉴事件与恢复边界，不直接搬入插件框架”；本方案只借鉴“宿主声明扩展位、插件声明贡献”的形态。DeepSeek Harness 的具体 UI 插件接口本轮未逐项核对其源码，下文不声称与之兼容。
- 不引入新的前端框架、组件库或第二套样式；扩展位由宿主用现有 BoardUI 组件渲染。
- 不让插件代码直接调用 Tauri `invoke`、读写 `localStorage` 或操作宿主 DOM。
- 不为演示塞入示例插件或假数据。没有安装插件时，扩展位只呈现内置内容。

## 现状核查

| 位置 | 实际组件 | 现状 | 对扩展的意义 |
| --- | --- | --- | --- |
| 标题栏对话标签 | [chat-title-tabs.tsx](../src/components/application/agent-chat/chat-title-tabs.tsx)、[chat-workspace-tabs.ts](../src/components/application/agent-chat/chat-workspace-tabs.ts) | 每个标签是一个已打开的对话（`thread.id`），像浏览器标签，带前进 / 后退历史 | **不是**“对话 / 轨迹”这种同一会话内的视图切换；不能把插件视图塞成对话标签，否则破坏“标签 = 对话 ID”的契约 |
| 会话内视图标签（对话 / 轨迹） | 无 | 当前对话区只有一种视图（消息记录） | 需要新建；“轨迹”依赖 Agent 运行事件，当前没有数据来源 |
| 工作面板 | [chat-side-panel.tsx](../src/components/application/agent-chat/chat-side-panel.tsx) 的 `TABS`；视图类型 `WorkPanelView`（[use-browser-placement.ts](../src/components/application/agent-chat/use-browser-placement.ts)） | PillTab 切换“历史 / 代码 / 资料 / 工具”；隐藏后记住所选视图；“资料”已用黄色 StatusDot 呈现“后端未连接” | 已是按 ID 切换的视图容器，并已有真实不可用状态的写法，最适合作为第一个扩展位 |
| 工作面板“工具” | [chat-tool-panel.tsx](../src/components/application/agent-chat/tools/chat-tool-panel.tsx)、[chat-tools.ts](../src/app/chat/chat-tools.ts) | SegmentedControl 切换目录 / 终端 / 更改 / 文件；三项有固定快捷键 | 与工作面板视图合并考虑；插件不分配快捷键 |
| 标题栏动作 | [agent-chat-actions.tsx](../src/components/application/agent-chat/agent-chat-actions.tsx) | 浏览器开关、插件按钮（[chat-plugins-button.tsx](../src/components/application/agent-chat/tools/chat-plugins-button.tsx)）、分享与对话菜单 | 插件按钮是现成的“插件管理”入口 |
| 侧栏“更多” | [sidebar-more-menu.tsx](../src/components/application/dashboard/sidebar-more-menu.tsx)，固定状态 [sidebar-pins.ts](../src/app/navigation/sidebar-pins.ts)（`nekopapa.sidebar-pins.v1`，ID 为 `space` / `knowledge` / `cabin`） | 条目为 `{ id, label, icon, onOpen }`，可固定到主导航；底部悬浮栏布局共用同一组目的地 | 已有 ID + 固定偏好，可承载插件页面入口 |
| 输入区“+”菜单 | [composer-add-menu.tsx](../src/components/application/chat-composer/composer-add-menu.tsx) | “添加”组（文件、目标、计划）与“插件”组（`composerArtifacts`：文档、表格、演示、代码输出选择）；官方人物只保留文件 | “插件”分组名已存在，但内容是内置输出类型 |
| 输入区工具条 | [chat-home.tsx](../src/components/application/agent-chat/chat-home.tsx)、[contact-composer.tsx](../src/components/application/contacts/contact-composer.tsx) | 附件、权限、模型、发送；下层为模式、项目、联系人 | 控件密度已高，不开放任意按钮 |
| 模型菜单 | [composer-model-menu.tsx](../src/components/application/chat-composer/composer-model-menu.tsx) | 供应商图标栏 + 模型行，只列真实配置（设置 `models` 集合与运行中的服务） | 插件提供模型需要运行时，先不开放 |
| 命令面板 | [workspace-command-palette.tsx](../src/components/application/agent-chat/workspace-command-palette.tsx) | 分“对话 / 面板 / 设置”三段，每项调用与按钮相同的处理函数，关闭后焦点返回 | 天然的命令汇总处 |
| 设置分类 | [workspace-settings-catalog.ts](../src/components/application/settings/workspace-settings-catalog.ts) | `SettingsSection` 是固定联合类型；分组“工作区 / 智能与工具 / 桌面与设备 / 开发 / 应用” | 表单由 `ConfigurationField` 描述驱动，可复用给插件设置页 |

设置中已有三个与“扩展”相关的集合（[configuration-integrations.ts](../src/app/settings/configuration-integrations.ts)），都只保存本机配置、不执行：

- `plugins`（Cordis 插件）：DeepSeek Harness 插件的 Cordis 配置条目——名称、来源（本地绝对路径 / npm 包名）、模块、实例 ID、启用、YAML 配置，可导出为 `- insert:` 补丁（[cordis-plugins.ts](../src/app/settings/cordis-plugins.ts)）。它描述的是**运行时插件**（`apply(ctx)`），不是界面扩展。
- `extensions`（MCP 与连接器 / 技能目录）：工具来源。
- `hooks`（生命周期钩子）：事件 + 命令 + 超时。

宿主边界：Tauri CSP 为 `script-src 'self'`、无 `frame-src`，主窗口 capability 只有 `core:default`、拖动、最大化与 `dialog:allow-open`。也就是说，**当前构建不能加载任何不随应用打包的脚本**，第三方插件的自定义界面必须经过宿主改造才能出现（见“宿主边界”）。

## 扩展位清单

扩展位 ID 采用 `区域.种类`。每个扩展位都由宿主组件渲染，插件只提供声明（标题、图标、命令或视图入口）。“开放阶段”对应文末的落地顺序。

| 扩展位 ID | 位置 / 所属组件 | 插件可提供 | 约束 | 开放阶段 |
| --- | --- | --- | --- | --- |
| `workPanel.view` | 工作面板 PillTab，`ChatSidePanel` | 一个面板视图（标签 + 内容） | 视图 ID 进入 `WorkPanelView`；内置“历史”不可隐藏，作为失效视图的回退；关闭面板焦点回到“工作面板”开关 | 1（内置），2（声明式），3（自定义内容） |
| `command.palette` | 命令面板新增“插件”分段，`WorkspaceCommandPalette` | 命令（标题、图标、执行的宿主动作） | 执行沿用 `run()`：先关闭面板、焦点返回，再执行；不分配全局快捷键 | 1 |
| `settings.section` | 设置目录新增“插件”分组，`settingsGroups` | 一个设置页，字段用 `ConfigurationField` 描述 | 不能渲染任意组件；值保存在插件自己的命名空间并进入设置备份；不能读写其他分类 | 2 |
| `sidebar.destination` | 侧栏“更多”与底部悬浮栏，`SidebarMoreMenu` | 一个工作区页面入口（打开插件页面） | 可固定，固定 ID 与贡献 ID 一致；页面切换保持 AgentChat 挂载、会话与草稿不变 | 3 |
| `titlebar.action` | 标题栏动作区，`AgentChatActions` | 图标按钮：打开自己的面板视图或执行命令 | 每个插件最多一个；默认收在插件按钮弹层内，用户固定后才出现在标题栏 | 3 |
| `composer.add` | 输入区“+”菜单“插件”分组，`ComposerAddMenu` | 菜单项：向当前草稿附加一段上下文或选项 | 只改草稿，不发送；官方人物会话不显示；草稿含当前不可执行的项时沿用“阻止发送并说明原因” | 3 |
| `conversation.view` | 新建：对话区顶部的会话视图切换（对话 / 轨迹 / …） | 同一对话的另一种视图 | 以 `thread.id` 为输入，切换不新建对话、不改标题栏标签；“对话”固定第一且不可隐藏 | 4（需 Agent 运行事件） |
| `composer.model` | 模型菜单的供应商图标栏，`ComposerModelMenu` | 模型来源 | 必须由运行时确认可用后才列出，否则不出现在菜单 | 4（需运行时） |

刻意不开放的位置：

- **标题栏对话标签**：标签就是对话，插件视图放进去会让“关闭全部标签”“前进 / 后退”和侧栏对话列表的 ID 对不上。插件视图走 `workPanel.view` 或 `conversation.view`。
- **输入区工具条本身**（附件、权限、模型、发送、模式、项目、联系人）：位置有限，且都绑定发送前的校验；插件入口统一收进“+”菜单。
- **消息气泡内容与发送流程**：需要 Agent 运行时的消息与工具事件，留到运行时设计时一并决定。
- **登录页、账号菜单**：登录是独立应用页面，账号状态只来自真实服务。

### 所有扩展位共同遵守的约束

1. **ID 稳定。** 贡献 ID 为 `<插件 ID>/<本地 ID>`，例如 `nekopapa.core/history`。插件 ID 只含小写字母、数字、`-` 和 `.`；本地 ID 只含小写字母、数字和 `-`。升级插件不得改变已发布的本地 ID。内置内容注册为 `nekopapa.core`，但保留现有 ID 与存储键：工作面板视图仍是 `history` / `code` / `study` / 工具 ID，侧栏固定仍是 `space` / `knowledge` / `cabin`，由注册表登记别名，不迁移已保存的数据。
2. **焦点返回。** 菜单、弹层、命令面板执行后，焦点回到打开它的触发器，或交给被打开的面板；关闭插件视图时焦点回到所在容器的切换控件。沿用 React Aria 与现有组件的行为，不为插件另写焦点管理。
3. **真实的不可用状态。** 每个贡献声明 `requires`（如 `desktop`、`runtime.coding`、`backend.nekobuddy`）。宿主按实际探测结果计算可用性；不可用时仍显示条目，但呈现为禁用并写明原因，视图内容使用工作面板“资料”页的黄色 StatusDot 写法。插件不能自报“已连接”。
4. **失效回退。** 插件被停用、卸载或清单校验失败时，其贡献从扩展位消失；若当前正显示其视图，工作面板回到“历史”、会话视图回到“对话”，并用一次提示说明原因。用户的隐藏 / 排序 / 固定偏好保留，重新启用后恢复。
5. **视觉一致。** 标题与说明是纯文本；图标只能从 `app-icons` 已有的图标名中选择，不接受插件自带 SVG；颜色、字号由宿主组件决定。
6. **不阻塞宿主。** 注册表读取失败或某个插件出错，只影响该插件的贡献，工作台、联系人与设置照常可用。

## 用户调整

“由用户自己调整”在第一阶段就落地，并且同样作用于内置内容：

- 每个扩展位的条目可**隐藏**与**排序**；侧栏目的地与标题栏动作可**固定**。
- 偏好以贡献 ID 为键保存在本机 `nekopapa.slot-layout.v1`（拟定），格式 `{ [slotId]: { order: string[], hidden: string[] } }`；未知 ID 忽略但保留，读写失败时按默认布局显示且不影响本次操作——与 `nekopapa.sidebar-hidden.v1` 的处理一致。
- 侧栏固定继续使用 `nekopapa.sidebar-pins.v1`，插件目的地的固定值写入其贡献 ID；旧值不迁移。
- 入口：设置 → 插件 → “布局”页，以及各扩展位就地的右键菜单（“隐藏”“移到前面”）。不可隐藏的条目（“历史”“对话”）在界面上明确标出。

## 插件清单（manifest）草案

插件是一个文件夹，根目录放 `nekopapa-plugin.json`。以下字段为最小集合；`example.*` 仅用于说明格式，不会出现在客户端中。

```json
{
  "manifestVersion": 1,
  "id": "example.git-notes",
  "name": "Git 笔记",
  "version": "0.1.0",
  "description": "在工作面板里查看当前项目的 Git 笔记。",
  "engines": { "nekopapa": ">=0.2.0" },
  "permissions": ["project.read"],
  "requires": ["desktop"],
  "contributes": {
    "workPanel.view": [
      { "id": "notes", "title": "笔记", "icon": "notebook-pen", "content": { "kind": "status", "text": "需要 Coding 执行层，接入后显示当前项目的 Git 笔记。" }, "requires": ["runtime.coding"] }
    ],
    "command.palette": [
      { "id": "open-notes", "title": "打开 Git 笔记", "icon": "notebook-pen", "action": { "openView": "workPanel.view/notes" } }
    ],
    "settings.section": [
      { "id": "main", "title": "Git 笔记", "description": "笔记引用与显示方式。", "fields": [
        { "key": "ref", "label": "笔记引用", "type": "text", "control": "input", "initial": "refs/notes/commits", "maxLength": 200 }
      ] }
    ]
  },
  "runtime": { "cordis": { "module": "/Users/me/plugins/git-notes", "instanceId": "git-notes" } }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `manifestVersion` | 是 | 清单格式版本，当前草案为 `1`；未知版本拒绝加载并说明原因 |
| `id` | 是 | 插件 ID，全局唯一且不可变 |
| `name` / `version` / `description` | 是 / 是 / 否 | 显示用；`version` 为 semver |
| `engines.nekopapa` | 是 | 兼容的客户端版本范围；不满足时停用并说明 |
| `permissions` | 否 | 见下表；未声明的能力一律拒绝 |
| `requires` | 否 | 插件整体的前置条件，贡献项可再声明自己的 `requires` |
| `contributes` | 是 | 以扩展位 ID 为键的贡献列表；未知扩展位或当前阶段未开放的扩展位报告为“暂不支持”，不静默忽略 |
| `runtime.cordis` | 否 | 与设置中 Cordis 插件记录的关联，见下文 |

`content.kind` 分阶段开放：`status`（宿主渲染的说明 / 不可用状态，阶段 2）、`list`（宿主渲染、数据由插件经桥接返回，阶段 3）、`frame`（沙箱页面，阶段 3）。`action` 只能是宿主已有的动作：`openView`、`openSettings`（插件自己的设置页）、`openUrl`（经现有 `open_external_url` 在系统浏览器打开，需 `link.open` 权限），以及阶段 3 的 `invoke`（调用插件自己的命令处理）。

### 权限

| 权限 | 能力 | 宿主路径 | 开放阶段 |
| --- | --- | --- | --- |
| （无） | 声明贡献、读取自己的设置值 | 注册表、配置存储 | 2 |
| `link.open` | 在系统浏览器打开网址 | `open_external_url` | 2 |
| `chat.read` | 只读当前对话的消息文本 | 宿主桥接，按需提供，不给历史存储 | 3 |
| `chat.draft` | 向当前草稿追加文字或上下文项 | `ChatComposerState`，只追加、不发送 | 3 |
| `project.read` | 只读当前项目文件夹的列表、文件与 Git 状态 | 现有 `project_list_dir` / `project_read_file` / `project_git_status`，路径限定在项目内 | 3 |
| `network`、`shell`、`credentials` | 网络请求、执行命令、读取密钥 | 不开放；需要时由 Coding 执行层与其权限规则承担 | 不在本方案内 |

首次启用插件时，设置 → 插件页列出其权限与贡献，由用户确认；权限变化（升级后新增权限）需要重新确认，未确认前插件保持停用。

## 注册契约草案

领域归属按仓库约定：注册表、清单校验与布局偏好属于新领域 `src/app/plugins/`；组件通过 `src/hooks/use-plugin-slots.ts`（拟定）读取；各扩展位的宿主组件只负责呈现。接口草案（仅示意，名称以实现为准）：

```ts
type SlotId = "workPanel.view" | "command.palette" | "settings.section" | "sidebar.destination"
  | "titlebar.action" | "composer.add" | "conversation.view" | "composer.model";

type Capability = "desktop" | "runtime.coding" | "backend.nekobuddy";

interface Contribution {
  id: string;            // "<pluginId>/<localId>"，或内置别名如 "history"
  pluginId: string;      // 内置为 "nekopapa.core"
  slot: SlotId;
  title: string;
  icon?: AppIconName;    // 只能取 app-icons 中已有的名称
  requires?: Capability[];
  removable: boolean;    // false：不可隐藏（历史、对话）
}

type Availability = { state: "ready" } | { state: "unavailable"; reason: string };

interface SlotRegistry {
  /** 某扩展位的条目，已按用户布局排序、过滤隐藏项，并附带可用性。 */
  list(slot: SlotId): readonly (Contribution & { availability: Availability })[];
  /** 订阅插件启停、布局与能力探测结果的变化。 */
  subscribe(listener: () => void): () => void;
}
```

要点：

- **单一状态源。** 注册表是扩展位条目的唯一来源；工作面板、命令面板、设置目录不再各自维护硬编码列表，而是把内置条目登记为 `nekopapa.core` 的贡献。这是“移除旧路径”的要求，不能留下“内置一套 + 插件一套”两条处理路径。
- **类型兼容。** `WorkPanelView` 从固定联合类型改为“内置 ID | 贡献 ID 字符串”，`SettingsSection` 同理；内置 ID 保持原样，旧的视图记忆与设置打开调用无需迁移。
- **可用性在宿主算。** `Capability` 的值来自真实探测：`desktop` 看是否运行在 Tauri 宿主，`runtime.coding` 与 `backend.nekobuddy` 在对应服务接入前恒为不可用。
- **行数约束。** [agent-chat.tsx](../src/components/application/agent-chat/agent-chat.tsx) 当前 489 行，已接近 500 行档；扩展位的接入必须落在 `ChatSidePanel`、`WorkspaceCommandPalette` 等子组件和新 hook 中，不在 AgentChat 里叠加逻辑。

## 宿主边界（Tauri）

- **插件不碰 `invoke`。** 所有原生能力经宿主桥接，桥接按清单权限逐次检查；插件拿到的是结果，不是 Tauri 句柄。
- **清单读取。** 阶段 2 新增只读命令（拟定名 `plugin_manifest_read`）：从用户选择的文件夹读取并校验 `nekopapa-plugin.json`，返回规范化清单；不执行文件夹中的任何代码。文件夹选择沿用现有 `dialog:allow-open`。浏览器预览没有该能力，设置页显示“需要桌面应用”。
- **自定义界面需要沙箱。** 当前 CSP（`script-src 'self'`，无 `frame-src`）不允许加载插件脚本，这是有意的。阶段 3 若开放 `frame` 内容，方案是：Rust 注册专用协议（如 `nekopapa-plugin://<插件 ID>/`）只提供该插件文件夹内的静态文件并附带独立 CSP；主窗口 CSP 仅为该协议增加 `frame-src`；iframe 使用 `sandbox="allow-scripts"`（不含 `allow-same-origin`）；与宿主只通过 `postMessage` 桥接，消息按权限校验。主题 token 由宿主以 CSS 变量注入，插件页面不复制颜色值。该阶段需同时通过 `cargo check`、`cargo test` 与 `npm run desktop:build -- --debug`。
- **不新增窗口。** 插件视图只出现在主窗口的扩展位中；多窗口、原生快捷键和拖动区域不对插件开放。

## 与现有设置记录的关系

| 记录 | 描述的东西 | 与界面插件的关系 |
| --- | --- | --- |
| `plugins`（Cordis 插件） | 交给未来 Coding 执行层的 Cordis 配置条目 | 不合并。界面插件可在清单 `runtime.cordis` 中按 `module` / `instanceId` 指向一条 Cordis 记录；客户端在设置 → 插件页显示“关联的运行时插件：已保存 / 未保存”。执行层接入前，依赖它的贡献统一显示 `runtime.coding` 不可用 |
| `extensions`（MCP / 技能 / 连接器） | 工具来源配置 | 无直接关系；插件不能借界面扩展启动 MCP 或读取技能目录 |
| `hooks` | 运行事件命令 | 无关系；插件不注册钩子命令 |

界面插件的启用记录拟作为配置存储（`nekopapa.settings.v1`）中的新集合 `uiPlugins`，字段为插件 ID、清单路径、启用、已确认的权限、清单校验结果；由此复用现有的备份、恢复与损坏数据处理。插件自己的设置值存放在 `uiPluginSettings[<插件 ID>]`，按清单字段校验。现有的“插件与工具”弹层改为同时列出界面插件（名称、启用状态、贡献数）与 Cordis / MCP 配置，三者分节说明，不混为一类。

设置目录新增分组“插件”（拟定，位于“开发”之前）：固定页“插件管理”“布局”，其后是各已启用插件的 `settings.section`。现有的“开发 → Cordis 插件”保留原位置和 ID `plugins`。

## 分阶段落地

### 阶段 1：注册表与内置贡献（第一条端到端流程）

先做 **`workPanel.view`**，同时接入 `command.palette`。理由：

- 工作面板本来就按视图 ID 切换、隐藏后记住视图、有关闭与焦点返回，已有“资料”页的真实不可用状态写法，契约现成。
- [chat-side-panel.tsx](../src/components/application/agent-chat/chat-side-panel.tsx) 只有 82 行、职责单一，改动不触及消息流、发送与对话 ID。
- 不需要第三方代码、Rust 改动或运行时，就能验证注册表、ID 稳定、用户布局和失效回退这几条核心契约。

端到端流程（不新增插件，只用内置贡献）：

1. 新建 `src/app/plugins/`：注册表、贡献 ID 规则、布局偏好读写（`nekopapa.slot-layout.v1`）；`nekopapa.core` 登记“历史 / 代码 / 资料 / 工具”与命令面板的“面板”命令，ID 保持不变。
2. `ChatSidePanel` 与 `WorkspaceCommandPalette` 改为从注册表读取条目，删除原硬编码列表。
3. 用户在工作面板标签上右键“隐藏‘资料’”→ 标签消失；命令面板对应命令同步隐藏；重载后保持；设置 → 插件 → 布局可恢复。
4. 当前正显示被隐藏的视图时回到“历史”并提示；“历史”不可隐藏。
5. 布局存储不可读或写入失败时按默认布局显示，并提示本次未保存。

验证：注册表、ID 规则与布局读写的 Node 单元测试（损坏数据、未知 ID、写入失败）；工作面板旧行为回归（视图记忆、工具快捷键、关闭焦点）；浏览器中验证右键菜单、键盘操作与重载恢复；`npm run test`、`npm run build`、`git diff --check`。同步更新导航职责与设计系统文档。

### 阶段 2：本地清单与声明式贡献（桌面）

- 设置 → 插件 → “从文件夹添加”：桌面版经 `plugin_manifest_read` 读取并校验清单，展示权限与贡献，确认后写入 `uiPlugins`；校验失败逐项说明，不保存。
- 开放 `settings.section`（字段复用 `ConfigurationField` 与现有校验）、`workPanel.view` 的 `status` 内容、`command.palette` 的 `openView` / `openSettings` / `openUrl` 动作。
- 停用、移除、清单文件被删或改坏时的回退与提示。
- 验证追加 Rust 单元测试、`cargo check`、桌面调试构建中的真实文件夹选择；浏览器预览显示“需要桌面应用”。

### 阶段 3：沙箱视图与更多扩展位

- 专用协议 + iframe 沙箱 + `postMessage` 桥接，开放 `frame` / `list` 内容与 `chat.read`、`chat.draft`、`project.read` 权限。
- 开放 `sidebar.destination`（插件页面作为工作区页，可固定）、`titlebar.action`（默认收进插件弹层）、`composer.add`（只改草稿）。
- 每个扩展位单独一轮交付与验收，不一次全开。

### 阶段 4：依赖 Agent 运行时

- `conversation.view`：在对话区顶部加入“对话 / 轨迹 / …”视图切换；“轨迹”需要运行事件与投影（参照研究文档中 DeepSeek Harness 的“已提交事件 → 带水位读模型”）。没有事件来源前不加这条标签栏。
- `composer.model`：运行时确认可用的模型来源。
- `runtime.cordis` 关联生效：Coding 执行层接入后，界面插件与对应 Cordis 插件一同加载、一同停用。

## 待定问题

- 插件分发：只支持本地文件夹，还是也支持 npm 包或官方目录；签名与来源信任如何呈现。
- 同一插件的界面部分与 Cordis 运行时部分，是否约定放在同一个包内。
- `chat.read` 是否包含联系人对话；官方人物对话是否一律不向插件开放（倾向不开放）。
- 插件视图的国际化：清单是否支持多语言标题，与现有界面语言设置如何对应。
