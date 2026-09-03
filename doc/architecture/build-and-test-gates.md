# NekoPapa 构建与测试门禁

状态：与当前仓库 CI 对齐。外部 Native Stage 与发布门禁尚未自动化完成。

## CI 当前覆盖

| Job | 当前检查 | 能证明 | 不能证明 |
| --- | --- | --- | --- |
| Repository hygiene | 拒绝新增生成物和本机文件 | diff 基本卫生 | 已有历史垃圾全部清除 |
| Documentation | 校验本地 Markdown 链接 | 文档目标存在 | 文案事实或外部链接正确 |
| Frontend typecheck and build | `npm ci`、TypeScript、Vite build | 前端可静态构建 | Tauri、WebGL 和真实服务运行 |
| Rust format, lint, and test | fmt、Clippy、Rust tests | host 静态质量与单元测试 | 真实 sidecar 或安装包可用 |

Rust job 创建零字节 target-triple placeholder，只满足 Tauri build script 的文件存在性
检查。它不是 Native Stage build、协议兼容、runtime 或 package 证据。

## 本地基线

文档：

```bash
node scripts/check-documentation.mjs
```

前端：

```bash
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run check
npm --prefix app/control-desktop run build
```

Rust host 静态检查：

```bash
npm --prefix app/control-desktop run stage:placeholder
cargo fmt --manifest-path app/control-desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path app/control-desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml
```

真实桌面运行：

```bash
export NEKOPAPA_NATIVE_STAGE_BINARY=/absolute/path/to/nekopapa-native-stage
npm --prefix app/control-desktop run stage:prepare
npm --prefix app/control-desktop run tauri -- dev
```

## 按改动范围

### React 与样式

- TypeScript check 与 production build；
- 相关状态和错误路径测试；
- `1024x720`、`1280x800`、`1440x900`、`1920x1080` viewport；
- 键盘、焦点、对比度、reduced motion 和连续 resize；
- 使用具体原型页面作为设计依据。

### Tauri/Rust

- fmt、Clippy `-D warnings` 和 tests；
- command 参数拒绝、资源缺失、sidecar 缺失/退出/崩溃；
- 父进程退出时子进程清理；
- 真实 sidecar 的启动、停止和重复调用。

### Stage Protocol

- schema 自身有效；
- fixtures 覆盖 handshake、结果、错误、未知版本和畸形 JSON；
- host 与外部 Stage 使用同一版本 corpus；
- stdout/stderr 分离、消息大小限制、超时、EOF 和关联 ID 行为明确。

当前只有 schema 和示例，尚无端到端 v1 兼容测试，因此状态仍是 draft。

### 外部 Native Stage 产物

每个目标平台分别记录：

- artifact 版本、源码 revision、target triple、SHA-256 和签名状态；
- 协议版本、启动参数、动态依赖和最低系统版本；
- 真实模型加载、透明窗口、缩放、输入穿透、DPI/多屏、sleep/wake；
- 崩溃恢复、父进程退出、日志脱敏和退出码；
- Cubism 与其他第三方许可清单。

外部仓库构建成功不等于 NekoPapa 安装包通过。

## 发布门禁

### macOS

- arm64 与计划支持的 x86_64/universal 范围明确；
- `.app`/DMG 安装、首次启动、升级、卸载和回滚通过；
- 主应用与 sidecar 均完成签名、公证和 Gatekeeper 验证；
- 1x/2x、多显示器、睡眠恢复和权限场景有记录。

### Windows

- x64 与计划支持架构明确；
- installer 安装、首次启动、升级、卸载和回滚通过；
- 主应用、sidecar 和依赖 DLL 完成签名与杀毒误报检查；
- 100%/125%/150%/200% 缩放及多显示器有记录。

### 共同要求

- CI 全绿且使用 lockfile；
- 最终包内真实 sidecar 与已审计 hash 一致，不含 placeholder；
- SBOM、第三方通知、模型许可和包内容 allowlist 完成；
- 版本、校验和、已知限制和回滚目标可追溯。

未满足时只能标记为开发预览。
