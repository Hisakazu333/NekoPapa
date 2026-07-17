# NekoPapa 桌面架构治理

状态：规范性文档。当前实现仍处于开发预览阶段。

本目录只描述已经核对过的当前事实、已接受的目标边界和进入下一阶段必须满足的门禁。产品愿景、原型图和远期模块清单不能作为“已经实现”的证据。

## 文档地图

- [桌面运行时边界](desktop-runtime-boundaries.md)：当前依赖图、目标依赖图、模块所有权和禁止依赖。
- [Qt 到 Tauri 迁移](qt-to-tauri-migration.md)：Frozen Legacy Qt 政策、分阶段迁移和回滚条件。
- [构建与测试门禁](build-and-test-gates.md)：PR、跨平台构建、运行时和发布证据。
- [Stage Protocol v1](../../protocol/stage/v1/README.md)：Tauri host 与 Native Stage 之间的 JSONL 草案。
- [项目结构](../OpenNeko%20Engine%20完整项目结构.md)：当前目录、目标目录和文件归属规则。
- [架构决策记录](adr/README.md)：需要 ADR 的变更、状态流转和模板。

## 当前产品口径

- `NekoPapa` 是产品、Tauri 桌面包和 GitHub 仓库名称。
- `OpenNeko Engine` 是 C++ 引擎名称；公开 C++ 命名空间继续使用 `nna`。
- `app/control-desktop/` 是当前桌面入口。
- `app/live2d-stage/` 是独立 Native Stage sidecar。
- `app/stage-desktop/` 是 **Frozen Legacy Qt** 代码，只用于迁移取证，不是可发布回退版本。
- `protocol/stage/v1/` 是目标协议；当前 Rust/C++ 运行链仍使用未版本化 v0 消息。

## 事实、目标和证据

文档中的陈述必须标记为以下一种：

| 类型 | 含义 |
| --- | --- |
| 当前事实 | 能从当前受控源码、配置或仓库状态直接证明 |
| 目标决策 | 已接受但尚未完整实现的依赖方向或模块边界 |
| 迁移计划 | 有入口、退出条件和回滚点的待执行工作 |
| 愿景 | 研究或产品方向，不创建空目录，也不算完成度 |

“代码存在”“Schema 可解析”“本机能编译”“真实模型运行”“安装包可发布”是不同证据等级。统一定义见[构建与测试门禁](build-and-test-gates.md)。

## 变更规则

以下变更必须同步更新架构文档，并按[ADR 触发清单](adr/README.md)新增 ADR：

- 改变桌面默认入口或进程拓扑；
- 改变 C++ Core、渲染器、Tauri host 或 React 的状态所有权；
- 新增或破坏 Stage 协议字段、版本或生命周期语义；
- 引入新的平台运行时、第三方 SDK、模型许可或安装包资源；
- 解冻、删除或从 Legacy Qt 迁移功能；
- 移动顶层目录或改变生成物、原型图、发布资产边界。

架构文档不能长期保存易失真的本机结论。涉及分支、远端、CI 或平台构建状态时，PR 必须附上当次命令、提交号和平台证据。
