# NekoPapa / NNA 多平台开发环境指南

状态：现行开发指南

最后核对：2026-07-18

本指南覆盖当前 Tauri 2 + React + Rust + C++17 Native Stage。Qt/QML 客户端已冻结
为 legacy 参考，不是默认环境要求。

## 1. 当前工具链

| 工具 | 最低/约束 | 用途 |
| --- | --- | --- |
| Node.js | 当前 LTS | Vite/React/Tauri CLI |
| npm | 随 Node，使用 lockfile | 前端依赖 |
| Rust | 1.96+ | Tauri host |
| CMake | 3.21+ | Engine/Native Stage |
| Ninja | 推荐 | C++ 构建 |
| C++ compiler | 支持 C++17 | Engine/Native Stage |
| OpenGL | 平台开发环境 | Native Stage |

还需要 [Tauri 2 平台依赖](https://v2.tauri.app/start/prerequisites/)。首次配置
Native Stage 时，如果系统没有匹配的 CMake package，CMake 会从 GitHub 获取固定
版本的 GLFW 和 nlohmann/json。

## 2. 平台准备

### macOS

- 安装并启动一次 Xcode，接受许可证。
- 安装 Xcode Command Line Tools。
- 安装 Node.js LTS、Rust、CMake 和 Ninja。
- Apple Silicon 和 Intel 结果必须分别标注；不要混用不同架构的 Cubism Core。

可用 Homebrew 安装通用工具：

```bash
brew install cmake ninja node rustup-init
```

若使用已有 `rustup`，不要重复初始化；确认 `rustc --version` 满足 manifest 的
`rust-version`。

### Windows 11

- 安装 Visual Studio 2022 的 “Desktop development with C++” workload 和 Windows
  10/11 SDK。
- 安装 Node.js LTS、Rust MSVC toolchain、CMake 和 Ninja。
- 在 x64 Native Tools Command Prompt 或正确加载 MSVC 环境的终端中构建。
- WebView2 运行时和 Tauri prerequisites 必须可用。

Native Stage 的发布目标是 Windows x64；其他架构必须有独立 Issue 和工具链验证。

### Linux

Linux 目前是源码开发路径，不是承诺发布的平台。需要 C/C++ 工具链、OpenGL、
X11/Wayland 对应的 GLFW/Tauri 系统包、Node.js、Rust、CMake 和 Ninja。具体包名随
发行版变化，以 Tauri 和 GLFW 当前文档为准。

Linux 构建通过不能替代 macOS/Windows 发布矩阵。

## 3. 获取仓库

```bash
git clone https://github.com/Hisakazu333/Nekopapa.git
cd Nekopapa
git status --short --branch
```

当前仓库不要求为了普通源码 checkout 额外执行 Git LFS。若以后启用 LFS，以
`.gitattributes` 和仓库治理说明为准。

## 4. 安装前端与 Rust 依赖

```bash
npm --prefix app/control-desktop ci
rustc --version
cargo --version
```

`npm ci` 必须使用已跟踪 lockfile。不要用 `npm install` 顺手改写依赖版本后又把
lockfile 排除在 PR 外。

## 5. 浏览器预览

```bash
npm --prefix app/control-desktop run dev
```

打开 `http://127.0.0.1:1420/`。浏览器预览用于 React/Cubism Web 调试，不会启动
真实 Tauri sidecar；页面中的模拟状态不是 Native Stage 运行证据。

## 6. Tauri 桌面开发

```bash
npm --prefix app/control-desktop run tauri -- dev
```

Tauri 的 `beforeDevCommand` 会先运行 `stage:prepare`，构建并复制与 Rust target
triple 匹配的 sidecar，然后启动 Vite 和桌面窗口。若失败，分别检查：

1. Node/Rust/Tauri prerequisites；
2. CMake、Ninja、OpenGL 和编译器；
3. Cubism SDK/Core 的平台与架构；
4. sidecar 是否生成到预期 target-triple 路径；
5. 模型资源是否存在且许可允许本地使用。

不要手工提交 `src-tauri/binaries/` 中的生成 sidecar。

## 7. 单独构建 Native Stage

```bash
cmake -S . -B build/stage -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DNNA_BUILD_APP=OFF \
  -DNNA_BUILD_LIVE2D_STAGE=ON \
  -DNNA_ENABLE_LIVE2D=ON \
  -DNNA_CORE_NANO_MODE=stub
cmake --build build/stage --target openneko_live2d_stage
```

有界健康检查：

```bash
./build/stage/bin/openneko-live2d-stage \
  --health-check \
  --model assets/live2d/hiyori/hiyori_pro_t11.model3.json
```

Windows 可执行文件名带 `.exe`。记录退出码、stdout JSON、stderr 诊断、平台、架构和
模型。健康检查通过不等于交互式协议、透明窗口、多屏或安装包门禁通过。

## 8. 基线检查

```bash
npm --prefix app/control-desktop run check
npm --prefix app/control-desktop run build
npm --prefix app/control-desktop run stage:prepare
cargo fmt --manifest-path app/control-desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path app/control-desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml
```

干净 checkout 在编译 Tauri/Rust 前需要 `stage:prepare`，否则 Tauri build script 会因
target-triple sidecar 不存在而失败。CI 可使用明确标记的编译期 placeholder 将 Rust
检查与 C++ job 解耦，但 placeholder 不能作为 Native Stage 构建或运行证据。

当前前端没有独立 lint/unit-test script，CMake 没有 CTest。这些是已记录的测试
缺口，不要运行不存在的命令或在 PR 中声称已经覆盖。

## 9. Legacy Qt

`app/stage-desktop/` 只用于迁移取证，默认 `NNA_BUILD_APP=OFF`。它当前不能作为可靠
构建或发布入口，新功能不得继续同时写入 Qt 和 Tauri。确需调查 legacy 行为时使用
独立 build 目录，并在 Issue 中说明取证目标；不要把 Qt 安装写成新贡献者前置条件。

## 10. 常见问题

| 现象 | 首先检查 | 不能直接得出的结论 |
| --- | --- | --- |
| CMake 下载失败 | 网络、proxy、固定依赖是否已有本地 package | 源码错误 |
| Cubism Core 链接失败 | OS、CPU 架构和 SDK 文件 | React 页面错误 |
| 浏览器中 Stage 显示 stopped | 是否处于浏览器模拟模式 | Native Stage 崩溃 |
| Tauri 主窗口打开但角色缺失 | Web 模型路径、sidecar 状态、stderr 分开检查 | Engine 已失败 |
| health check 通过 | model_loaded、frames、退出码 | 窗口交互和打包已通过 |
| macOS 通过 | 对应 macOS 工具链和运行时 | Windows 也支持 |

完整验证层级见 [构建与测试门禁](../architecture/build-and-test-gates.md)。
