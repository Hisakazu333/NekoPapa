<p align="center">
  <img src="assets/cat_moon_icon_no_black_corners.png" alt="NekoPapa 应用图标" width="160">
</p>

<h1 align="center">NekoPapa</h1>

<p align="center">一个同时运行于应用小屋和独立桌面舞台的 Live2D 桌面伴侣。</p>

<p align="center">
  <a href="https://github.com/Hisakazu333/Nekopapa/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Hisakazu333/Nekopapa/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Apache-2.0 License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <img alt="Development preview" src="https://img.shields.io/badge/status-development%20preview-f59e0b.svg">
</p>

<p align="center"><a href="README_EN.md">English</a> · 简体中文</p>

NekoPapa 将 React 控制台、Tauri 桌面能力和 C++ Live2D Native Stage 组合成一个桌面应用。当前版本聚焦小屋、角色渲染和 Stage 生命周期。对话、记忆、世界与 Agent 页面仍是产品原型，不代表后端服务已经接通。

> [!IMPORTANT]
> NekoPapa 处于开发预览阶段。源码构建成功不代表安装包、签名、公证、Windows 运行或发布质量已经验证。

## 项目状态

下表只描述当前源码中能够确认的能力：

| 模块 | 当前状态 | 技术边界 |
| --- | --- | --- |
| 桌面主窗口 | 开发中 | Tauri 2 + Rust + React + TypeScript，使用原生标题栏 |
| 小屋 Live2D | 已接入开发模型 | Pixi.js + Cubism Web，在 WebView 中渲染 |
| Native Stage | v0 开发目标 | C++17 + GLFW + OpenGL + Cubism Native，运行于独立窗口 |
| Stage 生命周期 | 基础控制已实现 | Rust host 启动、查询和停止 sidecar |
| NNA native layer | Stub 模式 | Native Stage 尚未接入完整 NekoCore-Nano 领域状态 |
| Stage Protocol v1 | 草案 | JSON Schema 已存在，运行时仍使用未版本化 v0 消息 |
| 对话、记忆、世界、Agent | 界面原型 | 没有完整服务、权限和持久化闭环 |
| Legacy Qt | Frozen | 仅用于迁移取证，不是可构建回退产品 |

仓库使用 Live2D 官方示例模型桃濑日和进行开发验证。它不是 Lumia 的正式角色资产。

## 快速开始

浏览器预览适合开发 React 小屋和 Cubism Web。它不会启动真实 Native Stage，页面中的 Stage 状态是模拟值。

```bash
git clone https://github.com/Hisakazu333/Nekopapa.git
cd Nekopapa
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run dev
```

打开 `http://127.0.0.1:1420/`。

### 运行桌面应用

桌面应用还需要 Rust 1.96+、CMake 3.21+、Ninja、C++17 工具链、OpenGL 和 [Tauri 2 平台依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run tauri -- dev
```

Tauri 会先构建与当前 Rust target triple 匹配的 Native Stage sidecar。首次配置可能从 GitHub 下载固定版本的 GLFW 和 nlohmann/json。

完整环境、Native Stage 单独构建和故障排查见 [开发环境指南](doc/contributing/development-environment.md)。

## 运行时架构

NekoPapa 有两个独立 Live2D 渲染面：

```text
React UI ── typed bridge ──> Tauri / Rust host ── lifecycle ──> Native Stage
    │                                                            │
    └── Cubism Web / Pixi.js                                     └── Cubism Native / OpenGL
```

- **WebView 角色**：参与页面布局、裁剪和输入
- **Native Stage 角色**：运行于独立桌面窗口
- **Tauri host**：拥有窗口、权限、资源路径和 sidecar 生命周期
- **NNA native layer**：目标上拥有可持久的同伴状态，当前仍是 Stub 阶段

阅读 [桌面运行时边界](doc/architecture/desktop-runtime-boundaries.md) 了解状态所有权、协议和安全约束。

## 命名约定

NekoPapa 是当前产品、桌面包和仓库的唯一名称。Nekonano-Aether（NNA）是工程体系，继续用于 C++ `nna` 命名空间、`NNA_` 构建选项和 `feat/nna-*` 等分支名。

源码中的 `openneko` CMake target、binary 和 namespace 是待迁移的 legacy 技术标识。它们只在命令或迁移文档中出现，不应进入新产品文案、页面标题或新文档名称。

## 仓库结构

| 路径 | 责任 |
| --- | --- |
| `app/control-desktop/` | React 主窗口、Tauri host 和桌面打包配置 |
| `app/live2d-stage/` | 独立 C++ Native Stage |
| `app/stage-desktop/` | Frozen Legacy Qt 取证目录 |
| `engine/` | NNA C++ core stub 与 Cubism Native adapter |
| `protocol/stage/v1/` | Stage JSONL v1 草案与 fixtures |
| `assets/` | 运行时与开发资产 |
| `img/` | 产品原型源图，不进入安装包 |
| `doc/` | 治理、工程、架构和产品文档 |

当前目录债务和渐进目标结构见 [项目结构与分层](doc/architecture/repository-layout.md)。

## 开发与治理

仓库使用短分支通过 Pull Request 合入 `main`，不维护长期 `dev` 分支。新分支使用 `feat/nna-*`、`fix/nna-*`、`refactor/nna-*`、`docs/nna-*` 或 `chore/nna-*`。

- [贡献指南](CONTRIBUTING.md)
- [项目治理](GOVERNANCE.md)
- [NNA 工程规范](doc/engineering/standards.md)
- [Issue 治理与首批 backlog](doc/ISSUES.md)
- [安全策略](SECURITY.md)

## 文档

- [文档中心](doc/README.md)
- [产品原型基线](doc/product/README.md)
- [桌面 UI 架构与验收](doc/product/desktop-ui-architecture.md)
- [桌面架构](doc/architecture/README.md)
- [构建与测试门禁](doc/architecture/build-and-test-gates.md)
- [Stage Protocol v1](protocol/stage/v1/README.md)

## 许可证与第三方资产

仓库自有代码采用 [Apache License 2.0](LICENSE)。

Live2D Cubism SDK、Cubism Core 和桃濑日和示例模型适用各自许可与再分发条款，不由 Apache-2.0 覆盖。发布安装包前必须完成第三方清单和包内容审计。阅读 [Live2D 资产说明](assets/live2d/README.md) 获取当前来源信息。
