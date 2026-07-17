# 为 NekoPapa 贡献

NekoPapa 使用 NNA 工程规范。开始前请阅读 [项目治理](GOVERNANCE.md)、
[Issue 治理](doc/ISSUES.md) 和 [开发规范](doc/%F0%9F%93%9C%20Nekonano-Aether%20%28NNA%29%20%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83%E6%89%8B%E5%86%8C.md)。

## 开始工作

除拼写修正等极小变更外，先创建或认领一个 GitHub Issue。Bug 必须提供复现证据；
界面工作必须引用 `img/` 中的原型文件名或明确说明没有对应原型。

从最新 `main` 创建短分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/nna-short-topic
```

可用前缀为 `feat`、`fix`、`refactor`、`docs`、`test`、`chore` 和 `hotfix`。
不要创建长期 `dev` 分支。

## 环境与安装

当前桌面栈需要 Node.js LTS、npm、Rust 1.96+、CMake 3.21+、Ninja、支持
C++17 的编译器、OpenGL 和对应平台的 Tauri 2 依赖。

```bash
npm --prefix app/control-desktop ci
```

首次配置 Native Stage 时，CMake 可能下载固定版本的 GLFW 和
nlohmann/json。Qt 只用于冻结的 legacy 参考目标，不是默认开发依赖。

完整平台说明见
[多平台开发环境指南](doc/%F0%9F%90%BE%20OpenNeko%20Engine%20%E5%A4%9A%E5%B9%B3%E5%8F%B0%E5%BC%80%E5%8F%91%E7%8E%AF%E5%A2%83%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)。

## 按范围验证

先运行与你的改动直接相关的检查，再按风险扩大范围。

### 前端与 Tauri

```bash
npm --prefix app/control-desktop run check
npm --prefix app/control-desktop run build
npm --prefix app/control-desktop run stage:prepare
cargo fmt --manifest-path app/control-desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path app/control-desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml
```

`stage:prepare` 是干净 checkout 上 Rust/Tauri 编译的前置步骤，因为 Tauri 会在
build script 中检查 target-triple sidecar 是否存在。CI 的 Rust job 只创建编译期
placeholder，并由独立 Native Stage job 负责真实 C++ 构建；placeholder 不是运行时
或打包证据。

### Native Stage 与 Engine

```bash
cmake -S . -B build/stage -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DNNA_BUILD_APP=OFF \
  -DNNA_BUILD_LIVE2D_STAGE=ON \
  -DNNA_ENABLE_LIVE2D=ON
cmake --build build/stage --target openneko_live2d_stage
./build/stage/bin/openneko-live2d-stage \
  --health-check \
  --model assets/live2d/hiyori/hiyori_pro_t11.model3.json
```

健康检查必须标明操作系统、架构和是否加载真实模型。构建成功不等于透明窗口、
缩放、输入穿透或安装包已经验证。

### 文档和治理

- 检查相对链接、文件路径、命令和版本与当前仓库一致。
- 修改架构边界时更新架构索引，必要时新增 ADR。
- 修改视觉行为时更新原型目录中的实现状态和验收证据。
- 不把计划中的检查写成已经存在的 CI。

完整门禁见 [构建与测试门禁](doc/architecture/build-and-test-gates.md)。

## 代码与资源要求

- React 页面不直接启动进程；桌面能力通过类型化 bridge 进入 Tauri。
- Tauri 只允许固定 sidecar 和必要参数，不接受来自 UI 的任意命令或路径。
- Engine 公共 API 使用 `nna` 命名空间；构建开关和宏使用 `NNA_`。
- 协议先更新 schema、示例和负向测试，再更新两端实现。
- `stdout` 仅输出协议 JSONL，诊断写入 `stderr`。
- 不提交 `build/`、`dist/`、`target/`、`node_modules/`、sidecar 生成物、
  `.DS_Store`、密钥或签名材料。
- 引入模型、字体、音频、SDK 或二进制前，必须记录来源、版本、许可证和再分发
  条件。不要假定 Apache-2.0 覆盖第三方资产。

## 提交与 Pull Request

提交信息使用 Conventional Commits 的核心类型，例如：

```text
feat(desktop): add bounded stage restart
fix(ui): keep home navigation centered while resizing
docs(governance): define NNA branch policy
```

推送后创建目标为 `main` 的 PR：

```bash
git push -u origin feat/nna-short-topic
```

PR 必须包含关联 Issue、范围与非目标、验证命令和结果。界面变更需要原型文件名、
窗口尺寸/缩放、改动前后截图或短视频；跨平台行为要分别报告，未验证的平台写明
`not verified`。

提交前检查：

- diff 中没有无关重构、生成物或本机路径；
- 失败路径、资源缺失和 Stage 崩溃不会让主窗口无法打开；
- 用户可见行为、协议、配置和文档保持一致；
- `git diff --check` 通过；
- 适用检查通过，未运行的检查及原因写在 PR 中。

PR 通过 CI 和审查后使用 squash merge。不要在共享分支上 force-push，也不要用
unrelated-history 合并解决普通同步问题。
