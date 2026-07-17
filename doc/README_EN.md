# NekoPapa Documentation

English | [简体中文](README.md)

This index routes readers by task and states the language boundary explicitly. The root README is bilingual; most detailed engineering and product documents are currently maintained in Chinese so that their normative wording has one source of truth.

## Start Here

- [English project README](../README_EN.md): product scope, verified status, prerequisites, and quick start
- [Contributing guide](../CONTRIBUTING.md) (Chinese): branches, validation, and Pull Request requirements
- [Development environment](contributing/development-environment.md) (Chinese): macOS, Windows, browser preview, and Native Stage setup
- [Git workflow](contributing/git-workflow.md) (Chinese): worktrees, synchronization, conflicts, and recovery
- [Issue and Pull Request guide](contributing/issue-and-pull-request-guide.md) (Chinese): forms, evidence, and review

## Governance

- [Project governance](../GOVERNANCE.md) (Chinese): naming, evidence, branches, merge policy, architecture decisions, and releases
- [Issue governance and verified backlog](ISSUES.md) (Chinese): labels, lifecycle, Ready/Done, and tracked candidates
- [NNA engineering standards](engineering/standards.md) (Chinese): React, Rust, C++, protocol, dependencies, and assets
- [Security policy](../SECURITY.md) (Chinese): private reporting and security boundaries

## Product And Architecture

- [Product prototype baseline](product/README.md) (Chinese)
- [48 prototype assets](product/prototype-baseline.md) (Chinese)
- [Desktop UI architecture and acceptance](product/desktop-ui-architecture.md) (Chinese)
- [Desktop architecture index](architecture/README.md) (Chinese)
- [Runtime boundaries](architecture/desktop-runtime-boundaries.md) (Chinese)
- [Repository layout](architecture/repository-layout.md) (Chinese)
- [Build and test gates](architecture/build-and-test-gates.md) (Chinese)
- [Stage Protocol v1](../protocol/stage/v1/README.md)

Prototype images describe intended states, not delivered backend capabilities. Current behavior must be supported by source, automated checks, and named runtime evidence.

## Documentation Status

Use these evidence levels when reading status claims: Source-reviewed, Static-verified, Build-verified, Runtime-smoke-tested, Package-verified, and Release-verified. A result on one platform does not establish support on another.

Historical OpenNeko material is isolated under [legacy](legacy/README.md) and does not define the current NekoPapa roadmap.
