# OpenNeko Engine 完整项目结构

```
open-neko-engine/
├── CMakeLists.txt
├── CMakePresets.json
├── LICENSE / README.md / README_EN.md / CONTRIBUTING.md
├── .clang-format / .clang-tidy / .gitignore / .gitattributes
│
├── cmake/                                  # 构建基础设施
│   ├── NNAOptions.cmake
│   ├── NNACompilerFlags.cmake
│   ├── NNAInstall.cmake
│   ├── NNADependencies.cmake
│   ├── FindLive2D.cmake / FindMindSpore.cmake
│   ├── FindONXRuntime.cmake / FindVITS.cmake
│   └── FindOpenXR.cmake
│
├── engine/                                 # ── libopenneko 核心引擎（纯C++, 零Qt依赖）──
│   ├── CMakeLists.txt
│   ├── include/nna/                        # 公开头文件
│   │   ├── nna.h / export.h / version.h
│   │   │
│   │   ├── core/                           # 引擎核心
│   │   │   ├── engine.h                    # CreateInstance, Tick, Shutdown
│   │   │   ├── types.h                     # PADState, PhysiologicalState, UniversalPayload
│   │   │   ├── soul.h                      # DigitalSoul 7层ODE公开接口
│   │   │   ├── dual_pad.h                  # 双PAD空间融合（认知E_mind + 躯体E_body）
│   │   │   ├── physio_clipper.h            # 生理裁剪层 Φ（Tanh钳制外部载荷）
│   │   │   ├── hybrid_integrator.h         # 混合数值积分（RKF45自适应 + 辛积分器）
│   │   │   ├── events.h                    # 事件总线
│   │   │   ├── plugin.h                    # IPlugin 抽象
│   │   │   └── config.h                    # 引擎配置
│   │   │
│   │   ├── behavior/                       # 行为决策
│   │   │   ├── behavior_tree.h             # BT: Selector/Sequence/Decorator
│   │   │   ├── state_machine.h             # FSM
│   │   │   ├── bt_nodes.h                  # 内置节点库
│   │   │   └── bt_loader.h                 # JSON/Lua 加载行为树
│   │   │
│   │   ├── world/                          # 场景/世界
│   │   │   ├── world.h                     # 房间/物品/天气/时间
│   │   │   ├── entity.h                    # ECS-lite
│   │   │   ├── interaction.h               # 物品交互
│   │   │   └── environment.h               # 环境→情绪刺激映射
│   │   │
│   │   ├── character/                      # 角色系统
│   │   │   ├── character.h                 # Soul+外观+行为树+记忆 容器
│   │   │   ├── character_profile.h         # 性格矩阵/PAD基线
│   │   │   ├── growth.h                    # 成长/进化/经验曲线
│   │   │   ├── appearance.h                # 模型/服装/表情
│   │   │   ├── social.h                    # 多角色社交/情绪传染网络
│   │   │   └── genetics.h                  # 数字基因/繁殖系统
│   │   │
│   │   ├── memory/                         # 记忆系统
│   │   │   ├── memory_manager.h            # 分层记忆管理
│   │   │   ├── memory_types.h              # 短期/长期/情景/程序性
│   │   │   ├── memory_graph.h              # 情感记忆时空拓扑图（时间边+情感边）
│   │   │   ├── memory_retrieval.h          # 双阶段重排（云端S_sem → 本地引力场S_final）
│   │   │   ├── gravity_field.h             # 情感引力场（自适应方差σ_adapt + 语义门控）
│   │   │   ├── refractory_period.h         # 记忆不应期（时间戳惩罚/情绪死锁预防）
│   │   │   ├── memory_storage.h            # IMemoryStorage 抽象
│   │   │   └── memory_palace.h             # 3D记忆星图数据结构（图游走召回）
│   │   │
│   │   ├── dream/                          # 梦境系统（独创）
│   │   │   ├── dream_engine.h              # 梦境合成（图游走算法）
│   │   │   ├── subconscious.h              # 潜意识层（压抑情绪积累/爆发）
│   │   │   ├── sleep_cycle.h               # 睡眠周期管理
│   │   │   └── async_annotator.h           # 异步情感打标流水线（空闲态MindSpore离线批处理）
│   │   │
│   │   ├── evolution/                      # 自主进化（独创）
│   │   │   ├── lora_trainer.h              # 边缘代理 LoRA微调（DPO + 稳态惩罚）
│   │   │   ├── physio_reward.h             # 确定性生理奖励 R_physio（ODE稳态差值）
│   │   │   ├── shadow_pipeline.h           # 暗影生成管道（对比响应y1/y2自动构造）
│   │   │   ├── physio_sandbox.h            # 生理推演沙盒（克隆平行ODE演化预期奖励）
│   │   │   ├── personality_drift.h         # 性格可塑性（PAD基线漂移）
│   │   │   └── free_will.h                 # 自由意志（SDE随机微分方程）
│   │   │
│   │   ├── perception/                     # 环境嗅探（独创）
│   │   │   ├── system_probe.h              # OS进程/状态监听（感觉过滤Sigmoid阈值）
│   │   │   ├── noise_mapper.h              # 环境噪声→压力载荷
│   │   │   ├── host_vitals.h               # 电量/温度/GPU状态
│   │   │   └── multimodal_fuser.h          # 多模态情感融合
│   │   │
│   │   ├── survival/                       # 降级生存（独创）
│   │   │   ├── power_guardian.h            # 断电/过热自保（非屏蔽硬件中断）
│   │   │   └── reflex_mode.h              # 低功耗反射模式（仅ODE+规则树，阻断GPU推演）
│   │   │
│   │   ├── narrative/                      # 事件/剧情
│   │   │   ├── event_system.h              # 事件链/触发/分支
│   │   │   ├── dialogue_graph.h            # 对话图
│   │   │   ├── timeline.h                  # 日程/纪念日/生物钟
│   │   │   └── time_capsule.h              # 时间胶囊（跨时间情感连接）
│   │   │
│   │   ├── ai/                             # AI/LLM 具身内分泌计算（拒绝提示词翻译）
│   │   │   ├── llm_provider.h              # ILLMProvider 抽象
│   │   │   ├── llm_router.h               # 多Provider路由/降级/负载均衡
│   │   │   ├── physio_modulator.h          # 生理变量→解码超参绑定（E→max_tokens, A→Temperature）
│   │   │   ├── somatic_marker.h            # 躯体标记融合（双PAD→E_curr驱动引力场重排）
│   │   │   ├── semantic_gate.h             # 语义门控（sigmoid阈值τ防止逻辑分裂）
│   │   │   ├── intent_classifier.h         # 本地意图分类
│   │   │   ├── emotion_recognizer.h        # 本地情绪识别（Function Calling零延迟返回PAD坐标）
│   │   │   └── inference_engine.h          # MindSpore/ONNX本地推理
│   │   │
│   │   ├── audio/                          # 音频/语音
│   │   │   ├── audio_pipeline.h
│   │   │   ├── tts_engine.h               # ITTSEngine（VITS/GPT-SoVITS/云端）
│   │   │   ├── stt_engine.h               # ISTTEngine（Whisper/云端）
│   │   │   ├── vad.h                      # 语音活动检测
│   │   │   └── bgm_controller.h           # BGM情绪联动
│   │   │
│   │   ├── vision/                         # 计算机视觉（游戏代理用）
│   │   │   ├── screen_capture.h            # 屏幕捕获
│   │   │   ├── object_detector.h           # YOLO目标检测
│   │   │   └── input_emulator.h            # 键鼠模拟操控
│   │   │
│   │   ├── graphics/                       # 图形/动画
│   │   │   ├── i_renderer.h
│   │   │   ├── live2d/live2d_renderer.h
│   │   │   ├── vrm/vrm_renderer.h
│   │   │   ├── spine/spine_renderer.h
│   │   │   ├── expression_driver.h         # PAD→表情参数
│   │   │   ├── lipsync_driver.h            # 音频→嘴型
│   │   │   ├── gaze_tracker.h              # 视线追踪
│   │   │   └── idle_animation.h            # 呼吸/眨眼/小动作
│   │   │
│   │   ├── physics/physics_world.h         # Box2D封装
│   │   │
│   │   ├── input/                          # 触觉/手势
│   │   │   ├── touch_system.h              # 摸头/戳脸/拖拽→刺激
│   │   │   ├── gesture_recognizer.h
│   │   │   └── input_mapper.h
│   │   │
│   │   ├── proactive/                      # 主动关怀
│   │   │   ├── proactive_engine.h
│   │   │   ├── schedule_manager.h          # 日程/闹钟/习惯
│   │   │   ├── context_sensor.h            # 时间/天气/系统状态
│   │   │   └── notification.h
│   │   │
│   │   ├── sync/                           # 同步引擎
│   │   │   ├── dialogue_manager.h
│   │   │   ├── network_interface.h
│   │   │   └── snapshot_manager.h
│   │   │
│   │   ├── storage/                        # 持久化
│   │   │   ├── storage_engine.h            # SQLite + ChaCha20 AEAD
│   │   │   ├── migration.h
│   │   │   └── backup.h
│   │   │
│   │   ├── security/                       # 隐私安全（绝对数据主权边界）
│   │   │   ├── aead_crypto.h               # ChaCha20-Poly1305 / AES-256-GCM（冷库流加密）
│   │   │   └── ldp_noise.h                # 768维向量局部差分隐私（热库加噪，云端可用不可见）
│   │   │
│   │   ├── iot/                            # IoT硬件联动
│   │   │   ├── iot_bridge.h               # 串口/UDP/MQTT
│   │   │   ├── device_registry.h
│   │   │   └── command_protocol.h          # 情绪→硬件指令
│   │   │
│   │   ├── scripting/                      # 脚本绑定
│   │   │   ├── lua_runtime.h
│   │   │   ├── lua_bindings.h
│   │   │   └── hot_reload.h               # 热重载
│   │   │
│   │   ├── debug/                          # 调试协议
│   │   │   ├── debug_server.h              # WebSocket调试服务
│   │   │   ├── inspector_protocol.h
│   │   │   └── telemetry.h
│   │   │
│   │   └── c_api/nna_c_api.h              # extern "C" FFI
│   │
│   └── src/                                # 私有实现（对应上面每个目录）
│       └── ...（每个 include 目录对应 .cpp 实现）
│
├── app/                                    # ── 多平台应用 ──
│   ├── stage-desktop/                      # Qt6 桌宠（主力）
│   │   ├── CMakeLists.txt
│   │   ├── src/
│   │   │   ├── main.cpp
│   │   │   ├── app_controller.h/cpp        # QObject 桥接引擎→QML
│   │   │   ├── window_controller.h/cpp     # 无边框透明穿透窗口
│   │   │   ├── tray_manager.h/cpp          # 系统托盘
│   │   │   ├── memory_palace_view.h/cpp    # 3D记忆星图渲染（OpenGL/Vulkan）
│   │   │   └── emotion_spectrum.h/cpp      # 情感光谱可视化
│   │   ├── qml/
│   │   │   ├── main.qml
│   │   │   ├── NNAWindow.qml               # 无边框桌宠窗口
│   │   │   ├── NNAAvatarCanvas.qml         # Live2D/VRM渲染面
│   │   │   ├── NNAChatBubble.qml           # 聊天气泡
│   │   │   ├── NNAStatusPanel.qml          # 生理仪表盘
│   │   │   ├── NNAMemoryPalace.qml         # 记忆星图3D面板
│   │   │   └── NNASubconsciousConsole.qml  # 潜意识控制台
│   │   └── resources/
│   │
│   ├── stage-web/                          # WebAssembly 版本
│   │   ├── CMakeLists.txt                  # Emscripten 构建
│   │   └── src/
│   │
│   ├── stage-mobile/                       # 移动端（与 Neko-Buddy APP 联动）
│   │   ├── CMakeLists.txt
│   │   ├── android/                        # JNI 桥接
│   │   ├── ios/                            # ObjC++ 桥接
│   │   ├── harmony/                        # HarmonyOS NAPI
│   │   └── src/
│   │       └── app_sync_bridge.h/cpp       # 与 Neko-Buddy Java 后端同步
│   │
│   └── stage-xr/                           # WebXR/OpenXR 空间体验
│       ├── CMakeLists.txt
│       └── src/
│
├── agents/                                 # ── 游戏/设备代理 ──
│   ├── CMakeLists.txt
│   ├── minecraft/                          # Minecraft 游玩代理
│   │   ├── CMakeLists.txt
│   │   └── src/
│   ├── factorio/                           # Factorio 自动化代理
│   │   ├── CMakeLists.txt
│   │   └── src/
│   ├── game-vision/                        # 通用游戏视觉代理（YOLO+LM）
│   │   ├── CMakeLists.txt
│   │   └── src/
│   └── device-control/                     # 系统级设备操控
│       ├── CMakeLists.txt
│       └── src/
│
├── services/                               # ── 社交/直播服务 ──
│   ├── discord-bot/
│   ├── telegram-bot/
│   ├── bilibili-live/                      # B站弹幕+直播互动
│   └── twitch-live/                        # Twitch 直播
│
├── plugins/                                # ── 可选插件 ──
│   ├── CMakeLists.txt
│   ├── bilibili/                           # B站弹幕协议
│   ├── homeassistant/                      # 智能家居
│   ├── economy/                            # 经济系统（Neko-Buddy业务）
│   ├── learning/                           # 学习模块（Neko-Buddy业务）
│   ├── content/                            # 内容管理（Neko-Buddy业务）
│   ├── user-session/                       # 用户会话（Neko-Buddy业务）
│   └── neko-buddy-sync/                    # Neko-Buddy APP 联动插件
│       ├── CMakeLists.txt
│       └── src/
│           ├── app_bridge.h/cpp            # 与 Java后端 WebSocket/REST同步
│           ├── wallet_sync.h/cpp           # 钱包/资产同步
│           └── status_sync.h/cpp           # 猫娘状态双向同步
│
├── tools/                                  # ── 开发者工具 ──
│   ├── character-editor/                   # 角色编辑器（Qt6）
│   │   ├── CMakeLists.txt
│   │   └── src/                            # 可视化编辑性格矩阵/PAD/刺激映射
│   ├── bt-editor/                          # 行为树可视化编辑器
│   │   ├── CMakeLists.txt
│   │   └── src/
│   ├── neko-packer/                        # 资源打包工具
│   │   ├── CMakeLists.txt
│   │   └── src/                            # 模型+配置+行为树+语音→.neko包
│   └── nna-inspector/                      # 远程调试面板（Web）
│       └── src/                            # 连接引擎WebSocket调试服务
│
├── tests/                                  # ── 测试 ──
│   ├── CMakeLists.txt
│   ├── unit/
│   │   ├── test_soul_math.cpp              # RK4/RKF45收敛/PAD边界/双PAD融合
│   │   ├── test_metabolism.cpp             # 8-12h有限时间收敛（分数指数ρ=0.8）
│   │   ├── test_emotional_dynamics.cpp     # 阻尼/噪声/半衰期/不应期死锁预防
│   │   ├── test_behavior_tree.cpp
│   │   ├── test_memory_retrieval.cpp       # 引力场双阶段重排/语义门控/自适应方差
│   │   ├── test_memory_graph.cpp           # 情感记忆时空拓扑图（时间边+情感边）
│   │   ├── test_dream_engine.cpp           # 梦境合成
│   │   ├── test_subconscious.cpp           # 潜意识爆发阈值
│   │   ├── test_genetics.cpp               # 基因/繁殖
│   │   ├── test_shadow_pipeline.cpp        # 暗影生成管道（y1/y2对比+沙盒裁判）
│   │   ├── test_physio_modulator.cpp       # 生理变量→解码超参绑定验证
│   │   ├── test_aead_crypto.cpp
│   │   ├── test_ldp_noise.cpp
│   │   └── test_free_will.cpp              # SDE统计分布验证
│   ├── integration/
│   │   ├── test_engine_lifecycle.cpp       # Init→Tick(24h)→Sleep→Dream→Wake（辛积分器能量守恒）
│   │   ├── test_plugin_loading.cpp
│   │   ├── test_lora_training.cpp          # 边缘代理微调端到端（生理奖励→DPO闭环）
│   │   └── test_neko_buddy_sync.cpp        # APP联动
│   └── benchmark/
│       ├── bench_ode_solver.cpp
│       ├── bench_hybrid_integrator.cpp     # RKF45 vs 辛积分器性能对比
│       └── bench_memory_retrieval.cpp      # 引力场重排延迟基准
│
├── examples/                               # ── 示例 ──
│   ├── headless-soul/                      # 控制台：创建灵魂/tick/打印
│   ├── iot-demo/                           # Arduino串口桥接
│   │   └── arduino/neko_fan_controller.ino
│   ├── multi-character/                    # 多角色情绪传染演示
│   ├── dream-demo/                         # 梦境系统演示
│   └── game-agent-demo/                    # 游戏代理最小示例
│
├── third_party/                            # ── 第三方依赖 ──
│   ├── CMakeLists.txt
│   ├── README.md                           # 许可证清单
│   ├── box2d/
│   └── lua/                                # Lua 5.4
│
├── doc/                                    # ── 文档 ──
│   ├──（已有NNA规范手册/环境配置指南）
│   ├── architecture.md                     # 架构图（Mermaid）
│   ├── api_reference.md                    # 公开API速查
│   ├── innovation.md                       # 独创系统技术白皮书
│   └── neko-buddy-integration.md           # APP联动协议文档
│
├── scripts/
│   ├── build_win.bat / build_mac.sh / build_linux.sh
│   └── ci/gitee_ci.yml
│
├── assets/                                 # ── 运行时资源（Git LFS）──
│   ├── models/                             # Live2D/VRM/Spine 模型
│   ├── ai_weights/                         # MindSpore/ONNX 权重
│   ├── audio/                              # 预置语音/BGM
│   └── characters/                         # .neko 角色包
```

---

## CMake 构建选项

| 选项 | 默认 | 说明 |
|------|------|------|
| `NNA_ENABLE_LIVE2D` | OFF | Cubism SDK |
| `NNA_ENABLE_VRM` | OFF | VRM 3D模型 |
| `NNA_ENABLE_SPINE` | OFF | Spine骨骼动画 |
| `NNA_ENABLE_MINDSPORE` | OFF | MindSpore Lite |
| `NNA_ENABLE_ONNX` | OFF | ONNX Runtime |
| `NNA_ENABLE_VITS` | OFF | 本地TTS |
| `NNA_ENABLE_WHISPER` | OFF | 本地STT |
| `NNA_ENABLE_YOLO` | OFF | 游戏视觉 |
| `NNA_ENABLE_IOT` | OFF | Arduino/ESP32 |
| `NNA_ENABLE_LUA` | ON | Lua脚本 |
| `NNA_ENABLE_SECURITY` | ON | 加密+LDP |
| `NNA_ENABLE_OPENXR` | OFF | XR空间体验 |
| `NNA_BUILD_APP` | ON | Qt6桌宠 |
| `NNA_BUILD_AGENTS` | OFF | 游戏代理 |
| `NNA_BUILD_SERVICES` | OFF | 社交服务 |
| `NNA_BUILD_PLUGINS` | OFF | 业务插件 |
| `NNA_BUILD_TOOLS` | OFF | 开发者工具 |
| `NNA_BUILD_TESTS` | ON | 测试 |
| `NNA_BUILD_EXAMPLES` | ON | 示例 |

---

## 命名空间

```
nna::core            – 引擎核心/Soul/ODE/双PAD融合/混合积分/生理裁剪
nna::behavior        – 行为树/状态机
nna::world           – 场景/世界/ECS
nna::character       – 角色/成长/社交/基因
nna::memory          – 记忆拓扑图/引力场重排/星图/不应期
nna::dream           – 梦境/潜意识/异步打标流水线
nna::evolution       – LoRA进化/暗影管道/生理沙盒/性格漂移/自由意志
nna::perception      – 环境嗅探/感觉过滤/多模态融合
nna::survival        – 降级生存/自保/硬件中断
nna::narrative       – 事件/剧情/时间胶囊
nna::ai              – 具身内分泌计算/生理调制/语义门控/躯体标记（零提示词）
nna::audio           – TTS/STT/VAD/BGM
nna::vision          – 屏幕捕获/YOLO/键鼠
nna::graphics        – Live2D/VRM/Spine/表情/口型
nna::physics         – Box2D
nna::input           – 触觉/手势
nna::proactive       – 主动关怀/日程
nna::sync            – 同步/网络
nna::storage         – SQLite/加密持久化
nna::security        – AEAD冷库加密/LDP热库加噪/数据主权边界
nna::iot             – 硬件联动
nna::scripting       – Lua/热重载
nna::debug           – 调试/遥测
nna::plugins::*      – 业务插件
```
