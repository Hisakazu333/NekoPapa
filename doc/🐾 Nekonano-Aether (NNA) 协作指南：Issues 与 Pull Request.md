# Nekonano-Aether (NNA) GitHub 协作指南

状态：现行操作指南

最后核对：2026-07-18

本指南说明如何在 NekoPapa 仓库提交 Issue、Pull Request 和审查意见。规则来源
是 [项目治理](../GOVERNANCE.md) 和 [贡献指南](../CONTRIBUTING.md)；两者冲突时，
以项目治理为准。

## 1. 协作入口

- 当前平台：GitHub。
- 默认分支：`main`。
- 工作方式：短分支 -> Pull Request -> squash merge 到 `main`。
- NNA 分支示例：`feat/nna-stage-handshake`、`fix/nna-home-resize`、
  `docs/nna-runtime-boundaries`。
- 仓库没有长期 `dev` 集成分支。旧文档中的 Gitee、`dev` 和 Qt/QML 验收流程
  已废止。

## 2. 提交 Issue

### Bug

Bug 是能够在指定版本和环境中复现的实际行为，不是功能愿望。使用 Bug Report
表单并填写：

- commit SHA、操作系统、架构和运行入口；
- 最小复现步骤；
- 期望行为与实际行为；
- 日志、退出码、截图或短视频；
- 是否稳定复现及已尝试的绕过方式；
- 安全或隐私影响。

桌面界面 Bug 还需要：

- 对应 `img/<hash>.png`，没有则写“无对应原型”；
- Tauri 桌面或浏览器预览；
- 窗口宽高、系统显示缩放和 device pixel ratio；
- 问题发生在主窗口、WebView 内 Live2D 还是独立 Native Stage；
- 缩放、拖动、窗口栏和输入行为的录屏，而不只是一张静态截图。

不要在普通 Issue 中提交未脱敏 token、绝对用户路径或漏洞利用步骤。安全问题按
[SECURITY.md](../SECURITY.md) 私密报告。

### Feature

Feature Request 必须先说明用户问题，再说明方案：

- 谁在什么场景遇到什么问题；
- 当前为什么不能完成；
- 提议的最小结果；
- 明确非目标；
- 可观察的验收条件；
- 替代方案和取舍；
- 是否改变协议、权限、数据、资源许可或平台范围。

原型图只能证明目标外观，不能证明对话、记忆、同步、Agent 或后端已经接入。

### Architecture / Tech Debt

跨运行时、协议、依赖、迁移和目录所有权问题使用 Architecture / Tech Debt 表单。
Issue 必须引用当前代码位置、说明继续不处理的成本，并给出目标边界、迁移步骤、
回滚和验证。符合 [项目治理](../GOVERNANCE.md#6-架构决策) 条件时必须同时准备
ADR。

### Triage

维护者会检查证据、去重、范围、优先级和 owner。`needs-triage` 不表示已经批准；
`blocked` 必须写明解除条件。完整标签和 Ready/Done 定义见
[Issue 治理](ISSUES.md)。

## 3. 提交 Pull Request

### 创建分支

```bash
git switch main
git pull --ff-only origin main
git switch -c fix/nna-home-resize
```

不要从过期分支复制大批文件，也不要为普通同步使用
`--allow-unrelated-histories`。需要并行隔离工作时使用 Git worktree，而不是在有
未提交改动的 checkout 上切换任务。

### 控制范围

一个 PR 只处理一个目标。PR 中写清：

- 关联 Issue；
- scope 和 non-goals；
- 当前行为、目标行为和关键设计决定；
- 影响的运行时和平台；
- 风险、回滚和后续任务；
- 实际执行的检查及结果。

界面 PR 必须引用原型文件、提供相同窗口条件下的前后证据，并分别检查：

- 顶部导航和窗口控件在缩放时的位置；
- 小屋画布与外层窗口 chrome 的边界；
- 最小窗口、常用桌面尺寸、系统缩放和高 DPI；
- Live2D 是否空白、拉伸、裁切或阻塞交互；
- 动画期间 resize/drag 是否出现明显卡顿。

### 提交与推送

提交信息使用清晰的 Conventional Commit：

```bash
git add app/control-desktop/src/App.tsx app/control-desktop/src/styles/home.css
git diff --cached
git commit -m "fix(ui): keep home navigation centered while resizing"
git push -u origin fix/nna-home-resize
```

不要无检查地 `git add .`。生成物、`.DS_Store`、sidecar、密钥和本机配置不能进入
PR。

### 验证证据

PR 模板中的命令不能只打勾，必须写结果。示例：

```text
- `npm --prefix app/control-desktop run check`: passed
- `cargo test --manifest-path app/control-desktop/src-tauri/Cargo.toml`: 4 passed
- macOS 15 / 1440x900 / 2x: runtime checked
- Windows: not verified, no Windows runner available
```

“build passed”不能替代运行时验证，“browser preview passed”不能替代 Tauri 或
Native Stage 验证。

## 4. Code Review

审查按以下顺序进行：

1. 行为是否满足 Issue 和原型验收条件；
2. 模块所有权、协议和权限边界是否被破坏；
3. 失败路径、清理、跨平台和许可是否覆盖；
4. 测试与证据是否足以支持声明；
5. 代码可读性和局部实现细节。

审查意见应区分：

- `blocking`：合并前必须解决；
- `suggestion`：建议改进，不阻塞当前范围；
- `follow-up`：有价值但超出范围，转成独立 Issue。

作者在原分支继续提交即可更新 PR，不要关闭后重开。讨论解决不等于问题解决；
相应代码或说明更新后再 resolve。

## 5. 合并与收尾

CI 通过、blocking 意见解决、验收证据完整后使用 squash merge 到 `main`。合并后：

- 删除远端工作分支；
- 确认关联 Issue 被正确关闭；
- 将遗留事项创建为独立 Issue；
- 若改变 GitHub 设置、文档或原型状态，同步对应记录。

禁止 force-push `main`。紧急修复也从 `hotfix/nna-*` 分支通过 PR 合入，安全事件
只缩短流程时间，不降低证据和回滚要求。
