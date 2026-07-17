# Nekonano-Aether (NNA) 开发规范

状态：现行工程规范

最后核对：2026-07-18

NNA 是 NekoPapa 与 OpenNeko Engine 的工程身份。它通过可验证的边界、命名和
协作方式体现，不通过给所有文件机械添加前缀体现。

## 1. 当前技术基线

| 层 | 当前技术 | 语言/标准 | 所有权 |
| --- | --- | --- | --- |
| 产品 UI | React + Vite | TypeScript | 页面、组件、样式和 Cubism Web |
| 桌面 Host | Tauri 2 | Rust 2024 | 窗口、权限、sidecar 和应用生命周期 |
| Native Stage | GLFW + OpenGL + Cubism Native | C++17 | 独立透明桌面角色窗口 |
| Engine | OpenNeko Engine | C++17 | 可复用领域/渲染能力和 NNA 公共 API |
| 进程协议 | JSONL + JSON Schema | Stage v0 / v1 草案 | Host 与 Stage 的版本化契约 |
| Legacy | Qt/QML | 冻结参考 | 不接受新产品功能 |

不得把旧文档中的 C++20、默认 Qt/QML、Gitee 或 `dev` 分支规则当作当前基线。
升级语言标准必须以独立 PR 证明工具链、依赖和平台矩阵。

## 2. 架构原则

依赖方向为：

```text
React UI -> typed bridge -> Tauri host -> supervised Native Stage
                                      -> Engine public API (when wired)
```

- UI 表达状态和用户意图，不拥有进程、权限或长期领域状态。
- Tauri 是桌面能力与权限边界，负责输入校验、窗口和子进程生命周期。
- Native Stage 负责独立窗口和逐帧 Native 渲染，不承载账户、聊天或设置业务。
- Engine 不依赖 React、Tauri 或 Qt；公共能力通过稳定接口暴露。
- Cubism Web 与 Cubism Native 是两个渲染面，不能把 Native 窗口伪装成 DOM 子元素。
- 新跨层调用先定义 owner、失败语义和测试，再添加 convenience API。

完整边界见 [桌面运行时边界](architecture/desktop-runtime-boundaries.md)。

## 3. NNA 命名规则

### C++

- `engine/` 新公共 API 使用 `nna` 及语义子命名空间，例如 `nna::core`、
  `nna::graphics::live2d`。
- 构建开关、导出宏和编译宏使用 `NNA_`，例如 `NNA_ENABLE_LIVE2D`。
- 类型使用 `PascalCase`，函数和局部变量遵循所在模块的既有风格。
- 不要求类名机械添加 `NNA`，命名空间已经承担冲突隔离。
- Native Stage 中现存 `openneko::stage` 是迁移中的实现命名；新增跨模块公共 API
  不应继续扩大该例外。重命名需要独立、可构建的重构 PR。

### Rust 与 TypeScript

- Rust module/function 使用 `snake_case`，type/trait 使用 `PascalCase`，按
  `rustfmt` 和 Clippy 执行。
- React component/type 使用 `PascalCase`，hook 使用 `use*`，变量和函数使用
  `camelCase`。
- 文件名遵循所在目录现状：React component/page 用 `PascalCase.tsx`，bridge 和
  工具模块用小写语义名。
- 不在 Rust/TypeScript 标识符中强制添加 `NNA`；只有稳定产品协议、构建配置和
  对外工程身份使用该前缀。

### Git

工作分支必须保留 NNA 前缀：`feat/nna-*`、`fix/nna-*`、
`refactor/nna-*`、`docs/nna-*`、`test/nna-*`、`chore/nna-*` 或
`hotfix/nna-*`。

## 4. React 与界面

- `pages/` 负责页面组合；可复用交互放入 `components/`；桌面调用集中在
  `bridge/`。
- 页面不能直接调用任意 shell、拼接 sidecar 参数或假定浏览器模拟状态等于真实
  Tauri 状态。
- 共享状态必须有明确 owner。不要在多个页面分别轮询和改写同一桌面状态。
- resize/drag 热路径避免同步布局抖动、重复创建渲染器和无界事件监听；卸载时清理
  observer、timer、animation frame 和 Cubism 资源。
- 固定设计画布必须定义设计尺寸、缩放策略、最小窗口和不随缩放移动的 window
  chrome。顶部导航、系统窗口控件和页面内容的坐标系要分别说明。
- 所有视觉改动引用 [产品原型目录](product/README.md)。原型未覆盖的状态要在 Issue
  中补充，不凭空扩展设计。
- 禁止用文字提示解释界面布局或开发快捷键来掩盖不完整交互。

当前没有前端 lint 和单元测试脚本。在补齐前，`check` 与生产 `build` 是最低自动
检查，运行时界面仍需按窗口矩阵人工验证。

## 5. Tauri 与 Rust

- Tauri command 接收结构化参数并在边界校验，不将 UI 字符串直接交给 shell。
- sidecar 路径由打包配置确定；UI 不能选择任意可执行文件。
- 子进程启动、停止、崩溃、超时和应用退出都由单一 supervisor 所有。
- 主窗口必须在 Stage 缺失、输出畸形或崩溃时仍能打开，并提供可恢复状态。
- capability、CSP、私有平台 API 和文件系统范围按最小权限配置。开发便利配置不能
  无审计进入 release。
- 持久化窗口状态必须校验显示器边界、尺寸和反序列化失败，不能让损坏状态阻止启动。

Rust 变更至少运行 `cargo fmt --check`、`cargo clippy -D warnings` 和
`cargo test`。干净 checkout 先执行 `npm --prefix app/control-desktop run
stage:prepare`，或在纯编译 CI 中使用明确标记且不参与运行时验证的 sidecar
placeholder。

## 6. C++ Engine 与 Native Stage

- 当前编译基线是 C++17；不在单个源文件私自使用更高标准。
- Engine public header 位于 `engine/include/nna/`，实现位于 `engine/src/`；应用入口
  不进入 Engine target。
- Core、Live2D adapter 和应用 Stage 的依赖应逐步拆分，避免可复用核心被迫链接
  窗口或渲染依赖。
- 所有资源所有权用 RAII 表达。异常路径必须释放窗口、GL context、纹理、模型和
  子线程。
- 帧循环中避免每帧分配、文件 IO、进程通信阻塞和重复解析配置。
- `stdout` 预留给机器协议；诊断、GL 信息和错误写入 `stderr`。
- `--health-check` 必须有界退出并用非零退出码报告失败。无模型模式不能作为真实
  模型加载证据。

新增 C++ 行为应有可重复测试。当前 CMake 尚无 CTest 是明确技术债，不得以健康
检查完全替代单元和协议负向测试。

## 7. Stage Protocol

- v1 schema 是目标契约，当前运行时是 v0；实现完成前不得发送带 v1 标识的近似消息。
- 先修改 schema、示例和兼容规则，再修改 Host 与 Stage。
- 每条 JSONL 是单行 UTF-8 JSON；未知字段、未知消息和不支持版本按契约拒绝。
- command/result 使用可追踪 ID；超时、重复、EOF、父进程退出和畸形输入必须有
  确定行为。
- 协议不传输任意命令、任意路径、token、账户数据、音视频帧或逐帧 Live2D 参数。
- breaking change 新增 major 目录，不原地重写已发布协议。

## 8. 依赖、资产与许可

- npm 和 Cargo 依赖由 lockfile 固定；CMake FetchContent 固定 tag 或完整 commit。
- 新依赖必须说明用途、替代方案、维护状态、许可证、二进制/包体影响和安全边界。
- `engine/third_party/` 不是随意复制上游仓库的入口。SDK 样例、文档和多平台预编译
  库是否需要跟踪，应通过包内容和许可审计决定。
- Live2D Cubism SDK、Core、Framework 和示例模型遵循各自条款，不属于仓库
  Apache-2.0 自有代码范围。
- 不给每个源文件添加与根许可证冲突的 `All rights reserved` 或混合 SPDX 声明。
  需要文件头时使用项目统一、经确认的 SPDX 标识。

## 9. 质量与可维护性

- 变更应最小且有单一责任；不要在功能 PR 中顺手重排无关文件。
- 复制第三份逻辑前先确认 owner；只有能减少真实重复或隔离边界时才抽象。
- 错误信息说明失败动作和恢复方式，但不泄露秘密或用户路径。
- 注释解释不明显的约束和原因，不复述代码。
- TODO 必须关联 Issue 或说明解除条件，不能成为永久计划清单。
- 删除、迁移或重命名公共文件时更新路径引用、CODEOWNERS、文档和 CI。

## 10. 提交门禁

变更必须满足 [贡献指南](../CONTRIBUTING.md) 中与范围对应的命令，并在 PR 中写明
最高验证级别和平台。未运行的检查必须说明原因。详细分级和发布条件见
[构建与测试门禁](architecture/build-and-test-gates.md)。
