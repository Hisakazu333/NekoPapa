# 应用领域模块

`src/main.ts` 装配应用；页面和共享控件在 `src/components`，React 订阅与交互协调在 `src/hooks`，原生能力在 `src-tauri/src`。这里放可以独立测试的领域逻辑、存储契约和调用桥接。

- **account / contacts**：账号会话、资料和官方人物目录；本机联系人、群聊及人物服务契约。
- **chat / models / api/chat**：对话草稿、消息、历史和传输；模型连接与本机服务发现；聊天服务端协议。
- **projects / desktop / browser**：项目 ID、源文件夹、文件/Git 查询与终端；屏幕取材与桌宠桥接；内置浏览器地址、显示与批注。
- **settings / appearance / navigation / usage**：设置与备份；主题；界面语言和导航偏好；用量与活跃记录。
- **legacy-shell**：历史直接 DOM 工作台、历史原型和兼容测试。当前 React 入口不导入这部分；新功能放在对应的领域目录。

挪动模块时一并更新 Vite、独立原型及 Node 测试的路径。目录归属与磁盘数据归属是两回事：模块移动不改已有存储键、项目 ID 或用户文件路径。
