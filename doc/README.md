# NekoPapa 文档中心

状态：现行索引

最后核对：2026-07-18

文档按用途分层，避免愿景、目标架构和当前实现互相覆盖。

## 从这里开始

| 主题 | 文档 | 性质 |
| --- | --- | --- |
| 产品与当前状态 | [项目 README](../README.md) | 当前事实 |
| 决策与合并规则 | [项目治理](../GOVERNANCE.md) | 规范 |
| 本地开发与提交 | [贡献指南](../CONTRIBUTING.md) | 规范 |
| 安全报告 | [安全策略](../SECURITY.md) | 规范 |
| GitHub 工作管理 | [Issue 治理](ISSUES.md) | 规范 + 已验证候选 |
| 工程规则 | [NNA 开发规范](%F0%9F%93%9C%20Nekonano-Aether%20%28NNA%29%20%E5%BC%80%E5%8F%91%E8%A7%84%E8%8C%83%E6%89%8B%E5%86%8C.md) | 规范 |
| GitHub 协作 | [NNA Issue 与 PR 指南](%F0%9F%90%BE%20Nekonano-Aether%20%28NNA%29%20%E5%8D%8F%E4%BD%9C%E6%8C%87%E5%8D%97%EF%BC%9AIssues%20%E4%B8%8E%20Pull%20Request.md) | 操作指南 |
| 项目目录 | [项目结构与分层](OpenNeko%20Engine%20%E5%AE%8C%E6%95%B4%E9%A1%B9%E7%9B%AE%E7%BB%93%E6%9E%84.md) | 当前 + 目标 |
| 桌面架构 | [架构索引](architecture/README.md) | 当前 + 决策入口 |
| 产品原型 | [原型目录](product/README.md) | 目标基线 |

## 文档类型

- **规范**：合并前必须遵守；与仓库设置不一致时需要治理 Issue。
- **当前事实**：必须能由代码、配置或验证记录复核。
- **目标/提案**：尚未实现，必须写明进入条件和验收方式。
- **历史参考**：只用于理解迁移背景，不指导新开发。
- **愿景**：描述长期产品方向，不作为交付状态。

## 架构与迁移

- [桌面运行时边界](architecture/desktop-runtime-boundaries.md)
- [Qt 到 Tauri 迁移状态](architecture/qt-to-tauri-migration.md)
- [构建与测试门禁](architecture/build-and-test-gates.md)
- [ADR 模板](architecture/adr/0000-template.md)
- [Stage Protocol v1 草案](../protocol/stage/v1/README.md)

## 产品资料

- [产品原型目录](product/README.md)：`img/` 的逐文件索引与验收字段。
- [数字生命愿景书](OpenNeko%20Engine%20%E2%80%94%20%E6%95%B0%E5%AD%97%E7%94%9F%E5%91%BD%E6%84%BF%E6%99%AF%E4%B9%A6.md)：愿景，不是当前功能清单。
- [世界观与角色设定](OpenNeko%20Engine%20%E2%80%94%20%E4%B8%96%E7%95%8C%E8%A7%82%E4%B8%8E%E7%8C%AB%E5%A8%98%E4%BA%BA%E8%AE%BE%E9%9B%86.md)：内容参考，不是正式资产授权。
- [桌面 UI 设计文档](OpenNeko%20Engine%20%E6%A1%8C%E9%9D%A2%E5%AE%A2%E6%88%B7%E7%AB%AFUI%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1.md)：需与原型目录配合使用；旧 Qt/QML 部分仅作历史参考。

## 维护规则

以下变更必须同步更新文档：

- 目录或模块所有权变化：更新项目结构和架构索引。
- 运行时、协议或权限边界变化：更新边界文档，必要时新增 ADR。
- 构建命令、版本或 CI 变化：更新 README、贡献指南和门禁。
- 界面目标或原型替换：更新原型目录，不覆盖旧图而不留映射。
- GitHub 分支、标签、合并或发布设置变化：更新治理和 Issue 规则。

文档中的 `当前` 必须可验证，`目标` 必须可验收，`历史` 必须显式标记。不能用
模糊的“已完成”“支持跨平台”或“生产可用”代替平台和验证级别。
