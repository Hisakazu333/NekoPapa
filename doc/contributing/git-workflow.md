# Nekonano-Aether (NNA) Git 实战手册

状态：现行操作指南

最后核对：2026-07-18

NekoPapa 使用 GitHub、单一长期分支 `main` 和短期 NNA 工作分支。本文只给出可
恢复、不会改写共享历史的日常流程。合并规则见 [项目治理](../../GOVERNANCE.md)。

## 1. 开始前确认仓库

同一台机器可能有多个 checkout 或 worktree。运行写操作前先确认：

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short --branch
```

NekoPapa 的 GitHub remote 是
`https://github.com/Hisakazu333/Nekopapa.git`。不要根据文件夹名称猜仓库，也不要
在有未提交改动的 checkout 上切换到无关任务。

## 2. 日常分支流程

从最新 `main` 创建短分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/nna-stage-handshake
```

常用前缀：

```text
feat/nna-*       新能力
fix/nna-*        缺陷修复
refactor/nna-*   不改变外部行为的重构
docs/nna-*       文档和治理
test/nna-*       测试
chore/nna-*      构建、依赖和维护
hotfix/nna-*     紧急修复
```

仓库不使用长期 `dev` 分支。旧文档中的 `feature/* -> dev -> main` 流程已废止。

## 3. 隔离并行工作

当前 checkout 有未提交改动时，优先使用 worktree：

```bash
git fetch origin
git worktree add ../Nekopapa-stage -b feat/nna-stage-handshake origin/main
```

完成并合并后，在确认 worktree 干净的前提下移除：

```bash
git worktree list
git worktree remove ../Nekopapa-stage
git branch -d feat/nna-stage-handshake
```

不要复制整个仓库目录，也不要用 reset/checkout 清掉另一个任务的本地修改。

## 4. 检查和暂存

提交前先审阅：

```bash
git status --short
git diff
git diff --check
```

按路径暂存，随后再次核对 staged diff：

```bash
git add app/control-desktop/src/App.tsx
git add app/control-desktop/src/styles/home.css
git diff --cached
```

只有确认所有未跟踪文件都属于当前任务时才使用 `git add -A`。绝不提交构建目录、
`.DS_Store`、`node_modules`、`target`、sidecar 生成物、密钥或本机配置。

## 5. 提交和推送

使用说明意图的 Conventional Commit：

```bash
git commit -m "fix(ui): keep home navigation centered while resizing"
git push -u origin fix/nna-home-resize
```

在 GitHub 创建目标为 `main` 的 PR。后续修改继续提交到同一分支；PR 会自动更新。
合并前是否整理 commit 由审查者决定，最终使用 squash merge。

## 6. 同步主线

短分支落后时，先确保工作区干净，再选择一种团队认可的方式：

```bash
git fetch origin
git rebase origin/main
```

只在自己的工作分支尚未被他人使用时 rebase。已经共享的分支优先 merge
`origin/main`，避免强制推送影响协作者。无论哪种方式，解决冲突后重新运行适用检查。

不要对 `main` rebase 或 force-push。不要为普通同步使用
`--allow-unrelated-histories`；NekoPapa 的 GitHub 历史已经统一。

## 7. 解决冲突

```bash
git status
git diff --name-only --diff-filter=U
```

逐文件理解两侧意图，删除冲突标记并验证行为：

```bash
git add path/to/resolved-file
git status
```

rebase 中使用 `git rebase --continue`；merge 中创建正常 merge commit。无法确认哪一侧
正确时中止操作并保留现场：

```bash
git rebase --abort
```

或：

```bash
git merge --abort
```

不要用 `ours`/`theirs` 批量覆盖没有读过的文件。

## 8. 撤销自己的错误

未暂存的单文件修改可以在确认后撤销：

```bash
git restore path/to/file
```

取消暂存但保留修改：

```bash
git restore --staged path/to/file
```

已推送或已合并的错误使用新的 revert commit：

```bash
git revert <commit-sha>
```

`git reset --hard`、`git clean -fd` 和 `git checkout .` 会破坏未提交工作，不属于
日常恢复流程。除非工作区所有者明确确认，否则不要执行。

## 9. 暂存未完成工作

优先创建 draft commit 或独立 worktree。必须 stash 时先命名并检查：

```bash
git stash push -u -m "wip: home resize investigation"
git stash list
```

恢复时先用 `apply`，确认无误后再删除 stash：

```bash
git stash apply stash@{0}
git status
git stash drop stash@{0}
```

## 10. 大文件与 Git LFS

当前仓库是否采用 LFS 由 `.gitattributes` 和治理决策决定，不能因为文件扩展名很大就
临时执行 `git lfs track`。新增模型、权重、视频、音频、字体或 SDK 二进制前先建立
Issue，确认：

- 是否允许进入公开仓库；
- 许可证和再分发条件；
- Git LFS、Release artifact 或外部对象存储哪种更合适；
- 下载完整性、版本和离线开发策略。

历史文件迁移到 LFS 会改写对象历史，必须用独立方案和维护窗口，不能在普通功能
PR 中执行。

## 11. 合并后清理

```bash
git switch main
git pull --ff-only origin main
git branch -d fix/nna-home-resize
git fetch --prune origin
```

只有在 GitHub 确认 PR 已合并、分支没有未推送提交、相关 worktree 已移除后才删除
本地分支。
