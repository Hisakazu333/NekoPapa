# NekoPapa GitHub Issue 治理与首批 Backlog

状态：现行规范

最后核对：2026-07-18

权威任务系统：<https://github.com/Hisakazu333/Nekopapa/issues>

本文件取代旧的 Gitee Issues 提交清单。旧清单中的 35 个
`ISS-*` 条目大多基于已废弃的 Qt/Gitee 架构或未验证的远期设想，不能直接迁移
为当前 GitHub Issues。下面只保留由当前代码、仓库配置或产品原型能够证明的工作。

## 1. Issue 是什么

Issue 用来记录一个可判断、可分配、可验收的问题。愿景、随手想法和大型功能树
先进入讨论或设计文档，不应一次性生成几十个“看起来完整”但无法验真的任务。

以下改动通常需要 Issue：

- 用户可见 Bug、功能或行为变化；
- 跨模块重构、协议变化和依赖升级；
- 安全、隐私、许可、安装包和发布工作；
- 超出一个小 PR 的技术债；
- 改变原型基线或架构边界。

拼写、坏链接等低风险单文件修正可以直接提交 PR，但 PR 仍需说明证据和验证。

## 2. 表单选择

| 表单 | 使用条件 | 必需证据 |
| --- | --- | --- |
| Bug | 当前行为偏离可复现预期 | commit、平台、步骤、实际/期望、日志或截图 |
| Feature | 有明确用户问题和交付边界 | 用户场景、非目标、替代方案、验收条件 |
| Architecture / Tech Debt | 边界、迁移、依赖或维护性问题 | 当前证据、风险、目标边界、迁移与回滚 |

界面 Issue 还必须填写：

- `img/` 原型文件名或“无对应原型”；
- Tauri 桌面或浏览器预览；
- 操作系统、窗口尺寸、显示缩放和设备像素比；
- 当前截图/视频及期望状态；
- 拖拽、缩放、导航、窗口按钮等交互的可观察验收条件。

## 3. 标签体系

一个已完成 triage 的 Issue 至少有一个 `type:*`、一个 `area:*`、一个
`priority:*`。状态和平台标签按需添加。

### 类型

- `type:bug`
- `type:feature`
- `type:tech-debt`
- `type:docs`
- `type:security`

### 所有权区域

- `area:ui`：React、样式、Cubism Web 和产品原型。
- `area:desktop-host`：Tauri/Rust、窗口和应用生命周期。
- `area:native-stage`：独立 C++ 桌面角色窗口。
- `area:engine`：NNA native layer 公共 API 和领域实现。
- `area:protocol`：跨进程 schema、JSONL 和兼容性。
- `area:build-release`：CI、依赖、安装包、签名和发布。
- `area:governance`：仓库设置、模板、规范和文档系统。

### 优先级

- `priority:p0`：已发布版本存在安全事件、数据损坏或无法启动，需立即处理。
- `priority:p1`：当前核心开发路径被阻断，或高影响 Bug 无合理绕过方式。
- `priority:p2`：已确认的重要功能、质量或技术债，进入近期计划。
- `priority:p3`：低影响改进或尚未排期的探索。

### 状态与平台

- `status:needs-triage`：尚未完成证据和范围判断。
- `status:blocked`：存在明确外部依赖，Issue 中必须写出解除条件。
- `platform:macos`、`platform:windows`、`platform:linux`。

不要创建 `in progress` 标签代替负责人和关联 PR；不要用 `critical` 等第二套优先
级体系。

## 4. 生命周期

```text
提交 -> needs-triage -> 接受并排期 -> PR -> 验证 -> 关闭
                       \-> blocked
                       \-> 不采纳/重复/无法复现
```

### Ready for Development

进入开发前必须满足：

- 问题、范围和非目标明确；
- 当前事实有代码、配置、日志或原型证据；
- 验收条件可以由人或自动化检查判断；
- 依赖和平台范围明确；
- 安全、许可或数据迁移影响已标出；
- 跨运行时决策已有 ADR 或被要求在 PR 中补充。

### Done

Issue 只有在以下条件满足时才关闭：

- 关联 PR 已合入 `main`；
- 适用 CI 和本地检查通过；
- 验收证据记录在 PR 或 Issue；
- 文档、schema、原型状态和用户可见文本已同步；
- 未验证的平台和剩余限制明确记录；
- 后续工作拆成独立 Issue，而不是藏在合并说明中。

## 5. 首批已验证 Backlog

下面是治理阶段可创建的 GitHub Issues。它们是候选定义，不表示已经完成，也不
因为出现在本文中就自动进入开发。

### GOV-001：启用仓库治理基线

- 类型/区域/优先级：`type:tech-debt`、`area:governance`、`priority:p1`
- 证据：仓库此前没有 CI、Issue/PR 模板、CODEOWNERS、Dependabot 或保护规则；
  远端只有未保护的 `main`。
- 范围：合入治理文件；统一 squash merge；自动删除已合并分支；在基线 CI 稳定
  后配置 `main` ruleset。
- 验收：线上设置与 [GOVERNANCE.md](../GOVERNANCE.md) 一致，required checks 名称
  与实际 workflow 完全相同。

### CI-001：建立真实可执行的 CI 基线

- 类型/区域/优先级：`type:tech-debt`、`area:build-release`、`priority:p1`
- 证据：仓库此前没有 workflow；前端只有 `check` 和 `build`，没有 lint/test；
  Rust 已有 fmt/clippy/test 命令。
- 范围：repository hygiene、前端 `npm ci/check/build`、Rust
  `fmt/clippy/test`；不把尚不存在的检查伪装成 required checks。
- 验收：PR 和 `main` 都会触发，锁文件安装可复现，job 名称可用于 ruleset。

### TEST-001：补齐前端、C++ 与协议自动测试

- 类型/区域/优先级：`type:tech-debt`、`area:build-release`、`priority:p1`
- 证据：前端没有单元测试脚本，CMake 没有 CTest，Stage Protocol v1 没有自动
  schema/JSONL 验证器；Rust 当前只有窗口状态相关单元测试。
- 范围：按模块建立最小测试基线和负向用例，随后把稳定命令加入 CI。
- 验收：每项测试能在干净 checkout 中独立运行，失败时指出具体模块和用例。

### REPO-001：清理跟踪的系统文件并限制打包资源

- 类型/区域/优先级：`type:tech-debt`、`area:build-release`、`priority:p1`
- 证据：最新 `main` 跟踪 12 个 `.DS_Store` 和 18 个 Cubism 示例 `.gradle`
  缓存文件；Vite 当前 `publicDir` 指向整个 `assets/`，Tauri 又单独打包
  `assets/live2d`，资源边界重复且可能带入本机文件。
- 范围：从索引移除系统文件；添加 hygiene 检查；为 Web 和 Tauri 建立显式资源
  allowlist/manifest；不在本 Issue 中删除有许可要求的第三方源码。
- 验收：生成的 `dist` 和安装包内容可列举、无 `.DS_Store`、无重复模型副本和开发
  SDK 样例。

### SEC-001：收紧 Tauri 与 WebView 安全边界

- 类型/区域/优先级：`type:security`、`area:desktop-host`、`priority:p1`
- 证据：当前 Tauri 配置使用 `csp: null` 和 `macOSPrivateApi: true`，并启用了 shell
  plugin；发布级 capability 和 CSP 尚无审计记录。
- 范围：最小 capability、固定 sidecar/参数、生产 CSP、日志脱敏、异常子进程输入
  和退出行为。
- 验收：安全测试覆盖任意命令/路径拒绝、畸形输出、Stage 缺失/崩溃和敏感信息
  泄露；开发与发布配置差异有文档。

### PROTO-001：实现并验证 Stage Protocol v1

- 类型/区域/优先级：`type:feature`、`area:protocol`、`priority:p1`
- 证据：`protocol/stage/v1/` 只有草案 schema 和示例；当前 Stage 流仍是未版本化
  v0，Tauri 主要通过进程生命周期管理 Stage。
- 范围：schema 验证器、handshake、版本拒绝、相关 ID、stdout/stderr 隔离、EOF 与
  畸形输入；不加入模型热加载、逐帧参数或账户数据。
- 验收：两端正向和负向测试通过，v0 不再被描述为 v1。

### ARCH-001：冻结并退出不可回退的 legacy Qt 客户端

- 类型/区域/优先级：`type:tech-debt`、`area:desktop-host`、`priority:p2`
- 证据：`app/stage-desktop/` 仍包含旧登录、同步、Git、模型和 Dock 逻辑，但入口
  引用不存在的 `qml/main.qml`，已不能作为可构建回退目标。
- 范围：先建立只读归档和能力清单，迁移仍有价值的服务；禁止继续双写；删除动作
  单独 ADR/PR 执行。
- 验收：每项保留能力有新 owner 或明确废弃，默认构建和文档不再指向 Qt。

### ARCH-002：迁移 `openneko` legacy 技术标识

- 类型/区域/优先级：`type:tech-debt`、`area:engine`、`priority:p2`
- 证据：产品和桌面包已统一为 NekoPapa，但 CMake project/target、sidecar binary、
  Stage namespace、协议示例和 Frozen Qt 资源 URI 仍包含 `OpenNeko/openneko`。
- 范围：确定 `nna` namespace、`NNA_` option 和 `nekopapa-*` app binary 的目标命名；
  为 externalBin、构建脚本和消费者提供有期限的兼容迁移。
- 验收：新产品文案和文档名称不出现 legacy 品牌；源码标识迁移后，干净 checkout、
  Tauri sidecar、协议 fixtures 和 macOS/Windows build 通过；兼容 alias 有删除版本。

### DESKTOP-001：建立 macOS/Windows Native Stage 验证矩阵

- 类型/区域/优先级：`type:tech-debt`、`area:native-stage`、`priority:p1`
- 证据：源码包含 macOS/Windows 路径，但没有跨平台 CI 或发布级运行记录。
- 范围：干净构建、真实模型 health check、透明窗口、缩放、输入穿透、多屏/DPI、
  sleep/wake、父进程退出和崩溃恢复。
- 验收：两平台分别保留工具链、命令、日志和可观察结果；单平台通过不关闭另一平台
  任务。

### UI-001：以 `img/` 建立桌面视觉验收链路

- 类型/区域/优先级：`type:tech-debt`、`area:ui`、`priority:p1`
- 证据：治理文档已登记 48 张原型及一组字节级重复图，但代码、Issue/PR 和自动
  viewport tests 仍无法反向追踪采用了哪个 `P-xxx` 状态。
- 范围：维护原型基线；Issue/PR 强制引用原型 ID；为原生标题栏、顶部导航、主页
  缩放和外层控件建立桌面尺寸验收场景。
- 验收：48/48 图像可追踪；每个已实现页面有原型映射、当前截图和可执行验收条件；
  无法识别或重复图明确标记。

### RELEASE-001：建立可审计的桌面发布流程

- 类型/区域/优先级：`type:tech-debt`、`area:build-release`、`priority:p2`
- 证据：仓库没有 Releases、tags、受保护 release environment、签名/公证 CI 或包
  内容审计；Cubism SDK/模型还有额外再分发条件。
- 范围：版本与 changelog、macOS 签名公证、Windows 签名、SBOM/许可证清单、包内容
  allowlist、校验和、安装/卸载与回滚。
- 验收：从 tag 到已验证安装包的过程可复现，秘密只进入受保护发布 job，第三方
  通知随包分发。

## 6. 旧 `ISS-*` 条目的处理

- CI、模板、CONTRIBUTING、测试、CHANGELOG、CMake/目录和 UI 占位等仍有效部分，
  已并入上面的治理候选。
- ODE、生理裁剪、双 PAD、梦境、IoT、Lua、训练管线等远期条目没有当前代码或已
  批准产品范围，暂不迁移。若重新提出，必须使用 Feature/Architecture 表单并给出
  当前用户问题和边界。
- 旧条目中的 Qt/QML、Gitee、Windows 硬编码和“不相关历史阻塞”等描述已失效，
  不得继续作为实现依据。
- 是否创建实际 GitHub Issue 由维护者 triage 决定；创建后用 GitHub 编号替代本文
  中的候选 ID，并在此处保留映射。
