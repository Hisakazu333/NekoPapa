# 智能体外观资源

联系人外观预览沿用现有头像资源。`lumia` 仍是白羽澪的兼容 ID；模型资源清理不改变联系人、头像或会话 ID。模型文件不随客户端打包，当前预览没有本地模型映射，因此显示联系人头像或姓名占位。

## Live2D 模型交付

2026-11-08 移除了 `public/live2d/mio/` 中原先随客户端公开的 82 个模型文件（约 66 MiB）。当前客户端不包含人物模型，也不会为联系人预览请求本地 Live2D 模型文件。

Java 服务提供按人物申请 Live2D 下载地址的接口，但资源开放受人物发布、许可审核、版本、渠道和灰度门禁约束。后续只有在服务端确认当前人物可用后，客户端才按需获取下载地址，校验压缩包大小与 SHA256，再安全解压到应用缓存；模型缺失、校验失败、下载失败或授权不可用时继续显示头像。下载与缓存流程尚未接入。详细契约见[官方人物与 Java 服务](../official-companion-service.md)。

## 运行库与许可证

`public/vendor/live2d/` 保留浏览器运行库及其许可证文件；它们与人物模型资源分开管理。当前预览没有模型 URL 时不会加载这些运行库。

- `pixi.min.js`：PixiJS 6.5.10，MIT；保留文件头版权说明。
- `cubism4.min.js`：已有 `pixi-live2d-display` Cubism 4 浏览器构建，未修改。
- `live2dcubismcore.min.js`：Live2D Cubism Core Redistributable Code；保留文件头许可声明与协议地址。

运行库适用各自的原始许可，不把人物模型或 Cubism Core 标记为 MIT。许可证文本及 vendor 文件字节数、SHA256 见 [资源清单](agent-appearance-manifest.json)。

## 头像与运行状态

白羽澪、雪代凛音继续使用 `public/characters/` 中现有人物头像。其他人物在没有头像时显示姓名占位；头像来源见 [人物头像说明](lumia-avatar.md)。

`AgentAppearancePreview` 当前只呈现头像。未来接入模型下载后，模型加载、WebGL 或设备图形能力失败时应回退到头像；模型、WebGL 应用与帧循环由预览实例拥有，切换或卸载时销毁，隐藏页面或系统要求减少动态效果时暂停更新。现有 Live2D 生命周期单测验证后半段运行时行为，不代表已接入下载或桌面透明窗口。
