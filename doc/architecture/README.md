# NekoPapa 架构索引

状态：现行边界，项目处于开发预览阶段。

## 当前结论

- 本仓库拥有 React UI、Tauri/Rust host、产品原型和 Stage 协议。
- Native Stage 与 NekoCore-Nano 的 C++ 实现由外部仓库拥有并发布预构建产物。
- 角色（Live2D）渲染全部由外部 NekoCore-Nano C++ runtime 承担；主窗口只承载控制
  UI，内嵌 Web 角色渲染已随旧实现移除（ADR-0002）。
- 客户端正按设计系统 2.0（`prototype/desktop-app/`）重写；新骨架落地前没有可运行
  的桌面客户端。
- Qt/QML、Flutter、同仓 C++ Engine 和旧 Native Stage 源码只保留在 Git 历史中。

## 文档地图

- [桌面运行时边界](desktop-runtime-boundaries.md)：进程、状态和渲染所有权
- [仓库结构](repository-layout.md)：当前目录及允许的依赖方向
- [构建与测试门禁](build-and-test-gates.md)：CI、真实产物和发布证据
- [ADR 索引](adr/README.md)：需要长期保留理由的架构决策
- [ADR-0001](adr/0001-external-native-stage.md)：外部化 Native Stage 的决定
- [ADR-0002](adr/0002-client-rewrite-external-live2d.md)：客户端重写与角色渲染全部外置
- [Stage Protocol v1](../../protocol/stage/v1/README.md)：host 与 sidecar 的目标 JSONL 契约

## 事实、目标和历史

| 类型 | 示例 | 能否证明当前可用 |
| --- | --- | --- |
| 当前实现 | Rust command、React bridge、lockfile | 可以，但只限其直接行为 |
| 目标契约 | Protocol v1 schema | 不可以，必须有两端兼容测试 |
| 产品原型 | `prototype/desktop-app/` | 不可以，只定义 UI 意图 |
| 外部产物 | Native Stage release | 只有记录版本、hash 和运行结果后才可以 |
| Git 历史 | 已删除 Qt/C++ 源码 | 不可以，不是当前入口 |

## 变更规则

改变进程边界、协议主版本、预构建二进制信任模型、持久状态 owner 或支持平台时，必须
新增或替代 ADR。实现变更同时更新配置、CI、文档和发布门禁，不能只修改架构图。
