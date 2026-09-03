# NekoPapa 文档中心

[English](README_EN.md) | 简体中文

本页按读者任务组织文档。当前实现、产品原型、目标协议和历史记录不能互相替代。

## 开始使用

- [项目 README](../README.md)：项目范围、当前状态和快速开始
- [贡献指南](../CONTRIBUTING.md)：分支、验证与 Pull Request 要求
- [开发环境](contributing/development-environment.md)：浏览器、Tauri 和外部 sidecar
- [Git 工作流](contributing/git-workflow.md)：同步、worktree、冲突与恢复
- [Issue 与 PR 指南](contributing/issue-and-pull-request-guide.md)：证据和 review 流程

## 产品与设计

- [产品基线](product/README.md)：原型如何转化为可验收的产品输入
- [原型设计基线](product/prototype-baseline.md)：页面清单、预览方式和判断标签
- [桌面 UI 架构](product/desktop-ui-architecture.md)：窗口、布局、缩放和可访问性规则

`prototype/desktop-app/` 是设计事实来源，不是实现完成清单。功能状态必须由代码、自动
检查和运行时证据共同确认。

## 架构与协议

- [架构索引](architecture/README.md)
- [桌面运行时边界](architecture/desktop-runtime-boundaries.md)
- [仓库结构](architecture/repository-layout.md)
- [构建与测试门禁](architecture/build-and-test-gates.md)
- [ADR 索引](architecture/adr/README.md)
- [ADR-0001：外部 Native Stage](architecture/adr/0001-external-native-stage.md)
- [Stage Protocol v1](../protocol/stage/v1/README.md)

## 规范与治理

- [项目治理](../GOVERNANCE.md)
- [工程规范](engineering/standards.md)
- [安全策略](../SECURITY.md)
- [GitHub Issues](https://github.com/Hisakazu333/NekoPapa/issues)：唯一任务状态来源

仓库不再保存 Markdown backlog 快照，也不保留已完成迁移的独立说明。此类记录通过
Git 历史、关闭的 Issue 和 Accepted ADR 查阅。

## 证据标签

| 标签 | 含义 |
| --- | --- |
| Source-reviewed | 源码或配置已核对 |
| Static-verified | 格式、类型、schema 或静态检查通过 |
| Build-verified | 指定平台完成构建 |
| Runtime-smoke-tested | 指定平台完成真实运行验证 |
| Package-verified | 安装包内容与安装行为已验证 |
| Release-verified | 已发布产物、签名与回滚链路已验证 |

提交文档前运行 `node scripts/check-documentation.mjs`，并确认中文、英文 README 的状态
描述一致。
