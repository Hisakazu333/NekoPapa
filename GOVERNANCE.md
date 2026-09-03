# NekoPapa 项目治理

状态：现行规范  
最后核对：2026-09-04

本文件定义 NekoPapa 仓库如何确认事实、作出决策和合并变更。开发命令见
[贡献指南](CONTRIBUTING.md)，标签真相源见 [`.github/labels.yml`](.github/labels.yml)。

## 1. 名称与仓库边界

- **NekoPapa** 是本产品、桌面客户端、安装包和仓库名称。
- **NekoCore-Nano / NekoCore** 是外部原生核心，不是本仓库内的第二套 Engine。
- **Native Stage** 是外部提供的桌面 sidecar。本仓库只拥有其装配、进程监督和协议契约。
- 产品 UI 不展示内部工程代号，也不把原型或外部依赖描述为已经交付。

Native Stage 外部化的决定见 [ADR-0001](doc/architecture/adr/0001-external-native-stage.md)。

## 2. 事实来源

冲突时按以下顺序判断：

1. 当前分支源码、锁文件、配置和可复现测试决定本仓库“现在能做什么”。
2. `prototype/desktop-app/` 决定 UI 目标和视觉验收基线，但不证明功能已实现。
3. Accepted ADR 和架构文档决定模块所有权与兼容边界。
4. GitHub Issues、Pull Requests 和 Releases 决定任务及发布状态。
5. Git 历史只解释过去，不创建当前入口或维护承诺。

文档不得覆盖可观察事实。外部产物必须注明来源和版本，不能仅凭相邻目录或本机文件
声称 CI、运行或发布已经通过。

## 3. 分支与合并

仓库采用短分支、Pull Request 合入 `main` 的 trunk-based 流程，不维护长期 `dev`。
人工分支使用：

- `feat/<topic>`
- `fix/<topic>`
- `refactor/<topic>`
- `docs/<topic>`
- `test/<topic>`
- `chore/<topic>`
- `hotfix/<topic>`

每个 PR 解决一个可审查目标；CI、范围和证据完整后使用 squash merge。`main` 应禁止
直接推送、force-push 和删除，并要求当前 workflow 中稳定的检查。线上规则发生变化时，
治理 PR 必须同步说明，不能在文档中假定设置已生效。

## 4. Issue 与优先级

Issue Forms 是工作入口。已 triage 的任务至少应有一个 `type:*`、`area:*` 和
`priority:*` 标签。任务实时状态只保存在 GitHub，不在 Markdown 中复制 issue 清单。

- `p0`：发布版本的安全事件、数据损坏或完全无法启动。
- `p1`：核心开发路径被阻断，或高影响缺陷无合理绕过。
- `p2`：重要功能、质量工作或已证实技术债。
- `p3`：低影响改进或未排期探索。

## 5. 架构决策

以下变更必须提交 ADR：

- 改变 React、Tauri、外部 Native Stage、NekoCore 或协议的所有权边界；
- 新增跨进程、持久化或权限协议；
- 引入难以替换的运行时依赖或预构建二进制；
- 改变安全、隐私、更新、签名或发布模型；
- 移除受支持组件或平台。

ADR 使用 [模板](doc/architecture/adr/0000-template.md)，状态为 `Proposed`、`Accepted`、
`Superseded` 或 `Rejected`。被替代的 ADR 保留原文并链接后继决策。

## 6. 验证与发布

状态报告必须写出最高证据层级与平台：Source-reviewed、Static-verified、Build-verified、
Runtime-smoke-tested、Package-verified 或 Release-verified。

公开安装包发布前至少需要：

- 仓库 CI 全绿；
- 外部 sidecar 的版本、源码 revision、hash、签名和协议兼容结果可追溯；
- macOS 与 Windows 分别完成真实运行和安装包验证；
- 签名、公证、包内容和第三方许可审计完成；
- 回滚目标与校验和明确。

浏览器预览、placeholder、单平台结果或外部仓库构建成功，均不能单独证明安装包可发布。

## 7. 规范变更

治理规则通过普通 PR 修改。PR 说明改变、原因、迁移方式、验证结果以及是否需要同步
GitHub 设置。文档、workflow 和线上规则不一致时，以可观察状态为准并立即建立修正项。
