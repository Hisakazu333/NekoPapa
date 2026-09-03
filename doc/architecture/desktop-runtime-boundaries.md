# NekoPapa 桌面运行时边界

状态：当前事实与已接受决策。发布成熟度：未达发布门禁。

## 结论

NekoPapa 保留四个清晰边界：

1. React/WebView 负责页面、交互和短生命周期 UI 状态。
2. Tauri/Rust host 负责应用窗口、权限、资源寻址和 sidecar 生命周期。
3. 外部 Native Stage 负责独立桌宠窗口、原生渲染和平台 C++ 依赖。
4. 外部 NekoCore-Nano 最终负责可持久、可同步的领域状态；当前尚未接入本仓库运行链。

本仓库不保存 Native Stage、NekoCore 或 Cubism Native SDK 的源码。该决定见
[ADR-0001](adr/0001-external-native-stage.md)。

## 当前调用关系

```text
Browser preview
React UI ──> browser adapter ──> simulated Stage status
    └──────> Pixi.js / Cubism Web canvas

Tauri desktop
React UI ── typed bridge ──> Tauri commands
                                │
                                v
                         StageSupervisor
                                │ fixed sidecar name + controlled args
                                v
                    external nekopapa-native-stage
```

源码当前可以证明：

- `src/bridge/stage.ts` 隔离浏览器模拟与 Tauri invoke；
- `src-tauri/src/stage.rs` 监督固定 sidecar，转发 stdout 事件，并在停止时发送 legacy v0
  shutdown 消息；
- `scripts/prepare-stage.mjs` 只复制外部预构建产物，不编译 C++；
- `src/components/Live2DCompanion.tsx` 管理主窗口内的 Web Live2D 渲染；
- NekoCore、云同步、对话服务和持久记忆没有完整 runtime 接入。

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

当前实现尚未完成 Protocol v1 handshake、schema validation 和结构化状态归一化。Rust host
仍会把非空 stdout 行直接转发给 UI，并以未版本化 JSON 写入 shutdown。这些是明确的
legacy 兼容行为，不得描述为 v1 已落地。

## 渲染面

主窗口角色必须留在 WebView canvas 中，因为它参与 DOM 裁剪、层叠、滚动和输入。外部
Native Stage 是独立顶层窗口，不能覆盖在 WebView 上伪装成嵌入式画布。两个渲染面可以
有不同实现，但最终应消费同一领域意图，避免状态互相矛盾。

## 安全约束

- UI 不提供任意可执行路径或 shell 参数；环境变量只由受控开发/打包环境读取。
- sidecar stdout 只承载协议 JSONL，日志写 stderr；host 必须限制大小并处理畸形输入。
- sidecar 崩溃、缺失或版本不兼容不能触发无限重启，也不能阻塞主窗口恢复。
- 模型路径、token、账户数据和用户隐私不得未经协议审计跨进程传输。
- 下载或更新外部产物前必须验证来源、hash、签名和许可。

## 非目标

- 不在本仓库恢复第二套 C++ Engine、Cubism Native SDK 或 Qt/QML 客户端。
- 不通过共享 C++ 类 ABI 把 host 与 Native runtime 重新耦合。
- 不把原型 fixture 描述成真实 NekoCore、云服务或持久化状态。
