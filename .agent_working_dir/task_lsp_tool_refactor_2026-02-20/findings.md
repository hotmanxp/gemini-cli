# LSP 工具重构调研发现

## 现有代码分析

### 1. planning-with-files 技能结构
- 位置：`/Users/ethan/.qwen/skills/planning-with-files/`
- 这是一个 Qwen Code 技能，提供文件-based 的任务规划能力
- 主要功能：
  - 创建 task_plan.md、findings.md、progress.md 三个规划文件
  - 实现 Manus 风格的持久化工作记忆
  - 提供任务阶段跟踪和错误记录

### 2. 现有 LSP 工具分析
- 位置：`/Users/ethan/code/gemini-cli/packages/core/src/tools/lsp.ts`
- 已经有一个统一的 LSP 工具实现
- 支持的操作：
  - goToDefinition - 跳转到定义
  - findReferences - 查找引用
  - hover - 悬停信息
  - documentSymbol - 文档符号
  - workspaceSymbol - 工作区符号
  - goToImplementation - 跳转到实现
  - prepareCallHierarchy - 准备调用层次
  - incomingCalls - 入向调用
  - outgoingCalls - 出向调用
  - diagnostics - 诊断信息
  - workspaceDiagnostics - 工作区诊断
  - codeActions - 代码操作

### 3. LSP 工具参数接口
```typescript
interface LspToolParams {
  operation: LspOperation;
  filePath?: string;
  line?: number;
  character?: number;
  endLine?: number;
  endCharacter?: number;
  includeDeclaration?: boolean;
  query?: string;
  callHierarchyItem?: LspCallHierarchyItem;
  serverName?: string;
  limit?: number;
  diagnostics?: LspDiagnostic[];
  codeActionKinds?: LspCodeActionKind[];
}
```

### 4. 需要重构的点

#### 当前问题
1. LSP 工具已经存在，但 planning-with-files 技能没有直接使用
2. 需要将 LSP 工具与 planning-with-files 技能解耦
3. 允许 agent 根据需要自主调用 LSP 工具

#### 重构目标
1. 保持现有 LSP 工具不变
2. 在 planning-with-files 中添加 LSP 工具调用能力
3. 提供简化的 LSP 分析接口
4. 支持代码分析场景：
   - 代码理解（跳转定义、查找引用）
   - 代码质量检查（诊断信息）
   - 代码导航（符号搜索）
   - 调用层次分析

## 设计方案

### LspAnalysisTool 设计
创建一个简化的 LSP 分析工具，专注于代码分析场景：

```typescript
class LspAnalysisTool extends BaseDeclarativeTool {
  // 简化的操作集合
  type LspAnalysisOperation = 
    | 'analyzeSymbol'      // 分析符号（定义 + 引用）
    | 'findImplementations' // 查找实现
    | 'getCodeDiagnostics' // 获取代码诊断
    | 'searchSymbols'       // 搜索符号
    | 'analyzeCallHierarchy' // 分析调用层次
  
  // 简化的参数
  interface LspAnalysisParams {
    operation: LspAnalysisOperation;
    filePath: string;
    symbolName?: string;
    line?: number;
    character?: number;
    query?: string;
  }
}
```

### 集成方式
1. 在 planning-with-files 的 agent 中注册 LSP 工具
2. 提供工具调用的示例和文档
3. 允许 agent 在分析代码时自主调用

## 下一步
1. 实现 LspAnalysisTool 类
2. 在 planning-with-files 中集成
3. 测试工具调用流程
