# NekoPapa 开发环境

状态：重写过渡期。旧桌面实现（含前端与 Rust host）已按
[ADR-0002](../architecture/adr/0002-client-rewrite-external-live2d.md) 移除；当前唯一
可运行入口是静态原型，前端/Rust 工具链命令将随新骨架恢复。本仓库不包含或构建
C++ runtime，角色渲染由外部 NekoCore-Nano C++ 代码承担。

## 工具链

| 工具 | 基线 | 用途 |
| --- | --- | --- |
| Node.js | 24 | 仓库脚本（新骨架落地后包含 Vite 与 TypeScript） |
| Rust | 1.96+ | Tauri host（待重建） |
| Tauri 系统依赖 | 2.x 对应平台要求 | WebView 与桌面打包（待重建） |
| Native Stage | 与 target triple 匹配的外部产物 | 独立桌宠窗口与角色渲染 |

CMake、Ninja、C++ 编译器和 Cubism Native SDK 属于外部 runtime 仓库，不是 NekoPapa
开发环境要求。

## 获取与安装

```bash
git clone https://github.com/Hisakazu333/NekoPapa.git
cd NekoPapa
```

依赖锁文件安装（`package-lock.json`、`Cargo.lock`）随新骨架恢复；不提交
`node_modules/`、`target/` 或本机配置。

## 设计原型预览

```bash
prototype/desktop-app/serve.sh
```

入口为 `http://127.0.0.1:8123/prototype/desktop-app/`。原型是零构建静态页面，用于
设计预览与验收锚点；其中的 Web Live2D 不代表产品渲染架构。

## Tauri 桌面开发（待重建）

桌面运行始终需要对应平台的
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)，以及与 `rustc -vV`
中 host triple 匹配的 `nekopapa-native-stage`。提供方式（保持不变）：

- 方式一：`export NEKOPAPA_NATIVE_STAGE_BINARY=/absolute/path/to/nekopapa-native-stage`；
- 方式二：放入 `native-prebuilt/desktop/<target-triple>/nekopapa-native-stage[.exe]`。

详细交付要求见 [`native-prebuilt/README.md`](../../native-prebuilt/README.md)。新 host
必须直接实现 Protocol v1；在两端兼容测试通过前，不得宣称 v1 已落地。

## 静态检查

```bash
node scripts/check-documentation.mjs
```

前端类型检查/构建与 Rust fmt/clippy/test 命令随新骨架恢复，并以
[构建与测试门禁](../architecture/build-and-test-gates.md) 为准。

## 桌面打包（待重建）

打包入口与验证要求随新骨架恢复。打包前必须验证产物来源、hash、签名、协议兼容和
许可；脚本成功只证明生成并校验了安装包容器，不自动证明运行、升级或发布门禁完成。

## 常见问题

| 现象 | 先检查 | 不应得出的结论 |
| --- | --- | --- |
| 外部 `.so` 无法运行 | 是否为 Android/OHOS ELF；桌面需要平台可执行文件 | 重命名扩展名即可兼容 |
| sidecar 启动后立即退出 | 架构、动态依赖、模型路径、协议和 stderr | host 一定有缺陷 |

平台问题必须记录操作系统版本、CPU 架构、Rust triple、窗口尺寸、显示缩放和外部产物
版本。不要用一台机器的结果代表另一平台。
