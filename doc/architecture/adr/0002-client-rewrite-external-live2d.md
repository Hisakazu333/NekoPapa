# ADR-0002：客户端按设计系统 2.0 重写，角色渲染全部外置

- Status: Accepted
- Date: 2026-09-04
- Owners: NekoPapa desktop maintainers

## Context

旧桌面实现 `app/control-desktop/`（React + Tauri 2，WebView 内嵌 Pixi.js/Cubism Web
Live2D）对应旧产品形态，已从工作区移除。产品转向 `prototype/desktop-app/` 承载的
设计系统 2.0（见 [DESIGN.md](../../../prototype/desktop-app/DESIGN.md)，界面中性化、
粉色 accent 只属于角色与学习状态）。

同时，角色渲染的真相源已经明确：NekoCore-Nano C++ 仓库维护 `src/graphics/live2d`、
Cubism Native SDK（`third_party/CubismSdkForNative`）及对应测试。继续在本仓库维护
第二套 Web 角色渲染会重复模型加载、动作驱动与表现逻辑，且与"渲染能力归属外部
runtime"的 ADR-0001 方向相反。

## Alternatives

- **维持现状（保留旧实现迭代）**：旧实现与设计系统 2.0 差异是结构性的（内嵌
  Web Live2D、旧信息架构），渐进改造的成本高于重写，被否决。
- **Flutter 外壳**：与 NekoBuddy-Flutter 共享技术栈，但产品是桌面优先，且引入第
  三套 UI 框架无必要，被否决。
- **Qt/QML C++ 外壳**：可直接链接 Live2D C++ 代码，但该路线已被 ADR-0001 前后
  的清理决策移除，重新引入会恢复 C++ UI 工具链，被否决。

## Decision

1. 桌面外壳继续使用 Tauri 2 + React + TypeScript，按 `prototype/desktop-app/` 的
   设计系统 2.0 重写；旧实现不回迁，仅保留在 Git 历史。
2. 角色（Live2D）渲染全部由外部 NekoCore-Nano 的 C++ 代码承担；本仓库不再实现
   任何 WebView 内嵌角色渲染。原型页中的 Web Live2D 仅用于设计预览，不代表产品
   渲染架构。
3. 外壳与原生 runtime 的边界继承 ADR-0001：固定逻辑名 sidecar + 预构建产物 +
   `protocol/stage/v1/` 契约。
4. 主窗口与角色画面的最终集成形态（独立桌宠窗口、窗口层级或纹理共享）属于重写
   实现细节，由后续 PR 按原型确定；本 ADR 只锁定渲染代码与能力的所有权归属。

## Consequences

正面影响：

- 角色渲染只有一套实现，模型、动作与表现逻辑不再双份维护；
- 外壳重写可以按设计系统 2.0 直接落地，不背旧信息架构包袱；
- 本仓库继续保持无 C++ 工具链依赖。

代价与风险：

- 重写完成前，仓库没有可运行的桌面客户端，`app/` 相关 CI、脚本与文档全部处于
  过渡状态，必须随新骨架一次性重建；
- 浏览器预览失去内嵌角色画面，设计预览职责完全由原型页承担；
- 主窗口与原生角色窗口的协同（状态同步、层级、输入）依赖 Stage 协议演进。

## Rollout

1. 提交旧实现移除，CI 中 `app/control-desktop` 相关 job 同步停用或删除；
2. 按原型搭建新 Tauri + React 骨架，恢复最小 CI（类型检查、构建、Rust 检查）；
3. 按页面优先级逐页实现，UI 变更引用原型页作为验收锚点；
4. 接入真实 sidecar 验证角色窗口与协议握手。

## Verification

- 干净 checkout 不包含 `app/control-desktop/` 旧源码；
- 新骨架的类型检查、构建与 Rust 检查在 CI 通过；
- 角色渲染只出现在外部 runtime：仓库内不存在产品用的 Web 角色渲染代码；
- 提供真实 sidecar 后，角色窗口可启动、停止并与主窗口状态一致。

## Rollback

如重写受阻，从 Git 历史恢复旧实现属于临时措施，必须同时记录恢复原因与退出条件；
不得以恢复旧实现为由重新引入 WebView 内嵌 Web 角色渲染作为产品能力。
