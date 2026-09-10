# NekoPapa 仓库结构

状态：当前目录真相源。目标结构只有在代码实际迁移时才更新。

## 当前结构

新桌面客户端骨架 `app/control-desktop/` 已按
[ADR-0002](adr/0002-client-rewrite-external-live2d.md) 落地：Tauri 2 + React +
TypeScript，首页对照 `prototype/desktop-app/` 设计系统 2.0 实现，其余页面经路由
落在共用占位页上逐页重写。

```text
NekoPapa/
├── app/
│   └── control-desktop/            # Tauri 2 + React 桌面客户端（新骨架）
│       ├── src/                    # React 页面、设计系统样式、数据层
│       ├── src-tauri/              # Rust host（窗口与 sidecar 装配）
│       └── scripts/                # sidecar placeholder/prepare 脚本
├── assets/
│   └── live2d/                     # 原型设计预览用模型资产（非产品渲染路径）
├── native-prebuilt/
│   └── README.md                   # 外部 sidecar 交付约定
├── protocol/
│   └── stage/v1/                   # JSON Schema 和 fixtures
├── prototype/
│   └── desktop-app/                # 零构建设计基线（设计系统 2.0 唯一真相源）
├── doc/
│   ├── architecture/
│   ├── contributing/
│   ├── engineering/
│   └── product/
├── scripts/                        # 仓库检查与桌面打包入口
└── .github/                        # CI、Issue/PR 模板和 CODEOWNERS
```

本仓库没有 CMake 根工程、C++ Engine、Native Stage 实现、Cubism Native SDK 或产品用
角色渲染代码。历史路径不作为当前结构的一部分。

## 目录责任

| 路径 | Owner | 允许依赖 | 禁止内容 |
| --- | --- | --- | --- |
| `app/control-desktop/src/` | Desktop client | React、Vite、TypeScript、设计系统 token | UI 组件库、直接进程/文件系统访问 |
| `app/control-desktop/src-tauri/` | Desktop client | Tauri 2、tauri-build | sidecar 进程管理以外的平台逻辑堆积 |
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
  -> external Native Stage（含角色渲染）
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
- `native-prebuilt/desktop/**`；
- 安装包、签名材料、`.env*` 和 `.DS_Store`。

`native-prebuilt/README.md` 保留目录约定。placeholder 和真实 sidecar 均是本机/CI
生成物。

## 文档归属

- 当前运行边界写入 `doc/architecture/`；
- 跨版本决定写入 ADR；
- UI 目标写入 `doc/product/` 与原型；
- 实时任务只写 GitHub Issues；
- 已完成迁移、旧目录和历史计划通过 Git 历史查阅。

修改目录责任时，同一个 PR 必须更新 CODEOWNERS、CI、`.gitignore`、相关文档和脚本。
