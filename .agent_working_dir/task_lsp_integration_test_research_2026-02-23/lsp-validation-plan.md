# LSP 工具调用结果验证方案

## 问题分析

**现状：** 当前测试只验证"是否调用了 lsp 工具"
```typescript
const hasLspCall = toolCalls.some(call => call.toolRequest.name === 'lsp');
expect(hasLspCall).toBe(true); // ❌ 这远远不够！
```

**问题：** 无法确认：
- LSP 服务器是否正确响应？
- 返回的位置信息是否准确？
- 找到的引用是否完整？
- 错误处理是否友好？

---

## LSP 工具返回格式分析

### 1. goToDefinition 返回格式

**源代码位置：** `packages/core/src/tools/lsp.ts:197-237`

```typescript
private async executeDefinitions(client: LspClient): Promise<ToolResult> {
  const target = this.resolveLocationTarget();
  if ('error' in target) {
    return { llmContent: target.error, returnDisplay: target.error };
  }

  let definitions: LspDefinition[] = [];
  try {
    definitions = await client.definitions(target.location, ...);
  } catch (error) {
    const message = `LSP go-to-definition failed: ${error.message}`;
    return { llmContent: message, returnDisplay: message };
  }

  if (!definitions.length) {
    return { 
      llmContent: `No definitions found for ${target.description}.`,
      returnDisplay: `No definitions found for ${target.description}.`
    };
  }

  const lines = definitions.map((definition, index) =>
    `${index + 1}. ${this.formatLocationWithServer(definition, workspaceRoot)}`
  );
  
  return {
    llmContent: [`Definitions for ${target.description}:`, ...lines].join('\n'),
    returnDisplay: lines.join('\n')
  };
}
```

**返回格式示例：**
```
1. /path/to/file.ts:27:14 (typescript)
2. /path/to/other.ts:15:7 (typescript)
```

**验证点：**
1. ✅ 返回内容包含文件路径
2. ✅ 返回内容包含行号（格式 `:数字:`）
3. ✅ 返回内容包含列号
4. ✅ 文件路径存在于项目中
5. ✅ 行号在合理范围内（> 0）
6. ✅ 包含正确的语言标识（如 `typescript`）

---

### 2. findReferences 返回格式

**源代码位置：** `packages/core/src/tools/lsp.ts:279-320`

```typescript
private async executeReferences(client: LspClient): Promise<ToolResult> {
  let references: LspReference[] = [];
  try {
    references = await client.references(target.location, ..., includeDeclaration, limit);
  } catch (error) {
    return { llmContent: `LSP find-references failed: ${error.message}`, ... };
  }

  if (!references.length) {
    return { llmContent: `No references found for ${target.description}.`, ... };
  }

  const lines = references.map((reference, index) =>
    `${index + 1}. ${this.formatLocationWithServer(reference, workspaceRoot)}`
  );
  
  return {
    llmContent: [`References for ${target.description}:`, ...lines].join('\n'),
    returnDisplay: lines.join('\n')
  };
}
```

**验证点：**
1. ✅ 引用数量 >= 预期最小值（如 Calculator 至少 3 个引用）
2. ✅ 每个引用都包含文件路径 + 行号 + 列号
3. ✅ 包含声明位置（如果 includeDeclaration=true）
4. ✅ 所有文件路径都有效
5. ✅ 没有重复的引用位置

---

### 3. hover 返回格式

**源代码位置：** `packages/core/src/tools/lsp.ts:321-355`

```typescript
private async executeHover(client: LspClient): Promise<ToolResult> {
  let hoverText = '';
  try {
    const result = await client.hover(target.location, ...);
    if (result) {
      hoverText = result.contents ?? '';
    }
  } catch (error) {
    return { llmContent: `LSP hover failed: ${error.message}`, ... };
  }

  if (!hoverText || hoverText.trim().length === 0) {
    return { llmContent: `No hover information found for ${target.description}.`, ... };
  }

  return {
    llmContent: [`Hover for ${target.description}:`, hoverText.trim()].join('\n'),
    returnDisplay: hoverText.trim()
  };
}
```

**验证点：**
1. ✅ 返回类型信息（如 `number`, `string`, `(n: number): void`）
2. ✅ 包含函数/变量名称
3. ✅ 包含文档注释（如果有）
4. ✅ 格式符合 TypeScript 签名规范

---

### 4. documentSymbol 返回格式

**源代码位置：** `packages/core/src/tools/lsp.ts:356-536`

```typescript
private async executeDocumentSymbols(client: LspClient): Promise<ToolResult> {
  let symbols: LspSymbolInformation[] = [];
  try {
    symbols = await client.documentSymbols(filePath, ...);
  } catch (error) {
    return { llmContent: `LSP documentSymbols failed: ${error.message}`, ... };
  }

  const formattedSymbols = symbols.map((symbol, index) => {
    const icon = this.getSymbolIcon(symbol.kind);
    const range = `${symbol.range.start.line}:${symbol.range.start.character}`;
    return `${index + 1}. ${icon} ${symbol.name} [${symbol.kind}] (${range})`;
  });

  return {
    llmContent: [`Symbols in ${filePath}:`, ...formattedSymbols].join('\n'),
    returnDisplay: formattedSymbols.join('\n')
  };
}
```

**返回格式示例：**
```
Symbols in /path/to/file.ts:
1. 🅲 Calculator [Class] (26:0)
2. 🅼 add [Method] (33:2)
3. 🅼 getValue [Method] (37:2)
4. 🅵 calculateSum [Function] (42:0)
```

**验证点：**
1. ✅ 符号数量与文件实际内容匹配
2. ✅ 每个符号包含正确的类型图标
3. ✅ 符号名称与源代码一致
4. ✅ 位置信息准确（行号、列号）
5. ✅ 符号分类正确（Class/Method/Function/Variable）

---

## 验证工具调用结果的测试方案

### 方案 1：解析 ToolResult 返回内容

**核心思路：** 通过 `readToolLogs()` 获取工具调用的详细参数和结果

```typescript
// 工具日志包含完整信息
const toolLogs = rig.readToolLogs();
const lspCall = toolLogs.find(log => log.toolRequest.name === 'lsp');

// 验证请求参数
expect(lspCall.toolRequest.args).toContain('goToDefinition');
expect(lspCall.toolRequest.args).toContain('lsp-test.ts');

// 验证返回结果（如果工具日志包含返回内容）
// 注意：目前 readToolLogs() 主要记录请求参数，不直接包含返回内容
```

**问题：** 当前 `readToolLogs()` 只记录请求参数，不记录返回内容

---

### 方案 2：验证 CLI 输出内容（推荐）

**核心思路：** CLI 会将 ToolResult 的 `returnDisplay` 输出到控制台，通过验证输出内容来确认结果正确性

```typescript
it('应该能找到类定义并验证返回位置', async () => {
  await rig.setup('lsp-goToDefinition-verify');
  createFixtures();
  
  const result = await rig.run('找到 Calculator 类的定义位置');
  
  // 1. 验证工具被调用
  expect(await rig.waitForToolCall('lsp')).toBe(true);
  
  // 2. 验证输出包含文件路径
  expect(result).toContain('lsp-test.ts');
  
  // 3. 验证输出包含行号（格式 :数字:）
  expect(result).toMatch(/:\d+:\d+/);
  
  // 4. 验证输出包含语言标识
  expect(result).toContain('typescript');
  
  // 5. 验证输出包含 Calculator 类名
  expect(result).toContain('Calculator');
  
  // 6. 验证找到了定义（不是"not found"）
  expect(result).not.toMatch(/not found|undefined|no definitions/i);
});
```

---

### 方案 3：使用详细输出模式

**核心思路：** 通过 `VERBOSE=true` 或 `KEEP_OUTPUT=true` 获取更详细的输出

```typescript
// 在测试中启用详细输出
const result = await rig.run({
  args: '找到 Calculator 类的定义位置',
  env: { VERBOSE: 'true' }
});

// 验证详细输出包含预期信息
expect(result).toMatch(/Definitions for.*Calculator/);
expect(result).toContain('lsp-test.ts');
expect(result).toMatch(/\d+\.\s+\S+\.ts:\d+:\d+/); // 匹配 "1. xxx.ts:27:14"
```

---

### 方案 4：修改 LSP 工具输出格式（长期方案）

**核心思路：** 增强 LSP 工具的返回格式，使其更易于测试验证

**当前输出：**
```
1. /path/to/file.ts:27:14 (typescript)
```

**增强输出（添加结构化标记）：**
```
[DEFINITION_RESULT]
- symbol: Calculator
- file: lsp-test.ts
- line: 27
- column: 14
- language: typescript
[/DEFINITION_RESULT]
```

**测试验证：**
```typescript
it('应该返回结构化的定义结果', async () => {
  const result = await rig.run('找到 Calculator 类的定义位置');
  
  expect(result).toContain('[DEFINITION_RESULT]');
  expect(result).toContain('symbol: Calculator');
  expect(result).toContain('file: lsp-test.ts');
  expect(result).toMatch(/line:\s*27/);
  expect(result).toMatch(/column:\s*14/);
});
```

**优点：** 验证更可靠，不易受格式变化影响
**缺点：** 需要修改 LSP 工具代码

---

## 完整的测试验证代码示例

### 示例 1: goToDefinition 结果验证

```typescript
describe('goToDefinition', () => {
  it('应该能找到类定义并验证返回位置', async () => {
    await rig.setup('lsp-goToDefinition-verify');
    const fixturePath = createFixtures();
    
    const result = await rig.run('找到 Calculator 类的定义位置');
    
    // === 验证层级 1: 工具调用 ===
    expect(await rig.waitForToolCall('lsp')).toBe(true);
    const toolLogs = rig.readToolLogs();
    const lspCall = toolLogs.find(log => log.toolRequest.name === 'lsp');
    expect(lspCall.toolRequest.args).toContain('goToDefinition');
    
    // === 验证层级 2: 返回格式 ===
    expect(result).toContain('lsp-test.ts');
    expect(result).toMatch(/:\d+:\d+/); // 行号：列号格式
    expect(result).toContain('typescript');
    
    // === 验证层级 3: 内容正确性 ===
    expect(result).toContain('Calculator');
    expect(result).not.toMatch(/not found|error|failed/i);
    
    // === 验证层级 4: 语义验证（可选）===
    // 提取行号并验证在合理范围内
    const lineMatch = result.match(/lsp-test\.ts:(\d+):(\d+)/);
    if (lineMatch) {
      const line = parseInt(lineMatch[1], 10);
      const column = parseInt(lineMatch[2], 10);
      expect(line).toBeGreaterThan(0);
      expect(column).toBeGreaterThan(0);
      expect(line).toBeLessThan(100); // fixture 文件不超过 100 行
    }
  });

  it('应该能找到函数定义并验证行号准确性', async () => {
    await rig.setup('lsp-findFunction');
    createFixtures();
    
    const result = await rig.run('找到 main 函数的定义');
    
    // main 函数在第 52 行附近
    expect(result).toMatch(/:\s*5[0-4]\s*:/);
    expect(result).toContain('main');
  });
});
```

---

### 示例 2: findReferences 完整性验证

```typescript
describe('findReferences', () => {
  it('应该找到所有引用并验证数量', async () => {
    await rig.setup('lsp-findReferences-count');
    createFixtures();
    
    const result = await rig.run('找到 Calculator 类的所有引用');
    
    // === 验证引用数量 ===
    // fixture 中 Calculator 至少有：
    // 1. 类定义 (行 26)
    // 2. 继承 (行 42)
    // 3. 实例化 (行 53)
    // 4. 实例化 (行 57)
    const referenceMatches = result.match(/Calculator/g) || [];
    expect(referenceMatches.length).toBeGreaterThanOrEqual(4);
    
    // === 验证引用格式 ===
    const referenceLines = result.split('\n')
      .filter(line => /^\d+\.\s+/.test(line.trim()));
    expect(referenceLines.length).toBeGreaterThanOrEqual(4);
    
    // === 验证每个引用都包含位置信息 ===
    for (const line of referenceLines) {
      expect(line).toMatch(/\.ts:\d+:\d+/);
    }
  });

  it('应该包含声明位置（如果 includeDeclaration）', async () => {
    await rig.setup('lsp-findReferences-with-declaration');
    createFixtures();
    
    const result = await rig.run('找到 Calculator 的所有引用，包括声明');
    
    // 验证包含声明（类定义行）
    expect(result).toMatch(/:\s*26\s*:/); // Calculator 类定义在 26 行
  });
});
```

---

### 示例 3: hover 信息准确性验证

```typescript
describe('hover', () => {
  it('应该显示准确的类型信息', async () => {
    await rig.setup('lsp-hover-type');
    createFixtures();
    
    const result = await rig.run('查看 getValue 函数的悬停信息');
    
    // === 验证返回类型 ===
    expect(result).toContain('number');
    expect(result).toMatch(/getValue.*:\s*number/i);
    
    // === 验证函数签名 ===
    expect(result).toMatch(/getValue\s*\(\s*\)/); // getValue()
    
    // === 验证不包含错误信息 ===
    expect(result).not.toMatch(/error|failed|not found/i);
  });

  it('应该显示参数的类型信息', async () => {
    await rig.setup('lsp-hover-parameter');
    createFixtures();
    
    const result = await rig.run('查看 add 函数的参数类型');
    
    // add(n: number): void
    expect(result).toContain('n');
    expect(result).toContain('number');
  });
});
```

---

### 示例 4: documentSymbol 完整性验证

```typescript
describe('documentSymbol', () => {
  it('应该列出所有符号', async () => {
    await rig.setup('lsp-documentSymbol-all');
    createFixtures();
    
    const result = await rig.run('列出 lsp-test.ts 中的所有符号');
    
    // === 验证包含所有主要符号 ===
    expect(result).toContain('Calculator');
    expect(result).toContain('ScientificCalculator');
    expect(result).toContain('calculateSum');
    expect(result).toContain('main');
    
    // === 验证符号类型标识 ===
    expect(result).toMatch(/\[Class\]/);
    expect(result).toMatch(/\[Method\]/);
    expect(result).toMatch(/\[Function\]/);
    
    // === 验证位置信息 ===
    expect(result).toMatch(/\(\d+:\d+\)/); // (line:column)
  });
});
```

---

## 验证错误处理

### 文件不存在错误

```typescript
it('应该友好处理不存在的文件', async () => {
  await rig.setup('lsp-file-not-found');
  
  const result = await rig.run('打开不存在的文件并获取定义');
  
  // === 验证有友好的错误提示 ===
  expect(result).toMatch(/不存在 | 找不到 | 无法打开|does not exist|not found/i);
  
  // === 验证没有崩溃 ===
  expect(result).not.toMatch(/崩溃 | 异常|crash|unhandled|exception/i);
  
  // === 验证工具仍然被调用（但最终返回错误） ===
  expect(await rig.waitForToolCall('lsp')).toBe(true);
});
```

### 语法错误文件诊断

```typescript
it('应该报告语法错误', async () => {
  await rig.setup('lsp-syntax-error');
  rig.createFile('broken.ts', 'class Broken { invalid syntax here }');
  
  const result = await rig.run('检查 broken.ts 的错误');
  
  // === 验证报告了错误 ===
  expect(result).toMatch(/错误|error|syntax|invalid/i);
  
  // === 验证错误包含位置信息 ===
  expect(result).toMatch(/:\d+:\d+/);
});
```

---

## 总结

### 验证层级（从浅到深）

| 层级 | 验证内容 | 可靠性 | 实现成本 |
|------|---------|--------|---------|
| 1 | 工具是否被调用 | ⭐⭐ | 低 |
| 2 | 返回格式是否正确 | ⭐⭐⭐ | 低 |
| 3 | 返回内容是否准确 | ⭐⭐⭐⭐ | 中 |
| 4 | 语义是否正确 | ⭐⭐⭐⭐⭐ | 高 |

### 推荐方案

**组合使用方案 2+3：**
1. 验证 CLI 输出内容（方案 2）
2. 使用详细输出模式（方案 3）
3. 长期考虑增强 LSP 输出格式（方案 4）

### 关键验证点

1. **文件路径** - 验证返回的文件存在于项目中
2. **位置信息** - 验证行号、列号在合理范围内
3. **符号名称** - 验证返回的符号名称与源代码一致
4. **错误处理** - 验证错误场景有友好的提示
5. **完整性** - 验证返回的结果数量符合预期

---

## 下一步行动

1. **修改现有测试** - 为所有 LSP 测试添加结果验证
2. **创建测试工具函数** - 封装常用的验证逻辑
3. **增强 LSP 输出** - 考虑添加结构化标记
4. **建立验证基准** - 定义每个测试的预期输出格式

```