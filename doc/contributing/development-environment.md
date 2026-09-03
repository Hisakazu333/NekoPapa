# NekoPapa 开发环境

本指南覆盖 React/Vite 浏览器预览、Tauri/Rust 桌面宿主和外部 Native Stage 接入。
本仓库不再包含或构建 C++ runtime。

## 工具链

| 工具 | 基线 | 用途 |
| --- | --- | --- |
| Node.js | 24 | Vite、TypeScript 和仓库脚本 |
| npm | 随 Node.js | 锁文件安装与前端命令 |
| Rust | 1.96+ | Tauri host |
| Tauri 系统依赖 | 2.x 对应平台要求 | WebView 与桌面打包 |
| Native Stage | 与 target triple 匹配的外部产物 | 独立桌宠窗口 |

CMake、Ninja、C++ 编译器和 Cubism Native SDK 属于外部 runtime 仓库，不是 NekoPapa
开发环境要求。

## 获取与安装

```bash
git clone https://github.com/Hisakazu333/NekoPapa.git
cd NekoPapa
npm --prefix app/control-desktop ci
```

依赖必须从 `package-lock.json` 和 `Cargo.lock` 安装，不提交 `node_modules/`、`target/`
或本机配置。

## 浏览器预览

```bash
npm --prefix app/control-desktop run dev
```

打开 `http://127.0.0.1:1420/`。浏览器模式使用 Web Live2D 和模拟 Stage 状态，不会启动
外部 sidecar。它适合页面、布局和 WebGL 开发，不证明桌面窗口或安装包行为。

静态产品原型使用：

```bash
prototype/desktop-app/serve.sh
```

入口为 `http://127.0.0.1:8123/prototype/desktop-app/`。

## Tauri 桌面开发

先安装对应平台的 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)，再获取
与 `rustc -vV` 中 host triple 匹配的 `nekopapa-native-stage`。

方式一，指定绝对路径：

```bash
export NEKOPAPA_NATIVE_STAGE_BINARY=/absolute/path/to/nekopapa-native-stage
npm --prefix app/control-desktop run tauri -- dev
```

方式二，放入默认目录：

```text
native-prebuilt/desktop/<target-triple>/nekopapa-native-stage[.exe]
```

详细交付要求见 [`native-prebuilt/README.md`](../../native-prebuilt/README.md)。准备脚本会复制
产物到 `app/control-desktop/src-tauri/binaries/`，该目录被 Git 忽略。

当前 host 以 `--model <path>` 启动 sidecar，并在停止时发送 legacy v0 shutdown JSONL。
外部产物必须兼容这一行为，直到 Protocol v1 在两端实现并通过测试。

## 静态检查

```bash
node scripts/check-documentation.mjs
npm --prefix app/control-desktop run check
npm --prefix app/control-desktop run build
npm --prefix app/control-desktop run stage:placeholder
cargo fmt --manifest-path app/control-desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path app/control-desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml
```

`stage:placeholder` 仅让 Rust/Tauri 静态检查通过。它不会覆盖已经存在的真实二进制，也
不能用于 `tauri dev`、打包或运行证据。

## 桌面打包

macOS 本地 DMG 入口为：

```bash
export NEKOPAPA_NATIVE_STAGE_BINARY=/absolute/path/to/nekopapa-native-stage
scripts/package-desktop.sh
```

打包前必须验证产物来源、hash、签名、协议兼容和许可。脚本成功只证明生成并校验了 DMG
容器，不自动证明运行、升级或发布门禁完成。

## 常见问题

| 现象 | 先检查 | 不应得出的结论 |
| --- | --- | --- |
| `A compatible Native Stage binary was not found` | 环境变量、默认路径、target triple、文件是否非空 | React 构建失败 |
| Tauri 提示 external binary 不存在 | 是否运行了 `stage:prepare` 或 `stage:placeholder` | sidecar 已兼容 |
| 浏览器显示 Stage 在运行 | 浏览器 adapter 是否处于模拟模式 | 原生进程已启动 |
| 外部 `.so` 无法运行 | 是否为 Android/OHOS ELF；桌面需要平台可执行文件 | 重命名扩展名即可兼容 |
| sidecar 启动后立即退出 | 架构、动态依赖、模型路径、协议和 stderr | host 一定有缺陷 |

平台问题必须记录操作系统版本、CPU 架构、Rust triple、窗口尺寸、显示缩放和外部产物
版本。不要用一台机器的结果代表另一平台。
