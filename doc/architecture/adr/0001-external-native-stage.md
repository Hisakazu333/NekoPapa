# ADR-0001：Native Stage 由外部预构建产物提供

- Status: Accepted
- Date: 2026-09-04
- Owners: NekoPapa desktop host / Native runtime maintainers

## Context

NekoPapa 曾在同一仓库维护 React/Tauri 桌面宿主、C++ Native Stage、NNA stub、
Cubism Native adapter 和完整第三方 SDK。真正的 NekoCore-Nano 与 Live2D 原生能力已在
独立 C++ 仓库演进，继续保留第二套源码与 SDK 会造成所有权、版本和许可边界重复。

现有 Tauri host 已把 Stage 当作受监督 sidecar 进程，因此进程协议比共享 C++ ABI 更适合
成为仓库边界。

## Decision

1. NekoPapa 仓库不再保存或构建 C++ Engine、Native Stage 实现及 Cubism Native SDK。
2. Native runtime 仓库按操作系统和架构发布完整 `nekopapa-native-stage` 可执行文件。
3. NekoPapa 通过 `NEKOPAPA_NATIVE_STAGE_BINARY` 或 `native-prebuilt/desktop/<target-triple>/`
   接收产物，再交给 Tauri bundler。
4. `protocol/stage/v1/` 是双方共同评审的目标契约；在 v1 落地前，兼容性必须明确标注为
   legacy v0，而不能宣称已实现 v1。
5. 本仓库 CI 验证 UI、Rust host、文档和协议文件；Native Stage 自身的源码构建、GPU
   runtime 和 SDK 许可检查由产物提供方负责。NekoPapa 的发布门禁仍需验证收到的真实
   二进制及最终安装包。

## Consequences

正面影响：

- 删除重复的 C++ 源码和约 53 MB vendored SDK；
- 桌面仓库不再绑定 CMake、编译器或 C++ ABI；
- Native runtime 可以独立版本化、测试和处理第三方许可；
- Tauri 与 runtime 之间保留清晰、可替换的进程边界。

代价与风险：

- 没有兼容预构建产物时，浏览器预览可用，但 Tauri dev/package 会提前失败；
- macOS 与 Windows 必须分别发布正确架构的产物，单个 `.so` 不能跨平台使用；
- 供应链校验、协议兼容矩阵和跨仓库发布协调成为必要门禁；
- 当前 Rust host 仍发送 legacy v0 shutdown 消息，需要后续完成 v1 handshake 和解析。

## Verification

- 干净 checkout 不再包含 CMake、C++ Engine、Native Stage 源码或 Cubism Native SDK；
- 前端构建和 Rust 静态检查不依赖 C++ 工具链；
- 缺失真实 sidecar 时，`stage:prepare` 给出目标 triple 和恢复方法；
- 提供真实 sidecar 后，Tauri 能复制、启动、监督并停止该进程；
- 发布前记录二进制 hash、来源 revision、协议版本、签名状态和两平台运行证据。

## Rollback

如外部产物交付无法满足发布要求，从 Git 历史恢复最后一个同仓构建版本。不得在没有
明确所有权和许可方案的情况下只恢复 vendored SDK 或部分 C++ 目录。
