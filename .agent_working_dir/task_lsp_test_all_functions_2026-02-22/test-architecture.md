# LSP 集成测试架构设计

## 测试文件结构

```
packages/core/src/tools/lsp.test.ts (新建)
├── describe('LSP Tool Integration')
│   ├── describe('goToDefinition')
│   ├── describe('findReferences')
│   ├── describe('hover')
│   ├── describe('documentSymbol')
│   ├── describe('workspaceSymbol')
│   ├── describe('goToImplementation')
│   ├── describe('prepareCallHierarchy')
│   ├── describe('incomingCalls')
│   ├── describe('outgoingCalls')
│   ├── describe('diagnostics')
│   ├── describe('workspaceDiagnostics')
│   └── describe('codeActions')
```

## 测试 Fixtures 设计

### TypeScript Test Fixtures

创建测试专用的 TypeScript 代码文件用于 LSP 测试：

```typescript
// fixtures/typescript/sample.ts
// 用于测试定义、引用、hover 等功能的示例代码

// 一个简单的类，用于测试 goToDefinition
export class Calculator {
  private value: number = 0;

  add(n: number): void {
    this.value += n;
  }

  getValue(): number {
    return this.value;
  }
}

// 测试继承
export class ScientificCalculator extends Calculator {
  multiply(n: number): void {
    this.value *= n;
  }
}

// 测试函数调用
export function main(): void {
  const calc = new Calculator();
  calc.add(5);
  console.log(calc.getValue());
}
```

### Python Test Fixtures

```python
# fixtures/python/sample.py
# 用于测试 Python LSP 功能的示例代码

class Calculator:
    def __init__(self):
        self.value = 0

    def add(self, n: int) -> None:
        self.value += n

    def get_value(self) -> int:
        return self.value

def main():
    calc = Calculator()
    calc.add(5)
    print(calc.get_value())
```

## Mock 策略

### 使用真实的 LSP 服务器

集成测试应该启动真实的 LSP 服务器（如 typescript-language-server）来获取真实响应。

### Mock LspClient（用于单元测试）

```typescript
const createMockLspClient = () => ({
  goToDefinition: vi.fn().mockResolvedValue([
    {
      uri: 'file:///test.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } }
    }
  ]),
  findReferences: vi.fn().mockResolvedValue([...]),
  hover: vi.fn().mockResolvedValue({ contents: { value: 'test' } }),
  // ... 其他方法
});
```

## 测试模式

### 1. 位置相关操作测试模式

```typescript
describe('goToDefinition', () => {
  it('should find definition of a class', async () => {
    const result = await lspTool.execute({
      operation: 'goToDefinition',
      filePath: 'fixtures/typescript/sample.ts',
      line: 10, // 指向 Calculator 使用处
      character: 20,
    });

    expect(result).toBeDefined();
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0].uri).toContain('Calculator');
  });
});
```

### 2. 文件相关操作测试模式

```typescript
describe('documentSymbol', () => {
  it('should list all symbols in file', async () => {
    const result = await lspTool.execute({
      operation: 'documentSymbol',
      filePath: 'fixtures/typescript/sample.ts',
    });

    expect(result.symbols).toBeDefined();
    expect(result.symbols.length).toBeGreaterThan(0);
  });
});
```

### 3. 工作空间操作测试模式

```typescript
describe('workspaceSymbol', () => {
  it('should search for symbols across workspace', async () => {
    const result = await lspTool.execute({
      operation: 'workspaceSymbol',
      query: 'Calculator',
    });

    expect(result.symbols).toBeDefined();
    expect(result.symbols.some((s) => s.name.includes('Calculator'))).toBe(
      true,
    );
  });
});
```

### 4. 调用层级测试模式

```typescript
describe('callHierarchy', () => {
  it('should find incoming calls', async () => {
    // 先 prepare
    const prepareResult = await lspTool.execute({
      operation: 'prepareCallHierarchy',
      filePath: 'fixtures/typescript/sample.ts',
      line: 5,
      character: 10,
    });

    // 再查询 incoming
    const incomingResult = await lspTool.execute({
      operation: 'incomingCalls',
      callHierarchyItem: prepareResult.item,
    });

    expect(incomingResult.calls).toBeDefined();
  });
});
```

## 测试覆盖清单

| 操作                 | 正常路径   | 边界情况     | 错误处理   |
| -------------------- | ---------- | ------------ | ---------- |
| goToDefinition       | ✓ 找到定义 | ✗ 找不到定义 | ✗ 无效文件 |
| findReferences       | ✓ 找到引用 | ✗ 无引用     | ✗ 无效位置 |
| hover                | ✓ 有文档   | ✗ 无文档     | -          |
| documentSymbol       | ✓ 有符号   | ✗ 空文件     | ✗ 无效文件 |
| workspaceSymbol      | ✓ 找到符号 | ✗ 无匹配     | -          |
| goToImplementation   | ✓ 找到实现 | ✗ 无实现     | -          |
| prepareCallHierarchy | ✓ 可准备   | ✗ 不支持     | -          |
| incomingCalls        | ✓ 有调用   | ✗ 无调用     | -          |
| outgoingCalls        | ✓ 有调用出 | ✗ 无调用出   | -          |
| diagnostics          | ✓ 有错误   | ✗ 无错误     | ✗ 无效文件 |
| workspaceDiagnostics | ✓ 有诊断   | ✗ 无诊断     | -          |
| codeActions          | ✓ 有操作   | ✗ 无操作     | -          |

## 实施步骤

1. **创建测试 fixtures 目录和示例文件**
2. **创建 lsp.test.ts 测试文件**
3. **为每个 LSP 操作编写测试用例**
4. **运行测试并验证**
5. **记录测试结果**
