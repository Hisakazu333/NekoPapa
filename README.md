<p align="center">
  <img src="assets/cat_moon_icon_no_black_corners.png" alt="NekoPapa 应用图标" width="160">
</p>

<h1 align="center">NekoPapa</h1>

<p align="center">面向桌面陪伴与学习场景的 React + Tauri 客户端。</p>

<p align="center">
  <a href="https://github.com/Hisakazu333/NekoPapa/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Hisakazu333/NekoPapa/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Apache-2.0 License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <img alt="Development preview" src="https://img.shields.io/badge/status-development%20preview-f59e0b.svg">
</p>

<p align="center"><a href="README_EN.md">English</a> · 简体中文</p>

NekoPapa 仓库负责产品 UI、Tauri 桌面宿主、Stage 进程管理和跨进程协议。NekoCore-Nano
与 Native Stage 的 C++ 实现位于外部原生仓库，角色（Live2D）渲染也全部由该仓库的
C++ 代码承担，本仓库不再复制其源码或 Cubism Native SDK。桌面宿主通过预构建 sidecar
接入原生运行时。

> [!IMPORTANT]
> 项目处于重写过渡期：新客户端骨架（`app/control-desktop/`）已按
> `prototype/desktop-app/` 的设计系统 2.0 用 Tauri 2 + React 落地
> （[ADR-0002](doc/architecture/adr/0002-client-rewrite-external-live2d.md)），
> 首页可用，其余页面逐页重写中。
> 本仓库不附带 Native Stage 二进制；真实桌面运行始终需要外部预构建产物。

<p align="center">
  <img src="doc/assets/readme/home-browser-preview.png" alt="NekoPapa 小屋浏览器预览，显示居中导航、Live2D 角色、状态面板和输入栏" width="1200">
</p>

## 当前状态

| 模块 | 已确认状态 | 边界 |
| --- | --- | --- |
| 桌面客户端 | 骨架已落地 | `app/control-desktop/`：Tauri 2 + React 首页；其余页面为「重写中」占位 |
| 角色（Live2D）渲染 | 外部实现 | 全部由 NekoCore-Nano C++ 代码承担；原型中的 Web Live2D 仅用于设计预览 |
| Tauri host | 最小骨架 | 仅创建主窗口；sidecar 进程管理（启动/监督/协议）尚未实现 |
| Native Stage | 外部依赖 | 本仓库没有实现或二进制；需按平台提供预构建可执行文件 |
| NekoCore | 待接入 | 本仓库没有核心源码，界面中的相关数据仍是占位或预览状态 |
| Stage Protocol v1 | 草案 | schema 与示例在仓库内；通过两端兼容测试前不得宣称 v1 已落地 |
| 对话、记忆、世界、Agent | 界面原型 | 尚无完整服务、权限和持久化闭环 |

CI 不验证外部 Native Stage 的源码、GPU
运行或最终安装包。

## 快速开始

### 设计原型（零构建静态页面，Live2D 预览需要 HTTP）

```bash
prototype/desktop-app/serve.sh
```

打开 `http://127.0.0.1:8123/prototype/desktop-app/`。原型页用于设计预览与验收锚点，
其中的 Web Live2D 不代表产品渲染架构。

### 桌面客户端（`app/control-desktop/`）

```bash
npm --prefix app/control-desktop ci
npm --prefix app/control-desktop run dev           # 浏览器预览首页（:1420）
npm --prefix app/control-desktop run tauri -- dev   # 真实桌面窗口
```

桌面运行始终需要 Rust 1.96+、对应平台的
[Tauri 2 依赖](https://v2.tauri.app/start/prerequisites/)，以及与 Rust target triple
匹配的 Native Stage：设置 `NEKOPAPA_NATIVE_STAGE_BINARY`，或按
[`native-prebuilt/`](native-prebuilt/README.md) 的目录约定放置产物后运行
`npm --prefix app/control-desktop run stage:prepare`。单个
Android/HarmonyOS `.so` 不能替代 macOS 或 Windows 桌面 sidecar。

## 运行时边界

```text
React UI ── typed bridge ──> Tauri / Rust host ── process + JSONL ──> external Native Stage
                                                                          │
                                                                          └── 角色渲染窗口（NekoCore-Nano C++）
```

- React 只管理页面、交互和短生命周期 UI 状态；主窗口不包含角色画布。
- Tauri 拥有窗口、权限、资源寻址和 sidecar 生命周期。
- 外部 Native Stage 拥有独立桌宠窗口、原生渲染、全部 Live2D 渲染和平台 C++ 依赖。
- `protocol/stage/v1/` 定义目标消息契约；协议兼容不由文件存在自动保证。

完整决策见 [ADR-0001](doc/architecture/adr/0001-external-native-stage.md)、
[ADR-0002](doc/architecture/adr/0002-client-rewrite-external-live2d.md) 和
[桌面运行时边界](doc/architecture/desktop-runtime-boundaries.md)。

## 仓库结构

| 路径 | 责任 |
| --- | --- |
| `app/control-desktop/` | Tauri 2 + React 桌面客户端（新骨架，首页已按设计系统 2.0 实现） |
| `prototype/desktop-app/` | 零构建产品 UI 设计基线（设计系统 2.0 唯一真相源） |
| `protocol/stage/v1/` | Native Stage JSONL v1 草案与 fixtures |
| `native-prebuilt/` | 外部桌面 sidecar 的本地交付约定，不提交实际二进制 |
| `assets/` | 原型设计预览所需运行时资产 |
| `doc/` | 产品、架构、开发和治理文档 |

目录责任详见 [仓库结构](doc/architecture/repository-layout.md)。

## 参与开发

- [贡献指南](CONTRIBUTING.md)
- [开发环境](doc/contributing/development-environment.md)
- [文档中心](doc/README.md)
- [项目治理](GOVERNANCE.md)
- [安全策略](SECURITY.md)

## 许可证与第三方资产

仓库自有代码使用 [Apache License 2.0](LICENSE)。Live2D 示例模型以及外部 Native Stage
中的 SDK/运行库适用各自条款；外部二进制提供方必须随产物交付来源、版本、校验和和
许可清单。参见 [Live2D 资产说明](assets/live2d/README.md)。
