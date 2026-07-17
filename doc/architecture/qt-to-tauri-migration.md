# Frozen Legacy Qt 到 Tauri 的迁移计划

状态：执行计划。迁移方向：单向迁入 Tauri，不再维护双产品主线。

## 当前事实

当前桌面产品入口已经是 `app/control-desktop/`：

- React/WebView 提供主窗口和内嵌 Cubism Web 角色；
- Tauri/Rust host 提供窗口状态、权限和 Native Stage 子进程监督；
- `app/live2d-stage/` 提供独立透明桌宠窗口；
- 根 CMake 的 `NNA_BUILD_APP` 默认值是 `OFF`；
- `app/stage-desktop/` 仍保留 Qt/C++ 代码，但受控树中没有它加载的 `qml/main.qml`；
- `build_macos.sh`、`build_linux.sh`、`build_win.bat` 仍按旧 Qt 输出命名，不能作为当前产品构建入口；
- Stage Protocol v1 仍是草案，当前 host 与 sidecar 只实现 v0 消息。

因此，Legacy Qt 不是经过验证的回退版本。提交 `fb03c9e` 只能作为删除前历史参考；除非在隔离环境中重新构建、运行并记录依赖，否则不能把它称为可恢复发布。

## 仓库历史状态

旧文档关于“本地 `main` 与 `origin/main` 没有共同祖先”的结论已经失效。仓库在 `19bf33b` 合并了两段历史；本次文档刷新基线 `6d575bf` 位于当前 `origin/main`，并存在正常 merge base。

这不是永久豁免。任何拉取、发布、分支清理或迁移 PR 开始前仍必须重新执行：

```bash
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short
git merge-base HEAD origin/main
git rev-list --left-right --count HEAD...origin/main
```

命令输出和目标分支必须进入 PR 证据；不得根据旧文档或旧终端输出推断当前状态。

## Frozen Legacy Qt 政策

`app/stage-desktop/` 从现在起定义为 **Frozen Legacy Qt**：

允许：

- 阅读代码并建立功能/数据/权限清单；
- 为迁移补充最小 characterization test 或取证脚本；
- 修复妨碍取证的构建问题，但必须由单独 Issue/ADR 说明；
- 提取与 Qt 无关、已有测试保护的 `nna` 代码。

禁止：

- 新增产品功能、页面或业务状态；
- 把 Qt 恢复为默认构建或发布入口；
- 在 Qt 与 React 两边同时实现同一功能；
- 复用 QML/Qt 类型作为新的跨运行时契约；
- 仅为了让旧截图可运行而绕开 Tauri 边界；
- 在没有迁移归属和验证证据时删除历史实现。

Legacy Qt 目录必须最终增加冻结说明和 owner，但该改动不与本次文档治理混在一起。

## 迁移原则

- 先建立接口和测试，再移动文件或删除旧实现。
- 每次只迁移一条可运行的垂直切片，保持 Tauri 主窗口可启动。
- C++ Core、渲染器、Tauri 和 React 的依赖方向遵循[运行时边界](desktop-runtime-boundaries.md)。
- v0 与 v1 协议并存时使用显式 adapter，不做“看起来都能解析”的宽松兼容。
- 浏览器 preview、Native runtime、真实模型和无模型 health check 必须分别标识。
- 所有阶段都有退出条件和回滚点；回滚使用正常 Git 提交，不改写共享历史。

## Phase 0：治理基线

目标：在继续功能开发前建立可信入口。

工作：

- 统一当前/目标架构和 Frozen Qt 口径；
- 建立 GitHub Issue/PR 模板、CODEOWNERS、标签和分支保护；
- 建立最小 CI、依赖锁定、第三方清单、原型 manifest 和生成物规则；
- 修复根构建脚本的入口歧义：当前脚本与 legacy 脚本必须分名；
- 建立唯一版本来源，消除 CMake `0.1.0`、桌面包 `0.2.0` 和 UI `v0.1.0` 漂移。

退出条件：

- CI 的现有 job ID `repository-hygiene`、`frontend`、`rust-host`、`native-stage` 已在真实 PR/目标分支运行并保存结果；
- 当前 `repository-hygiene` 脚本已运行通过，并为尚未实现的 `docs` 门禁补齐固定脚本/job ID 和成功判据；
- 默认开发命令只指向 Tauri；
- 没有新的生成缓存、`.DS_Store`、安装包或 sidecar binary 被提交；
- 当前功能与 prototype/fixture 的边界可从 README 和 UI 状态判断。

回滚：只回滚治理配置或文档提交，不改变当前 Tauri 运行链。

## Phase 1：在原路径内建立可测试模块

目标：先降低职责混杂，不做顶层大搬家。

工作：

- React 将页面 ID、Stage model、Live2D adapter 和 Tauri bridge 从具体组件中抽成窄模块；
- Tauri 将 `stage.rs` 内的 supervisor、process driver、resource resolver、protocol codec 和 command DTO 分开；
- Native Stage 将 `stage_runtime.cpp` 内的 v0 codec、GLFW window/input、renderer 和 loop 分开；
- CMake 增加 CTest 入口；前端增加 lint、unit test 和 viewport test；
- 为现有 prototype 数据增加明确 fixture adapter，不直接替换成半成品网络调用。

退出条件：

- 页面编排不反向定义共享 feature 类型；
- 进程状态机可以使用 fake child process 测试；
- CLI option、v0 codec 和纯状态转换不需要真实窗口即可测试；
- 现有用户可见行为没有因物理移动目录而变化。

回滚：保留旧 module facade，由 facade 调用新模块；失败时回退调用路径，不恢复 Qt。

## Phase 2：Stage Protocol v1 垂直切片

目标：让 Tauri 与 Native Stage 形成第一个严格、可测试的版本化会话。

最小范围：

- `stage.handshake` 与版本拒绝；
- `stage.ready`；
- show、hide、set_passthrough、shutdown；
- 关联 `message_id` / `reply_to` 的 command result；
- one-shot health；
- malformed JSON、unknown field、EOF、超时和 child exit。

退出条件：

- schema、正例和反例在 CI 中通过；
- Rust 与 C++ 使用同一协议 fixtures；
- ready 前无法发送生命周期命令；
- stdout 只有协议 JSONL，stderr 只有日志；
- UI 状态来自 supervisor 状态机，不是原始 JSON 文本；
- v0 adapter 有删除条件和调用计数，不继续增加字段。

回滚：host 与 Stage 在一个发布窗口内保留最后一个共同协议版本；不接受未知消息作为降级策略。

## Phase 3：迁移 Qt 功能所有权

目标：把仍有价值的 legacy 能力逐项迁入明确 owner，而不是复制类文件。

| Legacy 能力 | 目标 owner | 迁移要求 |
| --- | --- | --- |
| 主窗口尺寸、位置、原生 chrome | Tauri platform/window service | 跨 DPI/多屏测试，不复用 QWindow 类型 |
| 登录、profile、设备登录、同步 | Tauri application service + React feature port | token 不进入 WebView；API DTO 独立于 Qt JSON |
| 模型发现、导入、选择 | Tauri resource/model service | 路径校验、许可 metadata、原子写入 |
| Live2D 主窗口展示 | Web Live2D adapter | DOM compositor、resize/DPR、隐藏暂停 |
| 透明桌宠 | Native Stage | 不承载账号或网络业务 |
| NekoCore-Nano 状态 | 稳定 Core port/C ABI | 先 ADR 决定进程/库边界；快照只读 |
| Agent workspace/Git 读取 | 独立 Agent workspace service | 最小权限、路径 confinement、命令 allowlist |
| 主题和图标 | React shared UI/tokens | 不迁移 Qt singleton API |

每项迁移必须有：当前行为证据、目标 owner、数据契约、权限、测试、feature flag/回滚和删除清单。

退出条件：

- 所有保留功能都有唯一 Tauri/React/Stage/Core owner；
- Qt 侧不再是任何生产数据格式或业务规则的唯一实现；
- 未迁移功能被明确关闭或列为不进入首发范围。

回滚：通过 feature flag 或 adapter 恢复迁移前的当前 Tauri 行为，或关闭未完成 feature；不把 Frozen Qt 重新设为默认入口。涉及数据时必须先证明旧格式仍可读取或已完成备份。

## Phase 4：拆分 Core 与 Native 渲染 target

目标：让 `nna::core` 不再因 `openneko` target 自动暴露 Cubism/OpenGL。

工作：

- 建立独立 Core target，只包含领域类型和规则；
- 建立 Live2D Native adapter target，依赖 Cubism/OpenGL 和 Core 的窄意图类型；
- 保留临时兼容 target 名，逐个迁移消费者；
- Native Stage 只链接所需 target；
- 第三方 SDK 通过单一 CMake adapter 暴露，业务 target 不读供应商目录。

退出条件：

- Core public headers 不包含 Cubism、OpenGL、GLFW、Qt 或 Tauri；
- Core unit tests 在没有 Live2D SDK 时可配置和运行；
- Native Stage 和 Frozen Qt 的依赖都可从 CMake graph 解释；
- 安装/export target 不泄漏第三方私有 include path。

回滚：兼容 `openneko` facade 在观察窗口内保留；按消费者逐个恢复旧链接关系。不得用重新合并 Core/graphics 源码掩盖 target 边界失败。

## Phase 5：物理目录收敛

目标：在 import、target 和测试稳定后执行目录移动。

工作：

- 按[目标目录](repository-layout.md)移动 feature、platform、protocol 和 adapter；
- 将产品原型从 `img/` 迁到带 manifest 的非运行时目录；
- 运行时资产改为 allowlist 和 manifest 驱动；
- 隔离 legacy build scripts 和第三方供应商内容；
- 删除重复、未引用和打包污染资产。

目录移动单独成 PR，只做机械 import/build 更新，不同时改变产品行为。

退出条件：

- TypeScript import、Rust module、CMake target、文档相对链接和资产 manifest 全部指向新路径；
- `frontend`、`rust-host`、`native-stage` 及适用 protocol/package checks 在移动后的干净 checkout 通过；
- Vite/Tauri 安装包内容清单不含原型、SDK Samples、缓存或重复未登记资产；
- 旧路径只剩有删除期限的兼容 facade，或已由同一 PR 删除；
- 目录移动 diff 不包含功能、协议或产品视觉变化。

回滚：目录收敛使用独立机械提交；任一 import/build/package 判据失败时整体 revert 该提交并保留旧路径，不以临时复制两份源码作为长期兼容。

## Phase 6：删除 Frozen Legacy Qt

只有同时满足以下条件才可删除：

- 所有保留能力完成 Phase 3 归属；
- Tauri 至少有一个通过发布门禁的可安装版本；
- macOS 与 Windows 都完成运行和安装包证据；
- 无发布、恢复、数据迁移或模型导入流程依赖 Qt binary；
- 历史参考已有 tag 或归档说明；
- 删除 PR 附带文件清单、替代路径和恢复方法；
- 完成一个已约定的回滚观察窗口。

删除 Qt 与切换默认入口不是同一动作；默认入口已经是 Tauri，Qt 删除只发生在证据闭环后。

回滚：观察窗口内可通过正常 revert 恢复归档源码以处理遗漏的数据/恢复依赖，但不恢复 Qt 默认构建或功能双写；产品回滚使用上一份已验证 Tauri 安装包。

## 发布与回滚

- Stage crash 不得阻止 Tauri 主窗口打开。
- 协议失败回滚到最后共同支持版本，不静默接受畸形消息。
- 资产或模型失败必须保留无模型可诊断入口，但不能冒充真实模型成功。
- 每个发布保存源码提交、依赖锁、构建平台、安装包 checksum 和第三方清单。
- 回滚使用已验证安装包和正常 Git revert；禁止 force-push 或重新制造双主线。
