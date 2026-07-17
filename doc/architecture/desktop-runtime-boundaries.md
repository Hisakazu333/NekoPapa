# NekoPapa 桌面运行时边界

状态：当前事实与目标决策。发布成熟度：未达发布门禁。

## 结论

NekoPapa 保留四个明确边界：

1. React/WebView 负责主窗口展示、交互和短生命周期 UI 状态。
2. Tauri/Rust host 负责应用、窗口、权限、资源寻址和 Native Stage 子进程生命周期。
3. Native Stage 负责独立透明桌宠窗口、输入穿透和 Cubism Native 帧循环。
4. NekoCore-Nano 最终负责可持久、可同步的同伴领域状态和高层行为意图。

渲染器可以保存 GPU、当前帧和插值等局部状态，但不能成为第二个同伴领域模型。WebView 和 Native Stage 是两个独立渲染面，不能用原生窗口覆盖 WebView 来伪装嵌入式画布。

## 当前实现图

下面是当前源码能证明的调用关系，不是目标完成声明：

```text
React App
  |-- bridge/stage.ts --> Tauri commands
  |                         |
  |                         v
  |                    StageSupervisor
  |                         |
  |                         v
  |                    Native Stage sidecar
  |                         |
  |                         v
  |                    Live2DRenderer --> Cubism Native / OpenGL
  |
  `-- Live2DCompanion --> Pixi.js / Cubism Web
```

`Frozen Legacy Qt -> NNAEngine stub / private Core adapter / Qt services` 只表示仓库中仍有隔离的历史源码；默认 CMake 与当前 Tauri 入口都不会启动这条路径。

当前限制：

- `app/control-desktop/src/App.tsx` 同时承担页面选择、Stage 生命周期状态和页面编排。
- `app/control-desktop/src/components/Live2DCompanion.tsx` 同时承担 SDK 加载、Pixi 生命周期、布局、输入和错误 UI。
- `app/control-desktop/src-tauri/src/stage.rs` 同时承担资源寻址、进程监督、v0 流转发和 Tauri command。
- `app/live2d-stage/src/stage_runtime.cpp` 同时承担 GLFW、输入、渲染循环、健康检查和 v0 协议解析。
- `engine/CMakeLists.txt` 把 `engine_stub.cpp` 与 Live2D/Cubism 适配代码编进同一个 `openneko` target。
- Native Stage 当前只调用 `nna::graphics::Live2DRenderer`，没有调用 `nna::core::NNAEngine`；领域状态统一尚未接通。
- React 页面中的天气、身体状态、日程、对话、记忆、世界和 Agent 数据多数仍是原型状态。

## 目标运行图

```text
React feature UI -- user intent --> Tauri application service
React feature UI <-- view state --- Tauri application service
                                          |
                                          | domain command through chosen Core port
                                          v
                                         NekoCore-Nano
                                          |
                                          | immutable snapshot / presentation intent
                                          v
                              Tauri service / presentation adapters

Tauri application service -- Stage lifecycle v1 --> Native Stage
NekoCore-Nano -- future explicit render-intent contract -->
            Web Live2D adapter / Native Stage renderer
```

目标图表达依赖方向，不要求 Tauri 必须把 Core 链接进同一进程。Core 可以通过经过 ADR 选择的稳定 C ABI、进程协议或受控库边界接入，但 UI 和渲染器只能消费快照与高层意图。Stage Protocol v1 当前只负责生命周期；图中的 render-intent contract 是未来边界，必须另行 ADR 和版本化，不能塞入 v1 未声明字段。

## 所有权矩阵

| 模块 | 拥有 | 不得拥有 |
| --- | --- | --- |
| React app shell | 页面编排、错误边界、全局短生命周期 UI 状态 | 领域规则、文件系统、子进程句柄 |
| React feature | 单一业务视图、表单草稿、用户意图 | Tauri `invoke` 字符串散落、其他 feature 内部状态 |
| Web Live2D adapter | Web SDK 加载、canvas、DPR/resize、Web hit test、渲染局部插值 | 账号、记忆、Agent、Native window 状态 |
| Tauri application service | commands/events、资源路径、权限、窗口与子进程生命周期 | Live2D 每帧渲染、同伴生理或情感规则 |
| Stage protocol adapter | 版本协商、消息校验、关联 ID、超时与错误映射 | UI 文案、shell 命令、任意资源路径 |
| Native Stage | 透明顶层窗口、穿透、输入、帧循环、Native renderer | 主窗口 UI、账号、网络业务、持久领域状态 |
| `nna::core` | 同伴状态、确定性规则、快照和高层意图 | Qt、Tauri、DOM、GLFW、Cubism、OpenGL |
| `nna::graphics` | Cubism Native 模型与渲染适配 | 账号、同步、记忆和产品流程 |
| Frozen Legacy Qt | 迁移取证和历史行为参考 | 新功能、发布入口、新协议所有权 |

## 依赖规则

### React

- `app` 可以组合 `features`、`integrations`、`platform` 和 `shared`。
- `features/<name>` 只能通过公开 port 使用 Tauri 或服务，不能直接导入另一个 feature 的内部文件。
- Tauri command 名、原始 payload 和浏览器模拟只能存在于 `platform/tauri` 适配层。
- Live2D SDK 类型和全局变量只能存在于 `integrations/live2d-web`。
- 共享类型不能从 `App.tsx` 或具体组件反向导出；页面 ID、Stage 状态和 Live2D 状态应由各自的 model/contract 模块拥有。
- 重型渲染依赖按 feature 激活时动态加载，隐藏页面必须停止不必要的渲染循环。

### Tauri/Rust

- `lib.rs` 只做应用装配；command handler 只做输入校验、调用服务和 DTO 映射。
- Stage supervisor、协议 codec、资源解析和进程 driver 必须能分别测试。
- 进程状态只能由一个状态机拥有；“进程已 spawn”不能自动等同于“Stage ready”。
- stdout 只进入协议解析器，stderr 只进入日志通道；未经校验的 sidecar 文本不能成为 UI 状态。
- 窗口状态模块保持独立，纯几何和校验逻辑不依赖真实窗口即可测试。

### Native Stage/C++

- `main.cpp` 只处理 CLI、装配和退出码。
- GLFW window/input、协议解析、渲染器和运行循环通过窄接口组合。
- v0 兼容逻辑固定在 `protocol/v0`，不得继续向核心运行循环扩散；v1 必须严格拒绝未知字段和未知版本。
- `nna::core` 不包含 Cubism/OpenGL 头文件；`nna::graphics` 可以依赖 Core 的只读意图类型，Core 不反向依赖 graphics。
- 平台实现放在平台适配层，公共逻辑不使用 `#ifdef` 承担产品状态分支。

## 主窗口与桌宠窗口

主窗口 Live2D 使用 WebGL canvas，原因是它必须遵守 DOM 的裁剪、圆角、层叠、滚动、透明度和输入规则。Native Stage 是独立顶层窗口，只负责桌面陪伴场景。

禁止把 Native Stage 定位在 WebView 上方模拟嵌入，原因包括：

- WebView 与原生窗口属于不同合成和输入层；
- CSS clipping、transform、opacity 和 backdrop filter 不能约束原生窗口；
- 窗口缩放、移动、DPI 和多屏会引入持续几何同步；
- 自动截图、焦点和命中测试会看到不同窗口栈。

## 状态与事件方向

```text
用户输入 -> application command -> NekoCore-Nano
NekoCore-Nano -> immutable snapshot / presentation intent -> UI 或 renderer
```

React 可以保存选中标签、输入草稿和面板展开状态；renderer 可以保存纹理、当前帧和插值；Tauri 可以保存子进程 PID 和协议会话。账号、记忆、关系、身体状态和 Agent 执行状态必须有唯一权威来源。

当前原型值必须显式标记为 fixture、preview 或 simulated，且不能写回真实存储。接入真实服务时先定义 port 与 DTO，再替换 adapter，不在 JSX 中直接增加 `fetch` 或散落 `invoke`。

## 协议与安全边界

- Tauri 只启动安装包内允许的 Stage sidecar，不接受任意可执行路径。
- 交互协议使用 stdin/stdout JSONL；不增加未认证 localhost 控制端口。
- v1 首条消息必须握手，ready 前不得发送生命周期命令。
- 协议不携带 shell 命令、账号 token、私有模型绝对路径或任意文件内容。
- 子进程退出、EOF、畸形消息、超时和父进程退出必须有确定状态转换。
- Tauri capability、CSP、sidecar 参数和资源 allowlist 必须进入安全门禁。

## 资产、原型和第三方边界

- `assets/` 只放运行时或安装包确实需要的资产；Vite 与 Tauri 使用显式 allowlist，不能复制整个仓库资产目录。
- `img/` 是产品原型输入，不是运行时资源。48 张当前资产由[产品原型基线](../product/prototype-baseline.md)索引；目标位置和 manifest 见[项目结构](repository-layout.md)。
- Web 与 Native 共用模型时，必须有一个资产 manifest 记录 ID、版本、哈希、用途、许可和打包目标。
- `engine/third_party/` 是供应商边界。业务代码不得修改第三方源码；补丁、版本、来源和许可单独登记。
- SDK Samples、无关平台二进制、生成缓存和 `.DS_Store` 不得进入发布包。

## 当前明确非目标

- 不把 Frozen Legacy Qt 恢复为第二条产品主线。
- 不在目录尚未有实现时批量创建愿景模块空壳。
- 不把 Native Stage 叠在 WebView 上。
- 不通过 JSONL 传输逐帧画面、音频或大块模型文件。
- 不把 Pixi/Cubism Web 与 Cubism Native 的像素完全一致作为要求；要求的是同一领域状态下行为不矛盾。
- 不以单机编译成功替代跨平台运行、安装包、许可和回滚证据。
