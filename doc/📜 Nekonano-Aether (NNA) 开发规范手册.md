# 📜 Nekonano-Aether (NNA) 开发规范手册

欢迎加入 **Nekonano-Aether** 团队！

本手册定义了 **OpenNeko Engine (NNA Core)** 及其上层生态应用（如 NekoBuddy 客户端）的协作标准。我们致力于打造极具突破性的隐私保护型数字生命底层。为了让团队能够高效协作，并为未来 Nekonano-Aether 的商业化与开源生态打下坚实基础，请所有代码贡献者务必严格遵守以下规范。

------

## 一、 C++ 代码风格与命名空间 (C++ Standards)

NNA Core 采用现代 **C++20** 标准。为了确立技术主权并避免与其他开源库产生符号冲突，我们全面启用 `NNA` 标识体系。

### 1. 命名空间 (Namespace)

全面弃用全局类与全局函数。所有核心代码必须归属至 `nna` 命名空间及其子模块下：

- **核心生理求解器:** `nna::core`
- **情感计算与引力场:** `nna::emotion`
- **跨端 UI 桥接层:** `nna::ui`

### 2. 命名约定 (Naming Rules)

- **宏定义 (Macros):** 必须以 `NNA_` 开头，全大写，单词间用下划线分隔。例如：`#define NNA_ENABLE_LDP_ENCRYPTION`
- **类与结构体 (Classes/Structs):** 大驼峰命名法 (PascalCase)。例如：`PhysiologySolver`, `NekoSoul`
- **函数与方法 (Functions):** 小驼峰命名法 (camelCase)。例如：`injectEvent()`, `calculateSatiety()`
- **成员变量 (Member Variables):** 统一使用 `m_` 前缀，后接小驼峰。例如：`m_currentPleasure`, `m_isEngineRunning`
- **接口类 (Interfaces):** 以 `I` 开头。例如：`INekoHardwareProxy`

### 3. 代码格式化 (Formatting)

- **缩进与大括号:** 统一使用 4 个空格缩进（严禁使用 Tab）。遵循 K&R 大括号风格（左大括号不换行，且前保留一个空格）。
- **自动化保障:** 提交代码前，必须使用项目根目录下的 `.clang-format` 文件对变动代码进行格式化。

------

## 二、 Qt6 与 QML 协作规范 (UI Layer Standards)

引擎采用极致的前后端分离架构。C++ 负责沉重的微分方程结算与本地隐私加密，QML 仅负责动画渲染与交互表现。**严禁在 QML 中编写复杂的业务与状态流转逻辑。**

### 1. QML 组件的 NNA 标准化

为建立统一的 UI 资产库，所有向 QML 注册的 C++ 核心类及自定义的 QML 基础组件，均需带有 `NNA` 标识：

- **C++ 注册示例:** `qmlRegisterType<nna::ui::WindowController>("NNA.Core", 1, 0, "NNAWindow");`
- **QML 文件命名:** 统一使用 `NNA` 前缀，如 `NNAToolbar.qml`, `NNAAvatarCanvas.qml`。

### 2. 状态与通信解耦 (State & Communication)

- **单向数据流 (只读生理数据):** C++ 端需通过 `Q_PROPERTY` 暴露引擎状态（如体温、饥饿度、当前心情），QML 端仅通过声明式绑定进行渲染更新。
- **主动交互:** QML 端的按钮点击、拖拽等用户事件，必须通过调用 C++ 端的 `Q_INVOKABLE` 槽函数下发至 `nna::core`，由引擎核心结算后再通过信号 (Signals) 驱动 UI 变化。不要在 UI 层直接篡改底层变量。

------

## 三、 Git 分支管理与提交流程 (Git Flow)

为了保证主线代码绝对纯净且随时可跨平台编译，团队采用严谨的 Git Flow 协作模式。

### 1. 分支策略

- **`main`:** 生产环境与里程碑发布版本。绝对稳定，仅接受来自 `dev` 的合并。
- **`dev`:** 团队日常集成与主开发分支。
- **`feature/nna-xxx`:** 个人功能开发分支。命名规范为 `feature/nna-功能名-你的名字`（例如：`feature/nna-rbf-routing-zj`）。
- **`hotfix/xxx`:** 紧急 Bug 修复分支。

### 2. 语义化提交 (Commit Messages)

每次 Commit 必须清晰说明意图，严格按照 `<类型>: <描述>` 格式：

- `feat:` 增加新功能（例如：`feat: 接入 nna::emotion 模块的 RBF 权重重排逻辑`）
- `fix:` 修复 Bug（例如：`fix: 修正饥饿值收敛时的除零溢出风险`）
- `refactor:` 代码重构（不改变外部行为，如重命名变量或调整架构）
- `docs:` 文档与注释更新
- `perf:` 性能优化（例如：`perf: 优化 ODE 求解器的多线程运算调度`）

### 3. 合并规则 (Pull Requests)

- **严禁**直接 `git push` 到 `dev` 或 `main` 分支。
- 所有代码必须通过 Pull Request (PR) 提交到 `dev`，并至少经过一名核心维护者的 Code Review （代码审查）后方可合并。

------

## 四、 商业主权与版权声明 (Legal & License)

本引擎的内核虽然拥抱开源社区，但我们同样需要保护 Nekonano-Aether 公司的底层架构资产与协议独立性。

- **文件头声明:** 所有新建的 `.h`、`.cpp` 以及核心 `.qml` 文件顶部，必须包含以下标准化版权声明：

  C++

  ```
  /*
   * Project: OpenNeko Engine (NNA Core)
   * Core Architecture by Nekonano-Aether
   * Copyright (c) 2026 Nekonano-Aether. All rights reserved.
   * SPDX-License-Identifier: MIT (or Apache-2.0)
   */
  ```

- **第三方引入:** 若需引入外部开源库（如并行计算库、加密算法库），必须在 `third_party/README.md` 中登记，并确保其开源协议与本项目兼容（优先选择 MIT/BSD/Apache 2.0，慎用 GPL）。