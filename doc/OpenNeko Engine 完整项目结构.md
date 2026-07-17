# NekoPapa / OpenNeko Engine 项目结构

状态：当前目录说明与渐进式目标结构。本文替代“先创建完整愿景目录”的做法。

## 结构原则

1. 目录表达当前职责，不表达尚未实现的愿景。
2. 先拆接口和测试，再移动物理路径。
3. 每个持久状态只有一个 owner；UI、host、renderer 和 Core 不互相复制领域规则。
4. `NekoPapa` 是产品名，`OpenNeko Engine` 是引擎名，公开 C++ API 保留 `nna` 命名体系。
5. 运行时资产、产品原型、第三方供应商代码、生成物和发布物必须分开。
6. Frozen Legacy Qt 只做迁移取证，不是第二条开发主线。

## 当前受控目录

```text
Nekopapa/
├── app/
│   ├── control-desktop/       # 当前 Tauri + React 桌面入口
│   │   ├── src/               # React 页面、组件、bridge、全局样式
│   │   ├── src-tauri/         # Rust host、capabilities、icons、Tauri 配置
│   │   └── scripts/           # Native Stage sidecar 准备脚本
│   ├── live2d-stage/          # GLFW/Cubism Native 独立 sidecar
│   └── stage-desktop/         # Frozen Legacy Qt，当前缺少 qml/main.qml
├── engine/
│   ├── include/nna/core/      # NNA Core stub 公开类型
│   ├── include/nna/graphics/  # Cubism/OpenGL 公开适配类型
│   ├── src/                   # Core stub 与 Live2D Native 实现
│   └── third_party/           # Cubism SDK、GLEW、stb 供应商内容
├── protocol/stage/v1/         # Stage v1 草案、Schema、JSONL 示例
├── assets/                    # 当前运行时/开发模型和品牌图混放
├── img/                       # 未索引产品原型图，哈希文件名
├── cmake/                     # Live2D SDK CMake adapter
├── scripts/                   # 当前 macOS Tauri DMG 脚本
├── doc/                       # 规范、愿景、旧 Gitee/Qt 文档混放
├── build_*.{sh,bat}           # 旧 Qt 语义的根构建脚本
└── CMakeLists.txt             # Native Stage 默认 ON，Legacy Qt 默认 OFF
```

## 当前结构问题

| 路径 | 问题 | 先做什么 |
| --- | --- | --- |
| `app/control-desktop/src/App.tsx` | app shell 同时拥有导航、Stage 状态和页面通信 | 抽 page model 与 Stage feature port，保留 facade |
| `components/Live2DCompanion.tsx` | SDK、canvas、resize、input、状态 UI 混合 | 抽 Web Live2D adapter 与 React view |
| `src-tauri/src/stage.rs` | command、资源、进程、协议、状态混合 | 先用 module 拆分并注入 process driver |
| `app/live2d-stage/src/stage_runtime.cpp` | GLFW、协议、输入、渲染、health 混合 | 抽纯 v0/v1 codec 和 window/renderer port |
| `engine/CMakeLists.txt` | Core stub 与 Cubism adapter 共用 target | 先拆 CMake target，保持 include 兼容 |
| `app/stage-desktop/` | 约束过期、入口缺失但业务代码仍多 | Frozen、建立迁移 inventory，不继续开发 |
| `engine/third_party/` | 完整 SDK Samples/多平台库与业务树混在一起 | 建 manifest，确认最小 vendored surface |
| `assets/` | Vite publicDir 与 Tauri resource 边界不清 | 建 allowlist/asset manifest，清除包污染 |
| `img/` | 原型无语义名、索引、版本和页面映射 | 建 product prototype manifest 后再移动 |
| `doc/` | 当前规范、远期愿景和旧 Gitee/Qt 指南相互矛盾 | 标记 normative/product/legacy 状态 |
| 根 `build_*` | 文件名像默认入口，内容仍找 Legacy Qt binary | 隔离到 legacy scripts，当前入口单独命名 |

## 目标目录

目标目录只在对应实现和测试出现时创建。Phase 1 在原路径内拆 module；Phase 5 才做机械移动。

```text
Nekopapa/
├── .github/                         # GitHub issue/PR/CI/ownership 治理
├── app/
│   ├── control-desktop/
│   │   ├── src/
│   │   │   ├── app/                # composition、navigation、error boundary
│   │   │   ├── features/
│   │   │   │   ├── stage/          # 小屋与 Stage 用户意图
│   │   │   │   ├── conversation/
│   │   │   │   ├── memory/
│   │   │   │   ├── world/
│   │   │   │   ├── agent/
│   │   │   │   └── settings/
│   │   │   ├── integrations/
│   │   │   │   └── live2d-web/     # Pixi/Cubism Web adapter
│   │   │   ├── platform/
│   │   │   │   └── tauri/          # invoke/listen、DTO、browser fake adapter
│   │   │   └── shared/             # tokens、窄 UI primitives、无业务工具
│   │   ├── src-tauri/src/
│   │   │   ├── app.rs              # Tauri 装配
│   │   │   ├── commands/           # 输入校验与 DTO 映射
│   │   │   ├── stage/
│   │   │   │   ├── supervisor.rs   # 单一状态机
│   │   │   │   ├── process.rs      # real/fake child driver
│   │   │   │   ├── protocol.rs     # v0/v1 codec adapter
│   │   │   │   └── resources.rs    # bundled/dev resource resolver
│   │   │   └── window/             # 窗口状态与平台策略
│   │   └── tests/                   # host integration/fake sidecar fixtures
│   ├── live2d-stage/
│   │   ├── src/
│   │   │   ├── app/                # runtime loop 与 use case
│   │   │   ├── platform/glfw/      # window、input、DPI
│   │   │   ├── protocol/v0/        # 有删除条件的兼容 adapter
│   │   │   ├── protocol/v1/        # 严格 codec 与 session
│   │   │   └── render/             # NNA graphics adapter
│   │   └── tests/                   # options、codec、state、bounded process
│   └── stage-desktop/               # Frozen Legacy Qt，删除前保留 inventory
├── engine/
│   ├── include/nna/
│   │   ├── core/                    # 不暴露 Qt/Cubism/OpenGL
│   │   └── graphics/                # Native rendering public adapter
│   ├── src/
│   │   ├── core/
│   │   └── graphics/live2d/
│   ├── tests/
│   │   ├── core/
│   │   └── graphics/
│   └── third_party/
│       ├── README.md                # 来源、版本、许可、patch、用途
│       ├── manifest.lock
│       └── <minimum-vendored-set>/
├── protocol/
│   └── stage/v1/                    # 跨语言唯一协议事实源
├── assets/
│   ├── manifest.json                # ID、hash、license、bundle targets
│   ├── brand/                       # 产品品牌源资产
│   └── models/                      # 明确授权的 runtime/dev 模型
├── product/
│   └── prototypes/
│       ├── manifest.yaml            # 页面、viewport、状态、来源、日期
│       └── images/                  # 有语义文件名或 stable ID
├── tests/
│   ├── fixtures/stage-protocol/     # Rust/C++ 共用正反例
│   └── integration/                 # 跨进程与 package smoke
├── scripts/
│   ├── ci/                          # 本地/CI 共用检查入口
│   ├── package/                     # macOS/Windows 显式打包入口
│   └── legacy-qt/                   # 不作为默认入口
└── doc/
    ├── architecture/                # 规范性架构与 ADR
    ├── product/                     # 产品定义和原型索引说明
    └── legacy/                      # 历史 Qt/Gitee/旧流程，仅供参考
```

目标树不是一次性重构任务。不存在实现、owner、测试或已排期 Issue 的目录不得提前创建。

## 目标依赖图

```text
product prototypes ----> acceptance criteria / visual tests
                               |
                               v
React app -> feature -> port -> Tauri command/application service
    |                              |
    v                              v
Web Live2D adapter          Stage protocol adapter
                                   |
                                   v
                              Native Stage
                                   |
                                   v
                            nna::graphics adapter
                                   ^
                                   |
                              nna::core intent
```

允许：

- app shell 依赖 feature 公开入口；
- feature 依赖 platform port 和 shared primitives；
- Tauri service 依赖 protocol/resource/process port；
- Native Stage 依赖 `nna::graphics`；
- `nna::graphics` 依赖第三方 SDK 和 Core 的窄数据类型。

禁止：

- `nna::core` 依赖 Qt、Tauri、GLFW、Cubism、OpenGL 或 DOM；
- React feature 直接导入另一个 feature 的内部文件；
- JSX 中散落原始 `invoke`、`fetch` 或模型绝对路径；
- Native Stage 承担账号、网络、记忆或 Agent 业务；
- Frozen Legacy Qt 被新模块依赖；
- runtime code 读取 `product/prototypes`；
- 业务代码直接 include 供应商目录而绕过 CMake adapter。

## React 文件分层

每个 feature 使用“model/port/adapter/view”而不是按 `components/` 无限堆叠：

```text
features/stage/
├── model.ts          # StageStatus、view state、纯转换
├── port.ts           # feature 所需能力接口
├── controller.ts     # action 与异步状态编排
├── StagePage.tsx     # 页面组合
├── components/       # 仅 stage 私有 UI
├── stage.css         # feature 私有样式
└── *.test.ts(x)
```

`shared/` 只接收被至少两个稳定 feature 使用、且不包含业务语义的代码。不要为了减少文件数建立万能 `utils.ts`、`types.ts` 或 `ui.tsx`。

全局 CSS 只保留 reset、tokens、app shell 和真正共享 primitive。小屋、Agent、设置等 feature 样式由 feature 自己拥有；同一个 `.topbar`/`.app-shell` 不得在多个全局文件依赖 import 顺序覆盖。响应式规则与对应组件放在一起，关键 viewport 由自动测试保护。

## Rust 文件分层

Tauri command 是 transport adapter，不是业务服务：

```text
webview invoke
  -> command DTO validation
  -> application service
  -> StageSupervisor / WindowService / ModelService port
  -> platform adapter
```

- `lib.rs`/`app.rs` 只注册 plugin、state、commands 和 run events。
- 状态机与进程句柄放在同一 supervisor owner 下，避免多个 mutex 组成不一致快照。
- process driver 可替换为 fake，测试不依赖真实 Tauri window。
- protocol codec 返回 typed event，不把 stdout 字符串直接暴露给 UI。
- filesystem/resource resolver 只返回经过约束的 app 资源，不接受 UI 任意路径。

## C++ 与 NNA 分层

公开命名继续使用：

- `nna::core`：领域状态、规则、快照和高层意图；
- `nna::graphics`：Live2D Native 模型与渲染适配；
- `openneko::stage`：Native Stage 进程内部实现；
- `nna_*`：未来稳定 C ABI 函数前缀，需 ADR 和版本策略后启用；
- `NNA_`：编译期开关和公开宏。

先拆 CMake target，再决定是否移动 include：

```text
openneko_core            # 无 Cubism/OpenGL/Qt
openneko_live2d_native   # Cubism/OpenGL adapter -> openneko_core types
openneko_live2d_stage    # GLFW/process app -> live2d_native
openneko                 # 迁移期兼容 facade，设删除期限
```

不要为远期 ODE、dream、IoT、plugin、XR 等愿景批量创建空目录。它们在 GitHub Issues/研究文档中排期，只有出现最小公共契约、owner 和测试时才进入源码树。

## Protocol 分层

`protocol/stage/v1/` 是跨语言唯一事实源：

- schema 和 fixtures 由 Rust/C++ 共同消费；
- 生成的 binding 必须有确定命令，并在 CI 重生成后保持 clean diff；
- v0 adapter 与 v1 类型分目录，不在同一个 parser 中通过别名猜测；
- breaking change 新建 major 目录；compatible change 也要协商版本；
- protocol 不包含 UI 文案、shell 命令、token 或模型绝对路径。

## 运行时资产与产品原型

### Runtime assets

`assets/manifest.json` 至少记录：

- stable asset ID 和版本；
- 相对源路径与 SHA-256；
- `webview`、`native-stage`、`brand` 等打包目标；
- development-only 或 release；
- owner、来源、许可和 notice；
- 模型/SDK 兼容版本。

Vite 和 Tauri 从 manifest 生成 allowlist。禁止把 `../../assets` 整目录当 publicDir，也禁止同一模型无记录地复制到 WebView 与 resource 两处。

### Product prototypes

当前 `img/` 迁移前先建立 manifest，字段至少包括：

- prototype ID、页面/流程、版本和状态；
- desktop viewport、平台 chrome 和缩放规则；
- 图片路径、来源、创建日期和 owner；
- 对应 Issue/验收标准；
- `reference`、`approved-baseline` 或 `deprecated`。

原型不进安装包。视觉基准更新必须说明对应产品决策，不能因为当前实现截图不同就覆盖原型。

## 第三方边界

`engine/third_party/` 不是普通源码目录：

- 记录供应商、版本/commit、下载来源、许可证、补丁、使用 target 和所需平台；
- 优先只保留构建所需文件，SDK Samples 和无关平台二进制不默认 vendored；
- 供应商源码不做格式化和业务修改；必要 patch 存在独立 patch 目录并可重放；
- CMake 用 imported/interface target 暴露依赖，业务代码不硬编码版本目录；
- Live2D SDK、Core 和示例模型遵守各自许可，不能被根 Apache-2.0 覆盖；
- release job 生成 third-party notice 和安装包内容清单。

是否改用 FetchContent、系统包、Git submodule 或受控下载必须通过 ADR；不能为了缩小仓库而破坏离线构建或许可要求。

## 生成物和发布物

永不作为源码提交：

- `build/`、`build-*/`、`dist/`、`target/`、`node_modules/`；
- Tauri sidecar binary、DMG/MSI/AppImage、签名材料、notarization 输出；
- `.gradle/`、IDE cache、`.DS_Store`、临时截图和崩溃 dump。

可受控的生成文件必须同时满足：

- 有单一源文件和确定生成命令；
- consumer 在 checkout 后确实需要它；
- 目录 README 标明 generated，不允许手改；
- CI 重生成并要求 working tree 无 diff。

Tauri capability schema 和多尺寸 icon 属于“需要明确生成策略”的文件，不等于可以随意删除。sidecar binaries 和 package outputs 始终不受控。

本地 `release/` 是可清理输出，不是安装包历史数据库。正式包、checksum、manifest 和 provenance 由 GitHub Release/受控制品库保存，并配置明确保留期。

## 文件拆分触发器

不设置为了数字好看的机械行数上限。满足任一条件就应拆分：

- 同一文件跨越两个运行时/权限边界；
- 纯逻辑必须启动窗口、GPU、网络或子进程才能测试；
- change reason 同时包含协议、平台、渲染和 UI；
- 类型由顶层 app 或具体组件反向提供给通用组件；
- 多个全局样式文件靠 import 顺序覆盖同一 selector；
- 新平台需要在公共流程中继续增加大段条件编译；
- review 无法为文件指定一个明确 owner。

拆分时保留 facade 和行为测试，先改变依赖，再机械移动；不要把一次 PR 变成重命名、重构和新功能的混合提交。

## 分阶段迁移

| 阶段 | 动作 | 禁止同时做 |
| --- | --- | --- |
| 0 治理 | 文档、owner、Issue、CI、manifest、入口命名 | 改产品行为 |
| 1 模块化 | 原路径抽 port/adapter/state 与测试 | 顶层目录大搬家 |
| 2 协议 | v1 垂直切片、共享 fixtures | 添加未定义业务消息 |
| 3 功能归属 | 从 Qt 逐项迁移到唯一 owner | Qt/Tauri 双写 |
| 4 target 拆分 | Core 与 graphics CMake target 解耦 | 删除兼容 facade |
| 5 目录收敛 | 机械移动、资产/原型/脚本归位 | 顺便重写功能 |
| 6 legacy 删除 | 删除 Frozen Qt 与过期脚本 | 未完成回滚观察期 |

完整退出条件见[迁移计划](architecture/qt-to-tauri-migration.md)与[构建门禁](architecture/build-and-test-gates.md)。

## 文档归属

- `doc/architecture/`：规范性、会阻塞不合规实现；
- `doc/product/`：产品定义、页面状态和 prototype 索引；
- `doc/legacy/`：旧 Qt、Gitee 和过期流程，只提供历史背景；
- 研究愿景：明确标注未实现，不能自动生成源码目录或 GitHub milestone。

文档必须包含状态；发生冲突时，当前源码证据和 `doc/architecture/` 中已接受 ADR 优先于 legacy/愿景文档。发现事实漂移时，先修文档或在 PR 中明确阻塞，不继续复制错误结构。
