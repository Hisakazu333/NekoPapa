# Native Stage 预构建产物

本目录定义 NekoPapa 桌面宿主与外部 Native Stage 的交付边界，不保存 C++ 源码。
实际二进制默认不提交 Git。

## 目录约定

把与 Rust target triple 完全匹配的可执行文件放在：

```text
native-prebuilt/desktop/<target-triple>/nekopapa-native-stage[.exe]
```

例如 Apple Silicon macOS：

```text
native-prebuilt/desktop/aarch64-apple-darwin/nekopapa-native-stage
```

也可以设置 `NEKOPAPA_NATIVE_STAGE_BINARY`，直接指向绝对路径。新骨架的准备脚本
会把文件复制为 Tauri 要求的 target-triple sidecar 名称（脚本随客户端重写恢复，
见 [ADR-0002](../doc/architecture/adr/0002-client-rewrite-external-live2d.md)）。

## 兼容要求

提供方必须同时声明：

- 产物版本、源码 revision、目标操作系统和 CPU 架构；
- SHA-256 校验和以及适用的签名或公证状态；
- Stage Protocol 兼容版本；
- 所含第三方 SDK、模型运行时和再分发许可；
- 启动参数、退出码、`stdin`/`stdout`/`stderr` 约定。

旧 host 的 legacy v0 行为（`--model <path>` 启动、未版本化 shutdown JSONL）已随旧
实现移除。新 host 必须直接实现 Protocol v1；在 host 与 Stage 两端兼容测试通过前，
提供方应以 `protocol/stage/v1/` 为目标契约，不得单方面宣称兼容已达成。

## 边界

- 外部 C++ 仓库拥有渲染器、窗口循环、Cubism Native SDK 和平台构建。
- 本仓库拥有 Tauri sidecar 装配、进程监督、协议 schema 和产品 UI。
- 零字节 placeholder 只用于 Rust 静态检查，禁止作为运行或发布产物。
