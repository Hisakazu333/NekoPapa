# NekoPapa 构建与测试门禁

状态：规范性验收标准。CI 实现与各平台绿色记录必须由仓库实时状态证明。

## 证据等级

| 等级 | 含义 | 不能替代 |
| --- | --- | --- |
| Source-reviewed | 只检查源码、配置和依赖方向 | 编译或运行 |
| Static-verified | format、lint、type/schema、依赖和仓库卫生通过 | 二进制运行 |
| Build-verified | 在命名 OS/架构的干净 checkout 编译成功 | 真实窗口/模型 |
| Runtime-smoke-tested | 启动进程并证明指定行为 | 安装与升级 |
| Package-verified | 安装包内容、签名或校验和及干净账户安装通过 | 全量发布 |
| Release-verified | 所有适用门禁、许可、回滚和多平台证据通过 | 后续版本继续有效 |

每份 Issue、PR 和发布记录必须写明最高等级、提交号、OS、架构、真实模型或 `allow-no-model`。macOS 结果不证明 Windows；浏览器 preview 不证明 Tauri；health check 不证明长期交互。

## 审计基线与已知缺口

基线提交：`6d575bf`。以下是该提交可从源码证明的事实，后续只能用 CI 运行或新审计更新：

| 区域 | 基线事实 | 缺口 |
| --- | --- | --- |
| Git | `HEAD == origin/main` 且有正常 merge base | 分支保护、CODEOWNERS 和 required checks 未由源码证明 |
| React | 有 TypeScript check 和 production build script | 无 ESLint、unit test、component/viewport test |
| Window shell | Tauri 使用原生标题栏，React 已移除自定义窗口按钮 | 无跨平台 titlebar/导航 geometry 自动验收 |
| Rust | 有 fmt/clippy/test 命令说明；`window_state.rs` 有纯逻辑测试 | Stage supervisor、协议和进程失败路径无测试 |
| Protocol | 有 v1 JSON Schema 和示例 | 无自动 schema/JSONL 正反例校验，无端到端 v1 |
| C++ | Native Stage 和 Live2D target 可配置 | 无 CTest；Stage runtime 职责集中；无 Windows CI 证据 |
| Package | 有本机 macOS DMG 脚本 | 无签名、公证、Windows installer、干净机器验证和内容 allowlist 门禁 |
| Hygiene | 常见 build/target/dist 已忽略，48 张原型已有 Markdown 基线 | 受控树仍有 12 个 `.DS_Store`、18 个 Cubism 示例 `.gradle` 缓存、完整 SDK Samples 和大量第三方内容 |

治理 PR 新增 workflow 后，只有 workflow 在目标分支真实运行通过，才能把对应项从“缺口”改为“已验证”。

当前治理配置定义的 CI job ID 是 `repository-hygiene`、`frontend`、`rust-host` 和 `native-stage`。在 GitHub 真实运行前，它们仍只是 Static-verified 配置；`docs`、`protocol`、`cpp-core`、integration 和 `package-smoke` 是本文件要求补齐的门禁契约，目前不能当作已有 job。每个契约进入 required checks 前必须有固定仓库脚本或 job ID、预期 artifact 和机器可判断的成功条件。

## PR 必需检查

### 1. `repository-hygiene`

所有 PR：

当前 job 调用 `scripts/check-new-repository-junk.sh`，拒绝相对目标分支新增或修改的
常见生成物、本机文件、安装包、sidecar 和秘密文件，执行 `git diff --check`，并
确认 npm/Cargo lockfile 存在。它不会自动清除基线已经跟踪的 `.DS_Store`，也不等于
下面的完整资产与供应链门禁已经实现。

- 禁止受控的 `.DS_Store`、`.gradle/`、`build/`、`dist/`、`target/`、sidecar binary、安装包和签名材料；
- 锁文件、manifest、capability 和必要生成 schema 的跟踪策略明确；
- 新增二进制资产有 owner、来源、哈希、用途、许可和体积说明；
- `img/` 或目标 prototype 目录中的新图必须登记到 manifest，禁止只有哈希文件名而无产品语义；
- 第三方版本、来源和许可发生变化时必须更新 notice/manifest；
- 检查 Git diff 中的秘密、绝对本机路径和不允许的供应商文件修改；
- 单文件或产物体积超预算时阻塞，预算通过 ADR 或仓库规则维护。

### 2. `docs`

触及文档、命令、目录、公开行为或架构边界时：

- Markdown 相对链接和锚点可解析；
- 文档中的路径在“当前目录”语境下真实存在，目标路径明确标为目标；
- shell 命令通过语法检查，平台专用命令有平台标记；
- 根中英文 README 的产品状态保持一致；
- 架构变更附 ADR 或说明为什么不需要 ADR；
- 不允许把 prototype、stub、schema 或本机编译写成已发布功能。

### 3. `frontend`

触及 `app/control-desktop/src/**`、前端配置或前端依赖时：

现有必跑命令：

```bash
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run check
npm --prefix app/control-desktop run build
```

治理目标必须补齐并设为 required：

- ESLint，包含 React hooks、可访问性和架构 import 规则；
- unit/component tests，覆盖 model、adapter、错误和 cleanup；
- 关键 viewport screenshot/DOM 检查，至少覆盖最小窗口、标准窗口和宽窗口；
- Live2D host resize/DPR、隐藏暂停、加载失败与 retry；
- bundle report 和预算，Pixi/Cubism 等重型模块必须保持可分析的动态加载。

截图差异只对经过确认的产品基准更新；更新基准必须附 `img/` 原型或产品决策来源。

### 4. `rust`

触及 `app/control-desktop/src-tauri/**` 时：

```bash
cargo fmt --manifest-path app/control-desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path app/control-desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml
```

Tauri 的 `externalBin` 会在 Rust 编译期检查 target-triple 对应文件是否存在。Rust-only CI 可以在被忽略的 `src-tauri/binaries/` 中创建当次任务专用 placeholder，以解除这项资源存在性检查，但必须满足：

- placeholder 只存在于临时 runner，不提交、不缓存、不上传为 artifact；
- 使用 placeholder 的 job 最高只提供 Rust static/test 证据；
- placeholder 不算 Native Stage build、架构、协议、runtime 或 package 证据；
- `native-stage` matrix 必须从 C++ 源码构建真实 binary；integration/package job 必须重新 stage 真实 binary，并核对架构、hash 和 health/协议行为。

必须覆盖：

- window state 校验、DPI 转换、离屏恢复和原子写；
- Stage 状态机从 stopped 到 starting/ready/stopping/error 的合法转换；
- fake child process 的 spawn、stdout/stderr、EOF、超时、crash 和 forced cleanup；
- bundled/development 资源解析和缺失资源；
- protocol codec 对未知版本、未知字段、错误 ID 和畸形 UTF-8/JSON 的处理；
- command DTO 不把未经校验的 sidecar 文本作为 UI 状态。

### 5. `protocol`

触及 `protocol/**`、Rust/C++ protocol adapter 或 Stage 生命周期时：

- 所有 schema 符合 JSON Schema 2020-12；
- 每个 JSONL 正例逐行校验；
- 维护 malformed JSON、unknown property/type/version、空/重复 ID、错误 `reply_to` 的反例；
- Rust 和 C++ 使用同一 fixture corpus；
- stdout 只包含协议 JSONL，stderr 只包含日志；
- handshake、ready、show/hide/passthrough/shutdown、health、stopped 和 error 有正反测试；
- EOF、父退出、子退出和超时有确定结果；
- 生成 binding 时 CI 重生成并要求 working tree 无 diff。

v0 宽松 alias 只能存在于显式 v0 adapter。v1 不允许 best-effort coercion。

### 6. `cpp-core`

触及 `engine/include/nna/core/**` 或 Core 实现时：

- macOS Clang 与 Windows MSVC 的 configure、build、CTest；
- 编译器 warnings 作为 errors，第三方 target 单独抑制；
- Core-only 配置不发现 Qt、Cubism、OpenGL 或 GLFW；
- 领域状态转换、范围、时间步长、序列化/C ABI（启用后）有确定性 unit test；
- public header compile test 证明消费者只包含公开 include 即可使用；
- ABI/公开类型变更需要 ADR、版本策略和兼容说明。

### 7. `native-stage`

触及 `app/live2d-stage/**`、`nna::graphics` 或 Live2D CMake adapter 时：

要求矩阵：

| 平台 | Build | 有界 runtime |
| --- | --- | --- |
| macOS Apple Silicon | clean Release | health event；真实模型任务另记 |
| Windows x64 | clean Release | health event；真实模型任务另记 |

每次记录编译器、SDK、CMake、GLFW、Cubism、GPU/renderer、Stage 与依赖架构、首个 OpenGL 错误和退出码。

Runtime 必测：

- 透明窗口启动无明显不透明闪烁；
- always-on-top 与设置一致；
- passthrough 可开启且可恢复控制；
- resize、DPR、多屏和混合 DPI 不拉伸、裁切或偏移输入；
- show/hide/close/parent exit 不留孤儿进程；
- hidden/iconified 降低不必要帧循环；
- sleep/wake、锁屏和显示器重连有可诊断结果；
- crash 上报和 restart 有界。

无模型 health 成功只能证明窗口/renderer 初始化；不能写成模型加载成功。

### 8. `package-smoke`

PR 可运行无签名 smoke package；受保护 release job 才可使用签名、公证秘密。

安装包内容门禁：

- 恰好包含目标 app、目标架构 sidecar、必要运行时资产和第三方 notices；
- 不含 SDK Samples、无关平台库、源码、`.DS_Store`、debug symbols、缓存、私有路径和未登记模型；
- 产品名、bundle ID、应用版本、sidecar 协议版本和 checksum 可追溯；
- Vite 资产与 Tauri resource 不因宽泛目录复制而意外重复；
- 构建日志输出 manifest 与 SHA-256，并作为 CI artifact 保存。

## CI 分层与路径触发

建议将 required checks 分成快速层和平台层：

| 层 | 检查 | 触发 |
| --- | --- | --- |
| Fast | repository-hygiene、docs、frontend static/test、Rust fmt/clippy/test、protocol | 所有相关 PR |
| Native | cpp-core、native-stage build/CTest | C++、CMake、protocol、third-party 相关 PR；macOS + Windows |
| Integration | fake/real sidecar integration、bounded runtime | host、Stage、protocol 相关 PR |
| Package | unsigned package manifest/content smoke | 桌面、资源、打包脚本相关 PR |
| Release | 签名、公证、安装/升级/卸载、真实模型和回滚 | 受保护 tag/manual release |

路径过滤只能减少无关平台任务，不能跳过跨边界变更。例如 protocol 变更必须同时触发 Rust、C++ 和 protocol jobs；模型 manifest 变更必须触发 frontend、Stage、license 和 package jobs。

## 发布门禁

### macOS

- app、sidecar 和嵌套库签名链验证；
- hardened runtime、entitlements、公证和 stapling；
- Apple Silicon 干净账户安装、首次启动、升级、退出和卸载；
- Gatekeeper 下无隔离、动态库或资源路径错误。

### Windows

- app、sidecar、DLL 和 installer 签名验证；
- x64 干净机器安装、首次启动、升级、退出和卸载；
- WebView2 前置或 fixed runtime 策略有文档和测试；
- 安装目录无开发 SDK 与无关架构。

### 共同要求

- 真实授权模型运行与 `allow-no-model` 分别记录；
- 安装包 checksum、SBOM/依赖清单、第三方 notice 和源码提交绑定；
- Stage crash、协议不兼容和资源缺失有用户可诊断路径；
- 已验证上一版本安装包和数据迁移/回滚步骤可用；
- release notes 明确未实现、禁用或仅为 prototype 的功能。

## 晋级规则

- 开发 PR：所有适用 required checks 通过。
- 合并到受保护主分支：Fast、Native 和适用 Integration/Package checks 通过并完成 review。
- Preview package：至少达到 Package-verified，明确未签名/未公证限制。
- Public release：macOS 与 Windows 的所有适用门禁、许可和回滚证据通过。
- 删除 Frozen Legacy Qt：除上述门禁外，还需满足[迁移计划](qt-to-tauri-migration.md)中的 Phase 6。

任何失败的强制门禁都阻止晋级，不能以“已知问题”隐藏在 aggregate success 后面。
