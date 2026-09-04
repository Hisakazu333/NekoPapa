# 为 NekoPapa 贡献

开始前请阅读 [项目治理](GOVERNANCE.md)、[工程规范](doc/engineering/standards.md)和
[文档中心](doc/README.md)。任务状态以 [GitHub Issues](https://github.com/Hisakazu333/NekoPapa/issues)
为准，不在仓库内维护容易过期的 backlog 副本。

## 开始工作

除拼写或坏链接等极小修正外，先创建或认领 Issue。界面工作必须引用
`prototype/desktop-app/` 中的具体页面，或明确说明没有对应原型。

从最新 `main` 创建短分支，分支名格式为 `<类型>/<认领人>/<简短描述>`：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/sakana/onboarding-flow
```

可用类型为 `feat`、`fix`、`refactor`、`docs`、`test`、`perf` 和 `chore`，紧急修复用
`hotfix`。命名使用小写英文，描述用短横线 `-` 分隔，完整规则见
[Git 实战手册](doc/contributing/git-workflow.md)。仓库不使用长期 `dev` 分支。

## 环境

重写过渡期（[ADR-0002](doc/architecture/adr/0002-client-rewrite-external-live2d.md)）：
旧客户端实现已移除，当前可运行入口只有设计原型，前端/Rust 工具链命令随新骨架恢复。
完整说明见[开发环境](doc/contributing/development-environment.md)。

```bash
prototype/desktop-app/serve.sh
```

真实桌面运行需要 Rust 1.96+、对应平台 Tauri 2 系统依赖，以及外部 Native Stage：
设置 `NEKOPAPA_NATIVE_STAGE_BINARY`，或按
[`native-prebuilt/`](native-prebuilt/README.md) 的约定放置与目标 triple 匹配的文件。
角色（Live2D）渲染由外部 NekoCore-Nano C++ 代码承担，本仓库不编译 C++。

## 按范围验证

### 文档

```bash
node scripts/check-documentation.mjs
```

文档必须区分当前事实、目标契约和产品原型。不要把外部仓库、未提供的二进制或草案
schema 描述成已经集成。

### 前端与 Rust host（待重建）

前端类型检查/构建与 Rust fmt/clippy/test 命令随新骨架恢复，要求见
[构建与测试门禁](doc/architecture/build-and-test-gates.md)。界面变更仍应记录适用
viewport、显示缩放和前后截图；浏览器证据不能证明 Tauri、sidecar 或系统窗口行为。

### 协议与外部 runtime

修改 `protocol/stage/v1/` 或 host adapter 时，必须同步 schema、示例和正反用例，并记录
外部 Native Stage 的版本与兼容结果。`stdout` 只承载 JSONL 协议，诊断写入 `stderr`。

## 代码与资源要求

- React 页面不直接启动进程；桌面能力通过类型化 bridge 进入 Tauri。
- Tauri 只解析固定 sidecar 和受控参数，不接受 UI 提供任意可执行路径或 shell 命令。
- 外部二进制必须记录来源 revision、平台、架构、hash、签名状态和许可清单。
- 不提交 `build/`、`dist/`、`target/`、`node_modules/`、预构建 sidecar、`.DS_Store`、
  密钥或签名材料。
- 引入模型、字体、音频或 SDK 前，必须核对来源、版本、许可证和再分发条件。
- 删除或迁移文件时同步更新配置、CI、CODEOWNERS 和文档链接。

## Pull Request

提交信息使用 Conventional Commits，例如：

```text
feat(desktop): add bounded stage restart
fix(ui): keep home navigation centered while resizing
docs(architecture): document external native runtime
```

PR 必须包含关联 Issue、范围与非目标、实际运行的验证命令和结果。跨平台行为分别报告；
未验证的平台写 `not verified`。合并前确认：

- diff 没有无关重构、生成物或本机绝对路径；
- 资源或 sidecar 缺失时错误可理解，不被误报为功能完成；
- 用户可见行为、协议、配置和文档一致；
- `git diff --check` 和适用检查通过。

通过 CI 与审查后使用 squash merge。不要在共享分支 force-push，也不要用
unrelated-history 合并解决普通同步问题。
