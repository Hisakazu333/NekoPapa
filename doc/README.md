# NekoPapa 文档中心

[English](README_EN.md) | 简体中文

本页按读者任务组织 NekoPapa 文档。当前事实、产品意图、工程规范和历史资料使用不同入口，避免把原型或愿景误读为已实现功能。

## 开始使用

这些文档帮助你运行项目并提交第一个变更：

- [项目 README](../README.md)：项目定位、当前状态和 Quick start
- [贡献指南](../CONTRIBUTING.md)：分支、验证和 Pull Request 要求
- [开发环境指南](contributing/development-environment.md)：macOS、Windows、浏览器预览和 Native Stage
- [Git 工作流](contributing/git-workflow.md)：worktree、同步、冲突与恢复
- [Issue 与 Pull Request 指南](contributing/issue-and-pull-request-guide.md)：表单、证据和 review 流程

## 治理项目

这些文档定义 GitHub 与工程决策规则：

- [项目治理](../GOVERNANCE.md)：名称、事实来源、分支、合并、ADR 和发布规则
- [Issue 治理与首批 backlog](ISSUES.md)：标签、生命周期、Ready/Done 和已验证候选
- [NNA 工程规范](engineering/standards.md)：React、Rust、C++、协议、依赖和资产规则
- [安全策略](../SECURITY.md)：私密漏洞报告和重点安全边界

## 设计产品

这些文档把 `img/` 原型转化为可追踪的产品输入：

- [产品原型基线](product/README.md)：模块映射、Issue 切片和使用规则
- [48 张原型资产目录](product/prototype-baseline.md)：SHA-256、尺寸、重复关系和验收锚点
- [桌面 UI 架构与验收](product/desktop-ui-architecture.md)：原生标题栏、居中导航、页面布局和小屋缩放规则

原型只描述目标外观和状态。实现状态必须由代码、自动检查和运行时证据共同确认。

## 修改架构

这些文档定义当前边界和渐进迁移：

- [桌面架构索引](architecture/README.md)
- [桌面运行时边界](architecture/desktop-runtime-boundaries.md)
- [项目结构与分层](architecture/repository-layout.md)
- [Frozen Legacy Qt 到 Tauri 的迁移](architecture/qt-to-tauri-migration.md)
- [构建与测试门禁](architecture/build-and-test-gates.md)
- [架构决策记录](architecture/adr/README.md)
- [Stage Protocol v1](../protocol/stage/v1/README.md)

## 查阅历史资料

[历史文档索引](legacy/README.md)保存已退出当前产品口径的早期愿景和角色资料。历史内容不指导新开发，也不代表 NekoPapa roadmap。

## 判断文档声明

每条关键声明属于一种证据类型：

| 类型 | 含义 |
| --- | --- |
| 当前事实 | 当前源码、配置或仓库状态可以直接证明 |
| 规范 | 合并前必须遵守，仓库设置应与之同步 |
| 目标决策 | 已接受但尚未完整实现，必须有进入条件 |
| 产品意图 | 原型或 Issue 定义的目标，不代表实现 |
| 历史资料 | 只解释过去，不创建当前承诺 |

报告进度时还要写明验证层级：Source-reviewed、Static-verified、Build-verified、Runtime-smoke-tested、Package-verified 或 Release-verified。

## 维护文档

提交文档变更时检查：

- 当前路径、版本、命令和 CI job 与仓库一致
- README 中文与英文状态一致
- 产品变更引用 `P-xxx` 和 GitHub Issue
- 架构边界变化包含 ADR 或明确说明为何不需要
- 相对链接、代码块语法和 `git diff --check` 通过
- legacy 标识只出现在迁移说明、实际命令或历史目录
