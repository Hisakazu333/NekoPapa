# NekoPapa 仓库结构

状态：当前目录真相源。目标结构只有在代码实际迁移时才更新。

## 当前结构

```text
NekoPapa/
├── app/
│   └── control-desktop/
│       ├── src/                    # React UI、页面、bridge、Web Live2D
│       ├── scripts/                # 外部 sidecar 准备脚本
│       └── src-tauri/              # Rust host、窗口与打包配置
├── assets/
│   └── live2d/                     # WebView/开发模型资产
├── native-prebuilt/
│   └── README.md                   # 外部 sidecar 交付约定
├── protocol/
│   └── stage/v1/                   # JSON Schema 和 fixtures
├── prototype/
│   └── desktop-app/                # 零构建设计基线
├── doc/
│   ├── architecture/
│   ├── contributing/
│   ├── engineering/
│   └── product/
├── scripts/                        # 仓库检查与桌面打包入口
└── .github/                        # CI、Issue/PR 模板和 CODEOWNERS
```

本仓库没有 CMake 根工程、C++ Engine、Native Stage 实现或 Cubism Native SDK。历史路径
不作为当前结构的一部分。

## 目录责任

| 路径 | Owner | 允许依赖 | 禁止内容 |
| --- | --- | --- | --- |
| `app/control-desktop/src/` | React UI | typed bridge、Web dependencies | shell 命令、任意本机路径 |
| `app/control-desktop/src-tauri/` | Desktop host | Tauri、Rust、固定 sidecar | Native renderer 实现、业务 mock 真相源 |
| `protocol/stage/v1/` | Contract | JSON Schema、fixtures | 任一端私有实现细节 |
| `prototype/desktop-app/` | Product design | 静态 HTML/CSS/JS、runtime assets | 构建产物、功能完成声明 |
| `native-prebuilt/` | Artifact contract | README、未来 manifest 示例 | 提交真实平台二进制 |
| `assets/` | Runtime assets | 明确许可的模型和图像 | 未知来源资源、Native SDK 源码 |
| `doc/` | Documentation | 当前路径、ADR、产品基线 | issue 状态快照、已完成迁移副本 |

## 依赖方向

```text
React view
  -> typed TypeScript bridge
  -> Tauri command
  -> process supervisor
  -> versioned Stage protocol
  -> external Native Stage

React view
  -> Web Live2D adapter
  -> browser/WebView canvas
```

禁止反向依赖：

- Tauri/Rust 不导入 React 页面状态；
- React 不直接访问 shell、进程或任意文件系统路径；
- 协议不引用外部 runtime 的私有 C++ 类型；
- 外部 Native Stage 不成为账号、记忆、同步或 Agent 业务 owner；
- 本仓库不通过相邻目录源码引用绕过预构建与版本契约。

## 生成物与本机文件

以下内容不进入 Git：

- `node_modules/`、`dist/`、`target/`、`build/`；
- `app/control-desktop/src-tauri/binaries/*`；
- `native-prebuilt/desktop/**`；
- 安装包、签名材料、`.env*` 和 `.DS_Store`。

`src-tauri/binaries/.gitkeep` 与 `native-prebuilt/README.md` 只保留目录约定。placeholder
和真实 sidecar 均是本机/CI 生成物。

## 文档归属

- 当前运行边界写入 `doc/architecture/`；
- 跨版本决定写入 ADR；
- UI 目标写入 `doc/product/` 与原型；
- 实时任务只写 GitHub Issues；
- 已完成迁移、旧目录和历史计划通过 Git 历史查阅。

修改目录责任时，同一个 PR 必须更新 CODEOWNERS、CI、`.gitignore`、相关文档和脚本。
