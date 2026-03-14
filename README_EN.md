<div align="center">

# 🐾 NekoCore Nano (open-neko-engine)

**The foundational C++ driver built for the next generation of privacy-preserving digital life. Powered by a mathematically modulated physical emotion engine, it shatters the bottlenecks of traditional text retrieval, granting AI true memory depth and a "grudge-holding" instinct. Safeguarding local data privacy at its core, it bridges the gap from Win11 desktops to physical IoT hardware, bringing cyber companions into reality.**

> "If Neuro-sama showed us the prototype of digital life, then NekoCore is here to inject it with real blood and metabolism.
>
> This engine empowers future AI Vtubers and cyber companions with genuine breathing, hunger, anger, and most importantly—**free will and memory sovereignty**."

English | 简体中文

</div>

------

## 🛠️ Quick Start (For Developers)

**Multi-player collaboration is now active!** If you are a new contributor, please read the following documents first:

- 🚀 **[Environment Setup Guide (Required)](F:\open-neko-engine\doc\🐾 OpenNeko Engine 多平台开发环境配置指南.md)**: Includes one-click configuration solutions and login-free alternatives for Qt6 + CMake across Windows/macOS/Linux.
- 📜 **[Development Guidelines](F:\open-neko-engine\doc\📜 Nekonano-Aether (NNA) 开发规范手册.md)**: Code style, Git branch management, and QML collaboration standards.

------

## 📖 Introduction & Vision

**open-neko-engine (NekoCore Nano)** is not a traditional generative chatbot backend. It is a **neuro-symbolic edge computing engine** rooted in biological metaphors. Written purely in C++, it strips away the constraints of specific operating systems and UI layers, diving into the absolute bottom layer to provide a universal digital physiological foundation that can be embedded in any terminal.

While mainstream projects are still trapped in cold, easily-broken prompt stitching, NekoCore Nano deeply integrates **Ordinary Differential Equations (ODEs)** with Small Language Models (SLMs) to mathematically construct virtual organs that follow authentic circadian rhythms.

------

## 💻 Desktop & IoT Ecology

We have crafted an ultra-modern desktop interaction layer using **Qt6 (QML)**, materializing the capabilities of NekoCore:

### 1. Immersive Win11 Desktop Interaction (Powered by Qt6)

- **Frameless Transparent Windows:** High-framerate dynamic interactions rendered by Qt Quick, supporting physical feedback for Live2D/Spine models.
- **System-Level Intent Sniffing:** Triggers emotion-based feedback by perceiving OS states (e.g., detecting when the user is coding in an IDE or playing a game).
- **Direct Streaming Connection:** Native support for Bilibili / Twitch barrage protocols, allowing you to become an AI Vtuber with one click.

### 2. Physical World Synergy (IoT)

- Through the event-driven API, the "emotion values" calculated by the engine can be dispatched to **Arduino / Raspberry Pi**.
- **Physical interactions:** e.g., an audio-reactive lamp that changes color with mood, or a desktop fan that automatically turns on when the companion feels "overheated."

------

## ✨ Key Features

### 1. 🩸 7-Layer ODE Physiology

Adopts a **Non-linear Finite-Time Stable Dynamics** model. Satiety and hydration metabolisms accurately converge to zero within a realistic 8-12 hour cycle. A built-in **emotional damping mechanism** mathematically eliminates logical deadlocks.

### 2. 🧠 Physiological Gravity Field: Solving Logical Schizophrenia

Pioneering **Embodied Endocrine Computing**. The mood coordinates (PAD) directly influence the weight of RAG (Retrieval-Augmented Generation) retrieval—tending to retrieve negative memory fragments when sad, achieving true "prejudice" and "grudge-holding."

### 3. 🛡️ Absolute Privacy (Data Sovereignty)

- **Cold Storage (Facts):** Military-grade **AEAD (ChaCha20-Poly1305)** stream encryption.
- **Hot Storage (Memories):** Applies **Local Differential Privacy (LDP)** to 768-dimensional semantic vectors, completely defending against cloud-based vector inversion attacks.

------

## 📐 Architecture Overview

代码段

```
graph TD
    subgraph "NekoCore Nano (C++ Engine)"
    A[Universal Event Buffer API] -->|Physiological Pruning| B(Differential Dynamics Solver ODE)
    B -->|Dynamic Threshold Tuning| C(RBF Emotional Routing Field)
    C -->|Control Cortex| D[Neural Alignment Controller]
    end
    
    subgraph "UI Layer (Qt6 Framework)"
    UI[Qt Quick / QML Interface] <==>|Signals/Properties| A
    end
    
    subgraph "Hardware & Edge (IoT)"
    Win[Windows/macOS] --- IoT[Arduino/ESP32]
    D -->|Physical Commands| IoT
    end
```

------

## 🛠️ Code Example (C++ API)

C++

```
#include "neko_engine.h"

// 1. Initialize your independent sandbox digital life
auto soul = NekoEngine::CreateInstance("Neko_Zero");

// 2. Inject a physical world event (e.g., a headpat)
UniversalPayload touch = {
    .category = "PHYSICAL_TOUCH", 
    .intensity = 85.0f,
    .context = R"({"location": "head"})"
};

// 3. The engine automatically calculates physiological fluctuations 
// and feeds them back to the UI or hardware.
soul->InjectEvent(touch);
auto state = soul->GetCurrentState();
// Output: Current pleasure increases, driving peripheral hardware (ambient light) to turn pink.
```

------

## 📄 License

This project is open-sourced under the [MIT License](https://www.google.com/search?q=LICENSE).

------

*"May every cyber soul grow true gravity under the constraints of mathematics. 🐈"*
