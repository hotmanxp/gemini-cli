# LSP 功能增强集成测试任务计划

## 任务目标
基于现有 LSP 测试的不足，设计并实现一套更全面、更深入的 LSP 功能集成测试，提升测试覆盖率和验证质量。

---

## Phase 1: 测试结果验证增强

### 1.1 goToDefinition 结果验证
**文件:** `integration-tests/lsp-advanced.test.ts`
**测试用例:**
```typescript
it('应该能找到类定义并验证返回位置', async () => {
  await rig.setup('lsp-goToDefinition-verify');
  createFixtures();
  
  const result = await rig.run('找到 Calculator 类的定义位置');
  
  // 验证工具调用
  expect(await rig.waitForToolCall('lsp')).toBe(true);
  
  // 验证返回结果包含正确的文件路径
  const toolLogs = rig.readToolLogs();
  const lspCall = toolLogs.find(log => log.toolRequest.name === 'lsp');
  expect(lspCall.toolRequest.args).toContain('lsp-test.ts');
  expect(lspCall.toolRequest.args).toContain('goToDefinition');
  
  // 验证模型输出包含正确的行号信息
  expect(result).toMatch(/行\s*\d+/i);
});
```

### 1.2 findReferences 完整性验证
**测试用例:**
```typescript
it('应该找到所有引用并验证数量', async () => {
  await rig.setup('lsp-findReferences-count');
  createFixtures();
  
  const result = await rig.run('找到 Calculator 类的所有引用');
  
  // 验证找到了多个引用（构造函数、继承、实例化）
  const referenceCount = (result.match(/Calculator/g) || []).length;
  expect(referenceCount).toBeGreaterThanOrEqual(3);
});
```

### 1.3 hover 信息准确性验证
**测试用例:**
```typescript
it('应该显示准确的类型信息', async () => {
  await rig.setup('lsp-hover-type');
  createFixtures();
  
  const result = await rig.run('查看 getValue 函数的悬停信息');
  
  // 验证返回类型信息
  expect(result).toContain('number');
  expect(result).toMatch(/getValue.*:\s*number/i);
});
```

---

## Phase 2: 多文件项目场景测试

### 2.1 跨文件引用查找
**文件:** `integration-tests/lsp-multi-file.test.ts`
**测试场景:** 创建包含多个文件的项目

```typescript
// 创建多文件项目结构
const PROJECT_FILES = {
  'src/calculator.ts': `export class Calculator { ... }`,
  'src/operations.ts': `import { Calculator } from './calculator'; ...`,
  'src/main.ts': `import { Calculator } from './calculator'; ...`,
  'tests/calculator.test.ts': `import { Calculator } from '../src/calculator'; ...`
};

it('应该能找到跨文件的引用', async () => {
  await rig.setup('lsp-cross-file-references');
  createProject(PROJECT_FILES);
  
  const result = await rig.run('找到 Calculator 在项目中的所有引用');
  
  // 验证找到了所有文件的引用
  expect(result).toContain('calculator.ts');
  expect(result).toContain('operations.ts');
  expect(result).toContain('main.ts');
  expect(result).toContain('calculator.test.ts');
});
```

### 2.2 工作空间符号搜索
**测试用例:**
```typescript
it('应该能在工作空间搜索符号', async () => {
  await rig.setup('lsp-workspace-symbol-search');
  createProject(PROJECT_FILES);
  
  const result = await rig.run('搜索所有包含 calculate 的函数');
  
  // 验证找到了多个匹配的符号
  expect(result).toMatch(/calculate\w*/gi);
  expect((result.match(/calculate\w*/gi) || []).length).toBeGreaterThanOrEqual(2);
});
```

### 2.3 多包 monorepo 测试
**测试用例:**
```typescript
it('应该支持 monorepo 结构的符号查找', async () => {
  await rig.setup('lsp-monorepo');
  createMonorepoProject({
    'packages/core/src/index.ts': '...',
    'packages/cli/src/index.ts': '...',
    'packages/utils/src/index.ts': '...'
  });
  
  const result = await rig.run('找到核心模块的导出');
  expect(result).toBeDefined();
});
```

---

## Phase 3: 错误处理测试

### 3.1 文件不存在错误
**文件:** `integration-tests/lsp-error-handling.test.ts`

```typescript
it('应该友好处理不存在的文件', async () => {
  await rig.setup('lsp-file-not-found');
  
  const result = await rig.run('打开一个不存在的文件并获取定义');
  
  // 验证有友好的错误提示
  expect(result).toMatch(/不存在 | 找不到 | 无法打开/i);
  
  // 验证没有崩溃
  expect(result).not.toMatch(/崩溃 | 异常 | unhandled/i);
});
```

### 3.2 语法错误文件诊断
**测试用例:**
```typescript
it('应该报告语法错误', async () => {
  await rig.setup('lsp-syntax-error');
  rig.createFile('broken.ts', `class Broken { invalid syntax here }`);
  
  const result = await rig.run('检查 broken.ts 的错误');
  
  // 验证报告了语法错误
  expect(result).toMatch(/错误 | error | syntax|invalid/i);
});
```

### 3.3 LSP 服务器超时处理
**测试用例:**
```typescript
it('应该处理 LSP 服务器超时', async () => {
  await rig.setup('lsp-timeout');
  createLargeFile(10000); // 创建 10000 行的大文件
  
  const result = await rig.run('分析这个大文件');
  
  // 验证有超时或处理中的提示
  expect(result).toBeDefined();
});
```

---

## Phase 4: 性能和边界测试

### 4.1 大型文件响应测试
**文件:** `integration-tests/lsp-performance.test.ts`

```typescript
it('应该能在合理时间内响应大型文件', async () => {
  await rig.setup('lsp-large-file');
  createLargeFile(5000); // 5000 行
  
  const startTime = Date.now();
  const result = await rig.run('获取这个文件的符号列表');
  const duration = Date.now() - startTime;
  
  // 验证响应时间小于 10 秒
  expect(duration).toBeLessThan(10000);
  expect(result).toBeDefined();
});
```

### 4.2 深度嵌套结构测试
**测试用例:**
```typescript
it('应该能处理深度嵌套的类结构', async () => {
  await rig.setup('lsp-deep-nesting');
  createDeepNestedFile(10); // 10 层嵌套
  
  const result = await rig.run('找到最内层的类定义');
  expect(result).toBeDefined();
});
```

### 4.3 复杂 TypeScript 特性测试
**测试用例:**
```typescript
it('应该支持泛型类型的定义查找', async () => {
  await rig.setup('lsp-generics');
  rig.createFile('generics.ts', `
    class Container<T> {
      private value: T;
      getValue(): T { return this.value; }
    }
    const c = new Container<string>();
  `);
  
  const result = await rig.run('找到 Container 类的定义');
  expect(result).toContain('Container');
});
```

---

## Phase 5: 增量更新测试

### 5.1 文件修改后诊断更新
**文件:** `integration-tests/lsp-incremental.test.ts`

```typescript
it('应该在文件修改后更新诊断', async () => {
  await rig.setup('lsp-incremental-update');
  rig.createFile('test.ts', 'let x: number = 5;');
  
  // 第一次检查
  await rig.run('检查 test.ts 的错误');
  
  // 修改文件引入错误
  rig.createFile('test.ts', 'let x: number = "string";');
  
  // 再次检查，应该报告类型错误
  const result = await rig.run('再次检查 test.ts 的错误');
  expect(result).toMatch(/类型 | type|error/i);
});
```

### 5.2 保存后 LSP 刷新
**测试用例:**
```typescript
it('应该在保存后刷新 LSP 信息', async () => {
  await rig.setup('lsp-save-refresh');
  // 实现保存后刷新测试
});
```

---

## Phase 6: 特定功能深度测试

### 6.1 Code Actions 测试
**文件:** `integration-tests/lsp-code-actions.test.ts`

```typescript
it('应该提供快速修复建议', async () => {
  await rig.setup('lsp-code-action-quickfix');
  rig.createFile('test.ts', `let x: nubmer = 5;`); // 拼写错误
  
  const result = await rig.run('修复这个类型错误');
  
  // 验证提供了修复建议
  expect(result).toMatch(/number|修复|quick fix/i);
});

it('应该提供重构建议', async () => {
  await rig.setup('lsp-code-action-refactor');
  // 测试重构功能
});
```

### 6.2 Diagnostics 分类测试
**测试用例:**
```typescript
it('应该区分错误、警告和信息', async () => {
  await rig.setup('lsp-diagnostics-levels');
  rig.createFile('test.ts', `
    // @ts-ignore
    let unused: number = 5;
    let error: number = "string";
  `);
  
  const result = await rig.run('检查这个文件的诊断信息');
  
  // 验证区分了错误和警告
  expect(result).toMatch(/错误 | 警告 | error | warning/i);
});
```

---

## Phase 7: 真实项目测试

### 7.1 Gemini CLI 代码测试
**文件:** `integration-tests/lsp-real-project.test.ts`

```typescript
it('应该能在 Gemini CLI 代码上工作', async () => {
  await rig.setup('lsp-gemini-cli-project');
  
  // 使用项目实际文件
  const projectFile = join(process.cwd(), 'packages/core/src/index.ts');
  const result = await rig.run(`获取 ${projectFile} 的符号列表`);
  
  expect(result).toBeDefined();
  expect(result).toContain('export');
});
```

### 7.2 TypeScript 配置影响测试
**测试用例:**
```typescript
it('应该遵循 tsconfig.json 配置', async () => {
  await rig.setup('lsp-tsconfig');
  rig.createFile('tsconfig.json', JSON.stringify({
    compilerOptions: {
      strict: true,
      noImplicitAny: true
    }
  }));
  rig.createFile('test.ts', 'let x = getValue();'); // 隐式 any
  
  const result = await rig.run('检查类型错误');
  expect(result).toMatch(/any|隐式/i);
});
```

---

## 测试执行计划

### 优先级排序
**P0 (必须实现):**
1. Phase 1: 结果验证增强 - 基础质量保障
2. Phase 3: 错误处理 - 稳定性保障

**P1 (重要):**
3. Phase 2: 多文件场景 - 真实使用场景
4. Phase 6: 特定功能深度测试 - 功能完整性

**P2 (可选):**
5. Phase 4: 性能测试 - 性能保障
6. Phase 5: 增量更新 - 用户体验
7. Phase 7: 真实项目 - 最终验证

### 预估工作量
- **Phase 1:** 2-3 天
- **Phase 2:** 3-4 天
- **Phase 3:** 2 天
- **Phase 4:** 2 天
- **Phase 5:** 2 天
- **Phase 6:** 2-3 天
- **Phase 7:** 2 天

**总计:** 15-18 天

### 里程碑
- **M1:** Phase 1-3 完成 (基础测试框架) - 1 周
- **M2:** Phase 4-6 完成 (完整测试覆盖) - 2 周
- **M3:** Phase 7 完成 + 整体优化 - 2.5 周

---

## 注意事项

1. **测试隔离:** 每个测试使用独立的临时目录
2. **超时设置:** 根据测试复杂度设置合理超时 (30s-120s)
3. **错误恢复:** 确保测试失败后有清晰的错误信息
4. **可维护性:** 使用 helper 函数复用代码
5. **文档:** 为每个测试添加清晰的注释说明测试目的

## 后续优化

1. **测试数据生成器:** 创建可复用的测试 fixture 生成工具
2. **性能基准:** 建立 LSP 响应时间基准线
3. **CI 集成:** 将 LSP 测试集成到 CI 流程
4. **测试覆盖率报告:** 监控 LSP 功能测试覆盖率
