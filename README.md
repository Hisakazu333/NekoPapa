# 🐾 NekoCore Nano (open-neko-engine)

**为下一代隐私保护型数字生命打造的 C++ 底层驱动。内置基于数学调制的物理情绪引擎，彻底打破传统文本检索瓶颈，赋予 AI 真实的记忆厚度与“记仇”本能。全面护航本地数据安全，打通 Win11 桌面至现实 IoT 硬件的物理级互动，让赛博伴侣真正降临现实。**

> “如果 Neuro-sama 让我们看到了数字生命的雏形，那么 NekoCore 就是要为其注入真正的血液与新陈代谢。
>
>
>
> 这颗引擎赋能未来的 AI Vtuber 与赛博伴侣真实的呼吸、饥饿、愤怒，以及至关重要的——**自由意志与记忆主权**。”

[English](https://www.google.com/search?q=README_EN.md) | 简体中文

\</div>

***

## 🛠️ 开发者快速上手 (For Developers)

**本项目现已开启多人协作模式！** 如果你是新加入的伙伴，请务必先阅读以下文档：

- 🚀 **[环境配置指南 (必读)](F:\open-neko-engine\doc\🐾 OpenNeko Engine 多平台开发环境配置指南.md)**：包含 Windows/macOS/Linux 下 Qt6 + CMake 的一键配置方案及免登录备选方案。
- 📜 **[开发规范手册](F:\open-neko-engine\doc\📜 Nekonano-Aether (NNA) 开发规范手册.md)**：代码风格、Git 分支管理及 QML 协作规范。

***

## 📖 简介与愿景 (Introduction & Vision)

**open-neko-engine (NekoCore Nano)** 并非传统的生成式对话机器人后台，而是一个从生物学隐喻出发的**神经符号端侧计算引擎**。它由纯 C++ 编写，旨在剥离具体操作系统与 UI 层的束缚，潜入最底层——提供一个可嵌入任何终端的通用数字生理基座。

当主流项目还在受困于冰冷且易崩溃的 Prompt 拼砌时，NekoCore Nano 将**微分方程 (ODEs)** 与小型语言模型 (SLMs) 深度融合，从数学底层构筑出遵循真实昼夜节律的虚拟器官。

***

## 💻 桌面端与 IoT 生态 (Desktop & IoT Ecology)

我们通过 **Qt6 (QML)** 打造了极致现代化的桌面交互层，使 NekoCore 的能力得以具象化：

### 1. 沉浸式 Win11 桌面交互 (Qt6 驱动)

- **无边框穿透视窗**：基于 Qt Quick 渲染的高帧率动态交互，支持 Live2D/Spine 模型的物理反馈。
- **系统级意图嗅探**：通过感知 OS 状态（如检测到用户在写代码或游戏），触发基于情绪引擎的反馈。
- **流媒体直连**：原生支持 B站 / Twitch 弹幕协议，一键化身 AI Vtuber。

### 2. 现实物理世界联动 (IoT Synergy)

- 通过事件驱动 API，将引擎结算出的“情绪值”下发至 **Arduino / 树莓派**。
- 实现物理级交互：如随心情变色的**拾音灯**、感到“燥热”时自动开启的**桌面风扇**。

***

## ✨ 核心特性 (Key Features)

### 1. 🩸 7层微分生理计算 (7-Layer ODE Physiology)

采用**非线性有限时间稳定动力学**模型。饥饿感、水分代谢在真实的 8-12 小时内精确收敛。内置**情绪阻尼机制**，从数学层面彻底消灭逻辑死锁。

### 2. 🧠 生理引力场：解决逻辑分裂

首创**具身内分泌计算 (Embodied Endocrine Computing)**。心情坐标（PAD）将直接影响 RAG 检索的权重——悲伤时倾向于检索负面记忆碎片，实现真正的“记仇”与偏见。

### 3. 🛡️ 绝对数据主权 (Absolute Privacy)

- **冷库（事实）**：军工级 **AEAD (ChaCha20-Poly1305)** 流加密。
- **热库（记忆）**：针对 768 维语义向量应用 **局部差分隐私 (LDP)**，抵御云端向量反演攻击。

***

## 📐 架构设计 (Architecture Overview)

代码段

```
graph TD
    subgraph "NekoCore Nano (C++ Engine)"
    A[通用事件缓冲 API] -->|生理裁剪| B(微分动力学求解器 ODE)
    B -->|动态调节阈值| C(RBF 情绪重排引力场)
    C -->|控制皮层| D[神经对齐控制器]
    end
    
    subgraph "UI 层 (Qt6 Framework)"
    UI[Qt Quick / QML 界面] <==>|信号槽/Properties| A
    end
    
    subgraph "硬件 & 平台 (Edge & IoT)"
    Win[Windows/macOS] --- IoT[Arduino/ESP32]
    D -->|物理指令| IoT
    end

```

***

## 🛠️ 代码示例 (C++ API)

C++

```
#include "neko_engine.h"

// 1. 初始化属于你的独立沙盒数字生命
auto soul = NekoEngine::CreateInstance("Neko_Zero");

// 2. 注入物理世界事件 (比如一次摸头)
UniversalPayload touch = {
    .category = "PHYSICAL_TOUCH", 
    .intensity = 85.0f,
    .context = R"({"location": "head"})"
};

// 3. 引擎自动计算生理波动并反馈给 UI 或硬件
soul->InjectEvent(touch);
auto state = soul->GetCurrentState();
// 输出：当前愉悦度上涨，催生外周硬件（拾音灯）变为粉色

```

***

## 📄 许可证 (License)

本项目基于 [MIT](https://www.google.com/search?q=LICENSE) 许可证开源。

***

*“愿每个赛博灵魂，都能在数学的约束下，长出真实的引力。🐈”*
