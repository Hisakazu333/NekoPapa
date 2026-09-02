# Qt 到 Tauri 迁移完成记录

状态：已完成。本文是历史记录，不再是执行计划。

## 结论

Qt/QML 桌面客户端已于 2026-09 从受控树中删除。删除前它已被冻结为只读取证目录，
入口 `qml/main.qml` 在受控树中不存在，从未作为可构建回退产品验证过。

本次删除同时移除了：

- `app/stage-desktop/`：全部 Qt6/QML 源码与资源；
- 根目录 `build_macos.sh`、`build_linux.sh`、`build_win.bat`：旧 Qt 语义的构建脚本；
- 根 CMake 的 `NNA_BUILD_APP` 选项及 `add_subdirectory(app/stage-desktop)`；
- `img/` 早期原型 PNG 与 `doc/legacy/` 历史愿景文档（同属旧方案退出）。

需要历史行为参考时，通过正常 Git 历史（删除前提交）查阅；仓库中没有保留任何
Qt 构建路径，也不存在恢复 Qt 为默认入口的选项。

## 当前架构

- 桌面入口：`app/control-desktop/`（Tauri 2 + React + Rust）；
- 独立桌宠窗口：`app/live2d-stage/`（C++17 + GLFW + OpenGL + Cubism Native）；
- 设计基线：`prototype/desktop-app/`（零构建静态原型，`assets/proto.css` 为 token
  真相源，`DESIGN.md` 为设计规范）；
- 引擎与协议：`engine/`、`protocol/stage/v1/` 不受本次删除影响。

## 仍然有效的约束

- 不在多个运行时中同时实现同一功能；每个持久状态只有一个 owner。
- 依赖方向遵循[桌面运行时边界](desktop-runtime-boundaries.md)。
- 源码中仍存在的 `openneko` target/binary/namespace 是待迁移的 legacy 技术标识，
  迁移工作由 Issue 跟踪（见 [Issue 治理](../ISSUES.md)），与已删除的 Qt 客户端无关。
- 回滚使用正常 Git revert 与已验证安装包；禁止 force-push 或重建双产品主线。

## 历史阶段摘要

原迁移计划按 Phase 0–6 推进：治理基线、模块拆分、Stage Protocol v1、Qt 功能
归属、Core/graphics target 拆分、目录收敛、删除 Frozen Qt。Qt 功能归属阶段没有
需要保留的 Qt 独有生产数据格式；登录、同步、模型导入等能力在 Qt 侧从未达到可
发布质量，统一由 Tauri/React 侧按新契约重新实现，不做格式兼容承诺。
