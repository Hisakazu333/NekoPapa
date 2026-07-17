# Architecture Decision Records

本目录保存会长期影响 NekoPapa 与 NNA native layer 边界的架构决策。ADR 记录为什么做决定、替代方案、迁移和回滚，不替代 GitHub Issue 的排期与验收。

## 何时需要 ADR

满足任一条件：

- 改变 React、Tauri、Native Stage、NekoCore-Nano 或 renderer 的状态所有权；
- 新增/删除进程、稳定 ABI、网络边界或持久数据格式；
- Stage protocol breaking change 或版本协商策略变化；
- 引入新的桌面框架、渲染器、第三方 SDK、模型格式或包管理策略；
- 改变默认桌面入口、顶层目录或 Frozen Legacy Qt 政策；
- 改变安装、签名、更新、回滚或敏感权限模型；
- 方案会约束多个 feature 或未来多个平台。

局部实现、等价重构和单一 feature 内部选择通常不需要 ADR，但 PR 要写明边界未变化。

## 文件与编号

1. 复制 [0000-template.md](0000-template.md)。
2. 使用下一个四位编号和短横线标题，例如 `0001-stage-protocol-versioning.md`。
3. ADR 与实现 PR 可以同一分支，但 ADR 必须在依赖它的代码合并前进入 `Accepted`。
4. 关联 GitHub Issue、PR、协议和受影响文档。

## 状态

- `Proposed`：讨论中，不能作为已接受边界。
- `Accepted`：已批准，实现和文档必须遵循。
- `Superseded`：由新 ADR 替代；原文件保留并链接替代它的 ADR。
- `Rejected`：保留被否决方案与原因，避免重复讨论。

Accepted ADR 只允许修复链接、拼写或补充不改变决定的证据。改变决定时新增 ADR，并把旧 ADR 标记为 `Superseded`。

## Review 门禁

- 至少一个受影响模块 owner review；跨安全/许可边界时增加对应 owner。
- 当前事实必须给出仓库路径、配置或运行证据。
- 至少记录两个可行替代方案，包括维持现状。
- 明确 rollout、rollback、兼容窗口和可观测信号。
- 更新[运行时边界](../desktop-runtime-boundaries.md)、[迁移计划](../qt-to-tauri-migration.md)或[项目结构](../repository-layout.md)中的受影响部分。
