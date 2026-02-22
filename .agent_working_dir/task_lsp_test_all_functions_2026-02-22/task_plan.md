# Task Plan: LSP 功能集成测试

## Goal

创建完整的 LSP (Language Server
Protocol) 功能集成测试，覆盖所有核心操作的测试用例。

## Current Phase

Phase 2

## Phases

### Phase 1: 需求分析与功能点梳理

- [x] 理解 LSP 支持的所有操作类型
- [x] 识别需要测试的核心功能点
- [x] 分析现有 LSP 实现代码
- [x] 确定测试范围和优先级
- **Status:** complete

### Phase 2: 集成测试架构设计

- [x] 设计 CLI 集成测试脚本
- [x] 创建测试 fixtures 和预期输出
- [x] 实现测试运行框架
- [x] 编写测试报告生成器
- **Status:** complete

### Phase 3: 核心功能测试实现

- [x] goToDefinition 集成测试
- [x] findReferences 集成测试
- [x] hover 集成测试
- [x] documentSymbol 集成测试
- [x] workspaceSymbol 集成测试
- [x] goToImplementation 集成测试
- [x] prepareCallHierarchy 集成测试
- [x] incomingCalls 集成测试
- [x] outgoingCalls 集成测试
- [x] diagnostics 集成测试
- [x] workspaceDiagnostics 集成测试
- [x] codeActions 集成测试
- **Status:** complete

### Phase 4: 测试运行与验证

- [ ] 运行所有集成测试
- [ ] 验证输出结果
- [ ] 记录测试结果
- [ ] 生成测试报告
- **Status:** pending

### Phase 5: 文档与收尾

- [ ] 编写测试说明文档
- [ ] 最终 review
- **Status:** pending

## Key Questions

1. LSP tool 支持哪些具体操作？
2. 现有测试基础设施如何复用？
3. 需要什么样的测试 fixtures？
4. 如何验证 LSP 响应的正确性？

## Decisions Made

| Decision | Rationale |
| -------- | --------- |
|          |           |

## Errors Encountered

| Error | Attempt | Resolution |
| ----- | ------- | ---------- |
|       | 1       |            |

## Notes

- 集成测试应该放在 `packages/cli/src/integration-tests/` 或类似目录
- 使用 Vitest 作为测试框架
- 需要创建测试专用的代码 fixtures
- 参考现有 LSP tool 实现来确定测试范围
