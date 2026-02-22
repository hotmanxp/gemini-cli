# Findings & Decisions - LSP 集成测试

## Requirements

- 用集成测试方式测试所有 LSP 功能点
- 覆盖 LSP tool 支持的所有操作类型
- 确保测试可运行且通过
- 使用 CLI 实际运行方式 (`npm start --p "lsp ..."`)
- 使用真实的 LSP 服务器响应

## Research Findings

### LSP 支持的操作类型 (共 12 种)

从 `packages/core/src/tools/lsp.ts` 中发现以下 LSP 操作：

**位置相关操作 (需要 filePath + line + character):**

1. `goToDefinition` - 查找符号定义
2. `findReferences` - 查找所有引用
3. `hover` - 获取悬停信息 (文档、类型信息)
4. `goToImplementation` - 查找接口或抽象方法的实现
5. `prepareCallHierarchy` - 获取调用层级项

**文件相关操作 (只需要 filePath):** 6.
`documentSymbol` - 获取文档中的所有符号 7.
`diagnostics` - 获取文件的诊断消息 (错误、警告)

**工作空间相关操作:** 8. `workspaceSymbol` - 跨工作空间搜索符号 (需要 query) 9.
`workspaceDiagnostics` - 获取整个工作空间的诊断

**调用层级操作 (需要 callHierarchyItem):** 10.
`incomingCalls` - 查找调用给定函数的所有函数 11.
`outgoingCalls` - 查找给定函数调用的所有函数

**代码操作:** 12. `codeActions` - 获取指定位置的代码操作 (快速修复、重构)

### 集成测试方式

集成测试应该通过 CLI 实际运行 LSP 命令来测试：

- 使用 `npm start --p "lsp <operation> ..."` 命令
- 使用 TestRig 来运行 CLI 并捕获输出
- 验证 tool calls 是否正确触发
- 验证输出结果是否符合预期

### 测试基础设施

- 测试框架：Vitest
- 测试目录：`integration-tests/`
- TestRig: `packages/test-utils/src/test-rig.ts`
- 现有集成测试参考：`integration-tests/simple-mcp-server.test.ts`

## Technical Decisions

| Decision                                 | Rationale                                       |
| ---------------------------------------- | ----------------------------------------------- |
| 使用 CLI 集成测试而非单元测试            | 用户明确要求"npm start --p 'lsp test xxxx'"方式 |
| 测试放在 `integration-tests/lsp.test.ts` | 遵循项目集成测试规范                            |
| 使用 TestRig 运行 CLI                    | 复用现有测试基础设施                            |
| 创建 TypeScript 和 Python fixtures       | 测试不同语言的 LSP 支持                         |
| 每个 LSP 操作一个测试用例                | 清晰组织 12 种不同操作                          |

## Issues Encountered

| Issue                | Resolution                     |
| -------------------- | ------------------------------ |
| 初始设计为单元测试   | 用户指出需要 CLI 集成测试方式  |
| 需要重新设计测试架构 | 改用 TestRig 和 npm start 方式 |

## Resources

- LSP Tool 实现：`packages/core/src/tools/lsp.ts`
- LSP 服务：`packages/core/src/services/lsp/LspService.ts`
- 集成测试 helper：`integration-tests/test-helper.ts`
- TestRig 实现：`packages/test-utils/src/test-rig.ts`
- 集成测试示例：`integration-tests/simple-mcp-server.test.ts`

## 测试覆盖清单

- [x] goToDefinition - 集成测试用例
- [x] findReferences - 集成测试用例
- [x] hover - 集成测试用例
- [x] documentSymbol - 集成测试用例
- [x] workspaceSymbol - 集成测试用例
- [x] goToImplementation - 集成测试用例
- [x] prepareCallHierarchy - 集成测试用例
- [x] incomingCalls - 集成测试用例
- [x] outgoingCalls - 集成测试用例
- [x] diagnostics - 集成测试用例
- [x] workspaceDiagnostics - 集成测试用例
- [x] codeActions - 集成测试用例
- [x] LSP 综合场景 - 真实项目测试

**总计：13 个集成测试用例**

---

_Update this file after every 2 view/browser/search operations_ _This prevents
visual information from being lost_
