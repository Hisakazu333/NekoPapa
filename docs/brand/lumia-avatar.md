# 陪伴人物与头像来源

侧栏使用 NekoBuddy 官网已有的正式人物设定和插画，不使用手机 App 图标或旧设计稿中的棕发人物。当前五位人物均可选择；白羽澪、雪代凛音有正式头像资源，另外三位使用名字末字占位并标注「头像待更新」。选择不会创建会话或改写已有会话的人物。

## 白羽澪资源

- 本项目文件：`public/characters/lumia-avatar.jpg`。
- 原始文件：`../NekoBuddy-WEB/public/assets/lumia-hero-mobile.jpg`。
- 尺寸与格式：1080 × 1080，JPEG。
- 处理方式：逐字节复制原文件；没有重新生成、裁剪、调色或压缩。头像显示范围由客户端 CSS 控制。
- SHA-256：`5a76cd133a2a12227b0273da9e457af68fea60ba41450c19780bbf10a0e0e213`。

## 雪代凛音资源

- 本项目文件：`public/characters/rinne-avatar.webp`。
- 原始文件：`../NekoBuddy-WEB/public/artbook/rinne/rinne-character-v1.webp`。
- 尺寸与格式：1024 × 1024，WebP。
- 处理方式：逐字节复制原文件；头像显示时用 CSS 定位头部，没有重新生成或修改原画。
- SHA-256：`f8e682425220d708ebd7b4e651ad6ca49d4510f36df44cfa6eca6542bfeab053`。

## 人物目录与身份依据

人物名称及简介来自官网 `../NekoBuddy-WEB/lib/site-girls.ts`，正式插画使用情况核对 `app/girls/[slug]/page.tsx`。本轮仅复用人物信息，未把手机端解锁或账户规则引入桌面导航。

| 显示名称 | 客户端 ID | 当前头像 |
| --- | --- | --- |
| 白羽澪 | `lumia` | 正式插画 |
| 雪代凛音 | `rinne` | 正式插画 |
| 花篠依織 | `iori` | 名字占位，头像待更新 |
| 霧宮栞 | `shiori` | 名字占位，头像待更新 |
| 黒羽紬 | `tsumugi` | 名字占位，头像待更新 |

- 官网 `../NekoBuddy-WEB/lib/site-girls.ts` 的 `mio` 档案：正式姓名为「白羽 澪 / Shiraha Mio」，初始同伴，人设关键词为「主看板 · 嘴硬照顾」。
- 官网 `../NekoBuddy-WEB/app/girls/page.tsx` 和 `app/girls/[slug]/page.tsx` 使用同一人物的 `lumia-hero-full.jpg` 展示正式形象，描述为银白发、紫瞳、深紫色哥特服装。
- 官网 `../NekoBuddy-WEB/docs/research/nekobuddy-app-copy-research.md` 记录内部代号 `lumia` 与正式人物白羽澪的对应关系。客户端显示「白羽澪」，只保留 `lumia` 作为兼容存储 ID。

官网当前没有独立的头像切片；所选资源是现成的方形人物插画变体。旧 OS 组件中的 `/art/lumia-companion.webp` 仅有代码引用，对应文件已经不存在，不能用作客户端资源。

人物目录由 `src/app/companion-model.ts` 定义，头像展示由 `companion-view.ts` / `companion.css` 共用。当前选择保存为 `selectedCompanionId`，普通会话拥有独立的 `companionId`；重载、归档和恢复不把历史会话改成新选人物。

原画资源与 Live2D 运行资产是不同层；头像和选择入口可用不代表已接入人物模型、角色提示词或 Live2D。
