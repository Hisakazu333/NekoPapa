# NekoPapa 工程规范

状态：现行规范。

## 技术基线

| 层 | 技术 | Owner |
| --- | --- | --- |
| UI | React 19 + TypeScript 6 + Vite 8 | 页面与交互；不含角色渲染 |
| Desktop host | Tauri 2 + Rust 1.96+ | 窗口、权限、资源和 sidecar 生命周期 |
| Native runtime | 外部预构建可执行文件 | 独立窗口、原生渲染与全部角色（Live2D）渲染 |
| Protocol | JSON Schema + JSONL | host/runtime 稳定契约 |
| Product baseline | 静态 HTML/CSS/JS | 设计意图与验收锚点 |

本仓库不包含 C++ Engine、CMake 或 Cubism Native SDK。外部 Native runtime 的内部编码
规范由其仓库负责；本文件只约束交付与集成边界。

## 通用原则

- 当前行为、目标契约、产品原型和历史记录分开描述。
- 每个状态只有一个 owner；UI 不复制领域真相，host 不复制 renderer 状态。
- 跨边界依赖通过窄接口、版本和错误语义表达，不引用外部私有实现。
- 变更保持单一责任；删除或迁移时同步配置、CI、CODEOWNERS、文档和测试。
- TODO 必须写明解除条件或关联 Issue，否则不作为计划系统。

## TypeScript 与 React

- 开启并保持严格类型检查，不用 `any` 隐藏边界不清。
- 页面组件消费 view state 并发出 intent；进程、文件和权限通过 bridge 进入 Tauri。
- 网络、Tauri invoke 和 fixture 数据各自集中在 adapter，不散落环境判断；本仓库不
  实现产品用角色渲染（ADR-0002）。
- effect、observer、animation frame 和 WebGL 资源必须在卸载或依赖变化时清理。
- 错误状态说明失败动作与恢复方式；preview/mock/simulated 必须可辨认。
- 视觉实现遵循 `prototype/desktop-app/assets/proto.css` 和 `DESIGN.md`，但原型不替代
  可访问性、响应式或运行时验证。

## Tauri 与 Rust

- Tauri command 使用窄参数和可序列化返回值，错误不 panic、不泄露本机路径或秘密。
- WebView 不传任意 executable、shell、工作目录或未验证资源路径。
- sidecar 使用固定逻辑名，由 host 监督启动、退出和清理；重复 start/stop 必须幂等。
- stdout 是协议通道，stderr 是诊断通道；限制消息大小并处理 UTF-8、EOF、超时和畸形输入。
- 进程退出、应用退出和窗口关闭路径都必须回收子进程。
- `unsafe`、新增 capability、`macOSPrivateApi` 或 shell scope 变更需要显式安全说明。

## 外部 Native Stage

- 只接收与目标 Rust triple 匹配的完整桌面可执行文件。
- 产物必须有版本、不可变源码 revision、SHA-256、签名状态、协议版本和许可清单。
- 不提交真实 sidecar 到本仓库；本地文件进入被忽略的 `native-prebuilt/desktop/` 或
  `src-tauri/binaries/`。
- placeholder 只允许用于编译期静态检查，并必须保持零字节与明确命名流程。
- 外部仓库的构建通过不代替本仓库的集成、运行、安装包和发布验证。
- 不用共享 C++ 类 ABI 作为跨仓库公共边界；优先进程协议或稳定 C ABI。

## Stage Protocol

- schema、示例、两端 adapter 和兼容测试必须同步演进。
- 每条 JSONL 只含一个 UTF-8 JSON object；协议写 stdout，日志写 stderr。
- command/result 使用可追踪 ID；版本拒绝、超时、重复、EOF 和畸形输入有确定语义。
- 不传任意 shell 命令、token、账号数据、音视频帧或逐帧 Live2D 参数。
- breaking change 新建 major 目录；草案不得被文档或 UI 宣称为已实现。

## 资产与依赖

- npm 和 Cargo 依赖由 lockfile 固定；新增依赖说明用途、维护状态、许可证和包体影响。
- 模型、字体、图像和二进制记录来源、版本、修改、再分发条件和最终包位置。
- 根 `LICENSE` 只覆盖仓库自有内容，不自动覆盖 Live2D、外部 runtime 或其他第三方资产。
- `.DS_Store`、构建输出、依赖缓存、sidecar、密钥和签名材料禁止提交。

## 验证

提交前运行与范围对应的 [构建与测试门禁](../architecture/build-and-test-gates.md)，并在 PR
中记录实际命令、平台和最高证据等级。未运行的检查写明原因，不能用“应该可以”代替。
