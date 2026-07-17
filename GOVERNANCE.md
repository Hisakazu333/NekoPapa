# NekoPapa 项目治理

状态：现行规范

适用范围：NekoPapa 仓库、NNA / NekoCore-Nano layer 及其桌面运行时

最后核对：2026-07-18

本文件定义项目如何确认事实、作出决策和合并变更。具体开发命令见
[CONTRIBUTING.md](CONTRIBUTING.md)，Issue 规则见
[doc/ISSUES.md](doc/ISSUES.md)。

## 1. 名称与边界

- **NekoPapa**：当前产品、桌面应用、安装包和 GitHub 仓库名称。
- **Nekonano-Aether (NNA) / NekoCore-Nano**：同一底层体系的工程名与核心名，
  不是两个并列模块。`engine/` 的新公共 API 使用 `nna` 命名空间，构建开关和宏
  使用 `NNA_`，开发分支保留 `nna-` 前缀。正式核心名是 NekoCore-Nano；用户界面
  使用 `NekoCore` 作为短称。默认 `stub` 构建不代表完整 Core 已接入。
- **`openneko`**：现存 CMake target、binary 和 namespace 的 legacy 技术标识，
  不是现行产品或文档品牌。重命名必须通过兼容迁移完成。

不得用愿景名称替代当前模块名称，也不得把原型、草案或可选依赖描述成已经
交付的运行时能力。

## 2. 事实来源

发生冲突时按下面的顺序判断：

1. 当前分支的源代码、锁文件、构建清单和可复现的测试结果，决定“现在能做
   什么”。
2. `img/` 及 [产品原型目录](doc/product/README.md)，决定界面目标和视觉验收
   基线。原型图本身不证明功能已经实现。
3. 已接受的架构决策和 [架构索引](doc/architecture/README.md)，决定模块所有权
   和目标边界。
4. GitHub Issues、Pull Requests 和 Milestones，决定已批准的工作及其状态。
5. 愿景书、世界观和历史设计文档提供方向或背景，不作为当前实现证据。

文档不得覆盖可观测事实。发现不一致时，应在同一个 PR 中修正文档，或建立带
证据的 Issue 并显式标记偏差。

## 3. 角色与责任

- **维护者**：裁定范围、优先级、架构决策、发布和安全响应。
- **代码所有者**：审查自己负责路径的边界、风险和验证证据。
- **贡献者**：保持变更聚焦，提供复现、测试和文档，并处理审查意见。

`CODEOWNERS` 表示所需关注者，不替代实际审查。只有一个维护者时，可以先以
CI 和自审证据合并；增加第二位维护者后，再把一人批准设置为仓库强制规则。

## 4. 分支与合并模型

仓库采用短分支、Pull Request 合入 `main` 的 trunk-based 流程，不维护长期
`dev` 分支。

允许的分支前缀：

- `feat/nna-<topic>`
- `fix/nna-<topic>`
- `refactor/nna-<topic>`
- `docs/nna-<topic>`
- `test/nna-<topic>`
- `chore/nna-<topic>`
- `hotfix/nna-<topic>`

Dependabot 等受控自动化分支使用其机器人前缀，不受人工 `nna-*` 前缀限制；它们仍然
必须通过同一套 PR、required checks 和合并策略。

规则：

- 禁止直接推送、强制推送或删除 `main`。GitHub 当前已启用保护：必须通过 Pull
  Request，required checks 为 `Repository hygiene`、`Frontend typecheck and build`、
  `Rust format, lint, and test`、`Native Stage (macos-14)` 和 `Native Stage (windows-2022)`，
  分支必须最新、线性历史且解决全部 review conversation。
- 管理员同样受保护规则约束。当前仓库只有一名维护者，required approval count 为 0；
  增加第二位维护者后提升为至少 1 人批准。
- 每个 PR 只解决一个可审查目标；重大工作先有 Issue 或 ADR。
- CI 通过、范围和证据完整后使用 squash merge。
- GitHub 已关闭 merge commit 与 rebase merge，并开启合并后自动删除远端工作分支。
- 不使用 unrelated-history 合并来处理普通同步问题。当前 GitHub 历史已经统一，
  后续同步必须保持共同祖先。

## 5. Issue 决策

新工作使用 GitHub Issue Forms：

- Bug：可复现的行为缺陷。
- Feature：用户问题、方案边界和可验收结果。
- Architecture / Tech Debt：模块边界、迁移、依赖或长期维护问题。

维护者根据证据添加 `type:*`、`area:*`、`priority:*`、`status:*` 和
`platform:*` 标签。优先级含义见 [Issue 治理](doc/ISSUES.md)，不能用情绪或
文件数量代替影响判断。

以下内容不直接进入实现：

- 只有概念、没有用户问题或验收条件的功能清单；
- 只从原型图推断出来的后端能力；
- 未经当前代码核对的旧 backlog；
- 不能说明许可来源的模型、字体、音频或第三方二进制。

## 6. 架构决策

满足任一条件时必须提交 ADR：

- 改变 React、Tauri、Native Stage 或 Engine 的所有权边界；
- 新增跨进程或持久化协议；
- 引入不可轻易替换的运行时依赖；
- 改变安全、隐私、更新、签名或发布模型；
- 移除 legacy Qt 或改变受支持平台。

ADR 使用 [模板](doc/architecture/adr/0000-template.md)，状态只能是
`Proposed`、`Accepted`、`Superseded` 或 `Rejected`。被替代的决策保留原文并
链接到新 ADR。

## 7. 验证与发布

任何状态报告都必须写明最高验证级别和平台：静态核对、自动检查通过、构建
通过、运行时冒烟、安装包验证或发布验证。macOS 结果不能代表 Windows，浏览器
预览不能代表 Tauri/Native Stage。

公开安装包发布前必须同时满足：

- 当前强制 CI 全绿；
- macOS 与 Windows 对应运行时和安装包门禁有记录；
- 签名、公证或代码签名流程完成；
- 包内容、第三方许可证和 Live2D 再分发条件已审计；
- 回滚目标、版本号和校验和可追溯。

在这些条件满足前，构建物只能标为开发预览，不能标为稳定发布。

## 8. 规范变更

治理规则通过普通 PR 修改。PR 必须说明改变了什么、为何现在改变、如何迁移现有
工作，以及线上 GitHub 设置是否需要同步。文档规则与仓库设置不一致时，不能
长期以“以后再配置”结束；应建立负责人明确的治理 Issue。
