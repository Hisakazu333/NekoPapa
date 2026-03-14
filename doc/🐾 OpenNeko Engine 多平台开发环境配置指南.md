# 🐾 Nekonano-Aether (NNA Core) 多平台开发环境配置指南

欢迎加入 **Nekonano-Aether** 团队！本指南将帮助你在不同操作系统上构建统一的 `Qt 6.5+ / CMake` 开发环境，为 NNA Core 引擎的开发做好准备。

## 1. 核心工具链对比

所有开发者必须确保 C++ 编译器支持 **C++20** 标准。

| **工具**     | **Windows 11**     | **macOS (Intel/Apple)** | **Linux (Ubuntu/Arch)** |
| ------------ | ------------------ | ----------------------- | ----------------------- |
| **编译器**   | MSVC 2022 (v17.0+) | Apple Clang (Xcode 15+) | GCC 11+ / Clang 14+     |
| **构建系统** | CMake 3.21+        | CMake 3.21+             | CMake 3.21+             |
| **包管理器** | vcpkg (可选)       | Homebrew                | apt / pacman            |

------

## 2. 详细安装步骤 (官方安装器方案)

### 📦 第一步：安装 Qt 6 框架 (全平台通用)

1. 前往 Qt 官网下载 [Qt Online Installer](https://www.google.com/search?q=https://www.qt.io/download-qt-installer)。
2. 安装时选择 **Qt 6.5 LTS** (或最新稳定版)，并务必勾选以下组件：
   - **Windows:** `MSVC 2022 64-bit`
   - **macOS:** `macOS` (包含 ARM64 和 x86_64)
   - **Linux:** `Desktop gcc 64-bit`
   - **通用组件 (必选):** `Qt Quick`, `Qt Shader Tools`, `Qt 5 Compatibility Module`

### 💻 第二步：配置操作系统特有依赖

- **Windows 11:** 安装 Visual Studio 2022 时，必须勾选**“使用 C++ 的桌面开发”**工作负载。建议将 `C:\Qt\6.x.x\msvc2022_64\bin` 添加到系统环境变量 `PATH` 中。

- **macOS:**

  在 App Store 下载 Xcode 并运行一次，确保执行过 `sudo xcodebuild -license`。然后使用 Homebrew 安装依赖：

  Bash

  ```
  brew install cmake ninja git-lfs
  ```

- **Linux (以 Ubuntu 为例):**

  安装基础构建库：

  Bash

  ```
  sudo apt update
  sudo apt install build-essential libgl1-mesa-dev libxkbcommon-x11-0 libxcb-cursor0 cmake ninja-build git-lfs
  ```

------

## 3. 获取代码与资源

NNA Core 涉及情绪引擎的 AI 权重与高精度模型资产，我们使用 **Git LFS** 存储大文件。克隆前请务必初始化：

Bash

```
# 1. 安装 LFS 插件
git lfs install

# 2. 克隆项目 (请替换为实际的 NNA 组织仓库地址)
git clone https://github.com/Nekonano-Aether/NNA-Core.git
cd NNA-Core

# 3. 拉取大文件（如果克隆时没自动下载）
git lfs pull
```

------

## 4. IDE 配置建议

- **推荐：Qt Creator (最稳定)**

  直接在 Qt Creator 中打开项目根目录的 `CMakeLists.txt`。在 Projects 选项卡中，根据你的系统选择对应的 Kit (例如 `Desktop Qt 6.5.0 MSVC2022`)。

- **备选：VS Code**

  安装插件：`C/C++ Extension Pack`, `CMake Tools`, `Qt All-in-One`。

  *Windows 用户注意：请确保从 Developer PowerShell for VS 2022 启动 VS Code，否则 CMake 可能找不到 MSVC 编译器。*

------

## 5. 编译预检 (Troubleshooting)

| **现象**                           | **原因**           | **解决方法**                                                 |
| ---------------------------------- | ------------------ | ------------------------------------------------------------ |
| **Windows:** 找不到 `xcb` 或 DLL   | 运行环境路径缺失   | 使用 `windeployqt` 打包，或手动添加 Qt bin 目录到系统 PATH。 |
| **macOS:** 提示“开发者无法验证”    | 系统安全限制       | 在“系统设置 -> 隐私与安全”中点击“仍要打开”。                 |
| **Linux:** 编译提示 `GL/gl.h` 缺失 | 缺少 OpenGL 开发库 | 执行 `sudo apt install libgl1-mesa-dev`。                    |
| **通用:** QML 界面显示黑屏         | Shader 编译失败    | 返回安装器，确保勾选了 `Qt Shader Tools` 组件。              |

------

## 6. 协作规范提醒

- **换行符：** Git 已配置 `autocrlf`，请不要手动修改换行符格式。
- **编码：** 所有文件必须严格使用 **UTF-8 (无 BOM)** 编码。
- **构建目录：** 严禁将 `build` 文件夹提交到 Git（项目已配置 `.gitignore`）。

------

## 🚀 备选方案：免登录极速安装 (推荐国内网络环境使用)

如果 Qt 官方在线安装器卡在账号登录界面，请使用以下 `aqtinstall` 命令行方案。**该方案免注册、免登录、速度快。**

### 1. 安装 aqt 工具

确保电脑已安装 Python，在终端运行：

Bash

```
pip install aqtinstall
```

### 2. 执行安装命令

根据操作系统运行对应命令（以 Qt 6.5.3 为例）：

- **Windows (MSVC 2022):**

  Bash

  ```
  aqt install-qt windows desktop 6.5.3 win64_msvc2022_64 -m qtshadertools qt5compat
  ```

- **macOS (通用):**

  Bash

  ```
  aqt install-qt mac desktop 6.5.3 clang_64 -m qtshadertools qt5compat
  ```

- **Linux:**

  Bash

  ```
  aqt install-qt linux desktop 6.5.3 gcc_64 -m qtshadertools qt5compat
  ```

> **提示：** 安装完成后，会在当前目录下生成一个 `6.5.3/` 文件夹。你可以将其移动到任意合适的位置（如 `D:\Qt`）。

### 3. 跳过账号配置 IDE

1. 下载独立版 Qt Creator：前往 [Qt 官方镜像](https://download.qt.io/official_releases/qtcreator/)，下载最新版 (如 14.0) 的 `opensource` 安装包。
2. 打开 Qt Creator，遇到登录弹窗直接点击 **Skip** 或关闭。
3. 进入 `工具 (Tools)` -> `选项 (Options)` -> `构建和运行 (Build & Run)`。
4. **Qt Versions:** 点击“添加”，选择你刚才用 aqt 下载路径里的 `bin/qmake.exe`。
5. **Kits:** 新建一个 Kit，关联对应的编译器和刚才添加的 Qt Version 即可。