# Findings & Decisions

## Requirements
- 调研 Gemini CLI 集成测试框架
- 分析现有 LSP 测试覆盖情况
- 制定新的 LSP 功能集成测试任务计划

## Research Findings

### 5. LSP 测试现状分析 (更新)

**现有测试文件:** `integration-tests/lsp.test.ts`

#### 测试覆盖的 LSP 功能 (13 个):
1. `goToDefinition` - 查找定义
2. `findReferences` - 查找引用
3. `hover` - 悬停信息
4. `documentSymbol` - 文档符号
5. `workspaceSymbol` - 工作空间符号
6. `goToImplementation` - 查找实现
7. `prepareCallHierarchy` - 准备调用层级
8. `incomingCalls` - 调用入
9. `outgoingCalls` - 调用出
10. `diagnostics` - 诊断信息
11. `workspaceDiagnostics` - 工作空间诊断
12. `codeActions` - 代码操作
13. 综合场景测试

#### 测试代码结构分析

**测试 Fixture:**
- 使用统一的 TypeScript 代码 fixture
- 包含类、继承、函数等基础元素
- 文件大小适中 (~60 行)

**测试模式:**
```typescript
describe('LSP 集成测试', () => {
  let rig: TestRig;
  beforeEach(() => { rig = new TestRig(); });
  afterEach(async () => { await rig.cleanup(); });

  describe('goToDefinition', () => {
    it('应该能找到类的定义', async () => {
      await rig.setup('lsp-goToDefinition');
      createFixtures();
      const result = await rig.run('lsp goToDefinition 测试');
      const hasLspCall = toolCalls.some(call => call.toolRequest.name === 'lsp');
      expect(hasLspCall).toBe(true);
    });
  });
});
```

**验证方式:**
- ✅ 验证是否调用了 `lsp` 工具
- ❌ 未验证返回结果的准确性
- ❌ 未验证具体的文件路径和位置
- ❌ 未验证错误处理

**超时设置:**
- 每个测试：60 秒 (`LSP_TEST_TIMEOUT = 60000`)

#### 测试质量评估

**优点:**
1. ✅ 覆盖了所有主要 LSP 功能点
2. ✅ 使用统一的测试 fixture，便于维护
3. ✅ 测试结构清晰，遵循项目规范
4. ✅ 使用 TestRig 提供完整的生命周期管理

**不足之处:**
1. ❌ **验证过于简单** - 只检查是否调用 lsp 工具，未验证返回结果
2. ❌ **缺少边界测试** - 没有测试大型文件、复杂项目结构
3. ❌ **缺少错误场景** - 未测试文件不存在、LSP 服务器崩溃等情况
4. ❌ **缺少性能测试** - 未测试响应时间、并发请求
5. ❌ **Fixture 单一** - 只有 TypeScript，缺少其他语言支持
6. ❌ **缺少多文件场景** - 未测试跨文件引用、工作空间符号搜索
7. ❌ **缺少增量更新测试** - 未测试文件修改后的 LSP 响应

#### 需要改进的测试场景

**1. 结果验证增强**
- 验证返回的文件路径正确
- 验证行号、列号准确
- 验证符号名称匹配

**2. 多文件项目测试**
- 创建包含多个文件的项目结构
- 测试跨文件引用查找
- 测试工作空间范围内的符号搜索

**3. 错误处理测试**
- 文件不存在时的错误处理
- 语法错误文件的诊断信息
- LSP 服务器超时或崩溃

**4. 复杂场景测试**
- 大型文件（>1000 行）的响应性能
- 深度嵌套的类/函数结构
- 泛型、联合类型等复杂 TypeScript 特性

**5. 增量更新测试**
- 文件修改后重新获取诊断
- 保存文件后触发 LSP 刷新
- 热重载场景测试

**6. 特定功能深度测试**
- `codeActions`: 测试快速修复、重构建议
- `diagnostics`: 验证错误、警告、信息的分类
- `findReferences`: 测试找到所有引用（包括导入）

**7. 真实项目测试**
- 在 Gemini CLI 实际代码上测试
- 测试多包 monorepo 结构
- 测试 TypeScript 配置（tsconfig.json）影响

### 6. 测试框架关键特性

**TestRig 核心 API:**
- `setup()` - 初始化测试环境
- `createFile()` / `mkdir()` - 创建文件/目录
- `run()` / `runInteractive()` - 运行 CLI
- `waitForToolCall()` - 等待工具调用
- `readToolLogs()` - 读取工具日志
- `readFile()` - 读取文件
- `cleanup()` - 清理环境

**测试配置选项:**
- `approvalMode`: 'default' | 'auto_edit' | 'yolo' | 'plan'
- `settings`: 自定义工具权限等配置
- `fakeResponsesPath`: 使用录制的模型响应

**验证工具函数:**
- `printDebugInfo()` - 打印调试信息
- `assertModelHasOutput()` - 验证模型输出
- `checkModelOutputContent()` - 检查输出内容

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 使用 TestRig 作为核心测试工具 | 提供完整的测试生命周期管理 |
| 基于 telemetry 验证工具调用 | 不依赖具体输出格式，更可靠 |
| 使用 fixtures 模式 | 可重复使用的测试数据 |
| 支持多种 approvalMode | 适应不同测试场景需求 |

## Issues Encountered

暂无

## Resources

### 重要文件路径
- 测试框架：`packages/test-utils/src/test-rig.ts`
- 测试辅助：`integration-tests/test-helper.ts`
- LSP 测试：`integration-tests/lsp.test.ts`
- 配置：`integration-tests/vitest.config.ts`
- 文档：`docs/integration-tests.md`

### 测试工具 API 参考
- `setup()` - 初始化测试
- `createFile()` / `mkdir()` - 创建文件/目录
- `run()` / `runInteractive()` - 运行 CLI
- `waitForToolCall()` - 等待工具调用
- `readToolLogs()` - 读取工具日志
- `readFile()` - 读取文件
- `cleanup()` - 清理

### 测试最佳实践
1. 每个测试使用独立的临时目录
2. 使用 `beforeEach`/`afterEach` 管理生命周期
3. 提供详细的调试信息便于排查
4. 使用语义化的测试名称
5. 验证工具调用 + 输出内容双重验证
