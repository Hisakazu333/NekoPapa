# ADR-0000: 决策标题

- Status: Proposed
- Date: YYYY-MM-DD
- Owners: @owner
- Related issues: #
- Related PRs: #
- Supersedes: none
- Superseded by: none

## Context

描述要解决的问题、触发条件、约束和不做决定的成本。明确这是当前事实、目标变化还是迁移需要。

## Current evidence

列出可复核的源码路径、配置、测试、平台/架构、提交号和运行结果。不要只引用截图、愿景文档或记忆中的行为。

## Decision

用可执行的语言写出选择：谁拥有状态、允许的依赖方向、公开契约、错误语义和生命周期。明确适用范围与生效条件。

## Boundary impact

| Boundary | Before | After | Owner |
| --- | --- | --- | --- |
| React | | | |
| Tauri/Rust | | | |
| Stage protocol | | | |
| Native Stage | | | |
| NekoCore-Nano/graphics | | | |
| Assets/third-party | | | |

删除不适用行。涉及权限、隐私、许可、安装包或持久化时增加专门说明。

## Alternatives considered

### Keep current state

说明收益、风险和拒绝原因。

### Alternative A

说明收益、风险和拒绝原因。

### Alternative B

说明收益、风险和拒绝原因。

## Consequences

### Positive

- TBD

### Negative

- TBD

### Risks and mitigations

| Risk | Signal | Mitigation | Owner |
| --- | --- | --- | --- |
| | | | |

## Rollout

按可独立验证、可回滚的阶段列出实现顺序。每阶段给出入口、退出条件和 feature flag/兼容 facade（如适用）。

## Rollback

写明回滚到什么版本/协议/路径，如何保护数据，以及什么信号触发回滚。禁止用 force-push 或接受未知协议作为回滚方案。

## Verification

- [ ] Static checks
- [ ] Unit/contract tests
- [ ] Cross-platform build
- [ ] Runtime smoke
- [ ] Package contents/signing（如适用）
- [ ] License/security review（如适用）
- [ ] Rollback rehearsal

列出具体命令、CI job 和需要保存的 artifact。

## Documentation updates

- [ ] Runtime boundaries
- [ ] Migration plan
- [ ] Project structure
- [ ] Protocol/API docs
- [ ] README / release notes

## Follow-up issues

- #
