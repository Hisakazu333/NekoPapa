# 首页 HTML 设计预览

2026-10-10 的独立首页原型，沿用现有导航壳与灰白视觉。侧栏保留人物头像和切换入口，主内容为正常工作台；完整 Live2D 仍属于软件外的独立窗口。本原型未改动生产首页，也未安装到桌面客户端。

首页保留目标输入、模式与项目选择、最近工作、待处理事项和常用位置。标题、类型与时间承担信息层级，去掉重复的介绍段落和摘要。顶部的预览控制可切换日常使用、首次打开与深色。

## 运行

从仓库根目录运行，复用已有 npm 依赖：

```bash
node node_modules/vite/bin/vite.js --config prototypes/home/vite.config.ts
```

开发地址为 `http://127.0.0.1:1433`。稳定的构建预览：

```bash
node node_modules/typescript/bin/tsc --project prototypes/home/tsconfig.json
node node_modules/vite/bin/vite.js build --config prototypes/home/vite.config.ts
node node_modules/vite/bin/vite.js preview --config prototypes/home/vite.config.ts
```

构建写入已忽略的 `.local/home-preview-build`，预览地址为 `http://127.0.0.1:1434`。`index.html` 是 Vite 的独立入口，需要上述服务解析 TypeScript；不直接通过 `file://` 打开。

## 数据与行为边界

- `demo-data.ts` 是本原型专用示例，不由 `src/main.ts` 导入。
- 使用现有 `WorkspaceStore` 和内存存储，保留分类与内容独立、关闭标签不删除内容、同一对象复用 ID 的契约；不访问生产工作台的 `localStorage`。
- 输入目标后只生成本次预览的任务草稿。模型未连接，不调用 Agent；添加项目只建立内存入口，不读取磁盘目录。
- 资料入口仅保留所选文件名称，不读取文件内容或上传。确认示例待办仅移除预览条目，不写入真实文件。
- 刷新或切换预览场景会重置示例、人物偏好和草稿。

## 本轮验证

`npm run test`：177 / 177 通过；`npm run build`、原型 TypeScript 检查与原型 Vite 构建通过。浏览器验证任务草稿、空白输入、Coding 项目必选与添加、原 ID 重新打开、标签键盘切换、人物头像切换、审阅取消 / 确认及空状态。1280 × 820 和 760 × 520 布局均检查过，窄窗口侧栏 196px 时页面无横向溢出；深色可用。

截图保存在 `.local/screenshots/home-preview-*.jpg`，属于本机验收证据，不进入版本管理。Rust、原生窗口与实际 Agent 执行未在本轮验证；本轮仅交付 HTML 原型。

文件按入口、示例数据、视图、交互、样式和构建配置拆分，新增手写代码均使用 500 行档。
