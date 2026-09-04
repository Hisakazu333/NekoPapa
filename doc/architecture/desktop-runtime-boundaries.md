# NekoPapa 桌面运行时边界

状态：边界决策现行；客户端实现处于按设计系统 2.0 的重写过渡期（见
[ADR-0002](adr/0002-client-rewrite-external-live2d.md)）。发布成熟度：未达发布门禁。

## 结论

NekoPapa 保留四个清晰边界：

1. React/WebView 只负责页面、交互和短生命周期 UI 状态；主窗口不承载角色渲染。
2. Tauri/Rust host 负责应用窗口、权限、资源寻址和 sidecar 生命周期。
3. 外部 Native Stage（NekoCore-Nano C++）负责全部角色渲染——独立桌宠窗口、
   原生渲染、Live2D 模型与平台 C++ 依赖。
4. 外部 NekoCore-Nano 最终负责可持久、可同步的领域状态；当前尚未接入本仓库运行链。

本仓库不保存 Native Stage、NekoCore、Cubism Native SDK 或任何产品用角色渲染代码。
外部化决定见 [ADR-0001](adr/0001-external-native-stage.md)；重写与渲染外置决定见
[ADR-0002](adr/0002-client-rewrite-external-live2d.md)。

## 当前调用关系

旧实现（`app/control-desktop/`，含 `Live2DCompanion.tsx`、`stage.ts`、`stage.rs` 和
内嵌 Web Live2D）已移除，下列为目标关系，随新骨架落地逐项生效：

```text
Browser prototype preview
prototype pages ──> static assets ──> simulated data + Web Live2D（仅设计预览）

Tauri desktop（重写目标）
React UI ── typed bridge ──> Tauri commands
                                │
                                v
                         StageSupervisor
                                │ fixed sidecar name + controlled args
                                v
                    external nekopapa-native-stage（含角色渲染窗口）
```

在新骨架落地前，不存在可运行的桌面客户端；原型页是唯一的可视化入口。

## 所有权矩阵

| Owner | 拥有 | 不拥有 |
| --- | --- | --- |
| React | 页面、表单、导航、局部 view state | 进程、文件权限、持久领域状态 |
| Tauri/Rust | OS 窗口、资源解析、受控 command、sidecar 生命周期 | GPU 渲染算法、NekoCore 业务状态 |
| 外部 Native Stage | 独立窗口、帧循环、模型渲染、输入穿透 | 主窗口 UI、账号、网络业务 |
| 外部 NekoCore | 领域状态、规则、快照与高层意图 | DOM、Tauri 窗口、Stage 进程监督 |
| Protocol | 可版本化消息格式与语义 | 任一端内部实现 |

## Sidecar 交付边界

Tauri 只接受固定逻辑名 `nekopapa-native-stage`。本地开发通过
`NEKOPAPA_NATIVE_STAGE_BINARY` 或 [`native-prebuilt/`](../../native-prebuilt/README.md)
提供与 Rust target triple 匹配的可执行文件。

sidecar 提供方必须交付：

- 平台与架构匹配的完整可执行文件，而不是其他平台的 `.so`；
- 版本、不可变源码 revision、SHA-256、签名或公证状态；
- 协议兼容版本、启动参数、退出码和动态依赖清单；
- Cubism Native SDK 与其他第三方组件的许可和再分发说明。

本仓库中的零字节 placeholder 只解决 Tauri build script 的静态存在性检查，不能运行、
不能打包、不能作为兼容证据。

## 状态与事件方向

```text
User intent
  -> React action
  -> typed bridge
  -> Tauri command
  -> Stage protocol command
  -> external Stage

External Stage event
  -> Tauri validation and normalization
  -> typed UI event/state
```

旧 host 的 legacy v0 行为已随旧实现移除。新骨架的 host 必须直接按 Protocol v1 实现
handshake、schema validation 和结构化状态归一化；在两端兼容测试通过前，不得宣称
v1 已落地。

## 渲染面

主窗口是纯控制 UI，不包含角色画布；角色渲染全部在外部 Native Stage 的原生窗口中
完成（ADR-0002）。原生窗口不得覆盖在 WebView 上伪装成嵌入式画布。主窗口需要展示
角色状态时，消费 Stage 事件渲染状态 UI，不复制渲染画面。原型页中的 Web Live2D 只
用于设计预览，不是产品渲染路径。

## 安全约束

- UI 不提供任意可执行路径或 shell 参数；环境变量只由受控开发/打包环境读取。
- sidecar stdout 只承载协议 JSONL，日志写 stderr；host 必须限制大小并处理畸形输入。
- sidecar 崩溃、缺失或版本不兼容不能触发无限重启，也不能阻塞主窗口恢复。
- 模型路径、token、账户数据和用户隐私不得未经协议审计跨进程传输。
- 下载或更新外部产物前必须验证来源、hash、签名和许可。

## 非目标

- 不在本仓库恢复第二套 C++ Engine、Cubism Native SDK、Qt/QML 客户端或 WebView
  内嵌角色渲染。
- 不通过共享 C++ 类 ABI 把 host 与 Native runtime 重新耦合。
- 不把原型 fixture 描述成真实 NekoCore、云服务或持久化状态。
