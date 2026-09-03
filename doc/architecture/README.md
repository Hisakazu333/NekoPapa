# NekoPapa 架构索引

状态：现行边界，项目处于开发预览阶段。

## 当前结论

- 本仓库拥有 React UI、Tauri/Rust host、产品原型和 Stage 协议。
- Native Stage 与 NekoCore-Nano 的 C++ 实现由外部仓库拥有并发布预构建产物。
- 主窗口内的角色由 Pixi.js/Cubism Web 渲染；独立桌宠窗口由外部 sidecar 渲染。
- 没有真实 sidecar 时，浏览器预览仍可用，但不能声称桌面 runtime 或安装包已验证。
- Qt/QML、同仓 C++ Engine 和旧 Native Stage 源码只保留在 Git 历史中。

## 文档地图

- [桌面运行时边界](desktop-runtime-boundaries.md)：进程、状态和渲染所有权
- [仓库结构](repository-layout.md)：当前目录及允许的依赖方向
- [构建与测试门禁](build-and-test-gates.md)：CI、真实产物和发布证据
- [ADR 索引](adr/README.md)：需要长期保留理由的架构决策
- [ADR-0001](adr/0001-external-native-stage.md)：外部化 Native Stage 的决定
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
