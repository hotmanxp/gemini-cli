# LSP 分析工具使用指南

## 概述

LSP 分析工具（`lsp_analysis`）是一个专门为 agent 设计的代码分析工具，允许 agent 根据需要调用 LSP 功能进行代码分析。

## 工具信息

- **工具名称**: `lsp_analysis`
- **显示名称**: LSP 代码分析
- **描述**: 使用 Language Server Protocol 进行代码分析，支持符号查找、引用分析、诊断检查等功能

## 支持的操作

### 1. analyzeSymbol - 符号分析

分析指定位置的符号，包括定义和引用。

**参数:**
- `operation`: `"analyzeSymbol"`
- `filePath`: 文件路径
- `line`: 行号 (1-based)
- `character`: 列号 (1-based)
- `limit`: 最大结果数量 (可选，默认 20)

**示例:**
```json
{
  "operation": "analyzeSymbol",
  "filePath": "src/index.ts",
  "line": 10,
  "character": 5
}
```

**输出:**
```markdown
符号分析：src/index.ts:10:5

## 定义
1. src/types.ts:5:10

## 引用
1. src/utils.ts:15:8
2. src/service.ts:20:12
```

### 2. findImplementations - 查找实现

查找接口或抽象方法的实现。

**参数:**
- `operation`: `"findImplementations"`
- `filePath`: 文件路径
- `line`: 行号
- `character`: 列号
- `limit`: 最大结果数量 (可选)

**示例:**
```json
{
  "operation": "findImplementations",
  "filePath": "src/interfaces.ts",
  "line": 20,
  "character": 10
}
```

### 3. getCodeDiagnostics - 获取代码诊断

获取文件的诊断信息（错误、警告等）。

**参数:**
- `operation`: `"getCodeDiagnostics"`
- `filePath`: 文件路径

**示例:**
```json
{
  "operation": "getCodeDiagnostics",
  "filePath": "src/utils.ts"
}
```

**输出:**
```markdown
代码诊断：src/utils.ts

[ERROR] 15:5 - Type 'string' is not assignable to type 'number'.
[WARNING] 20:10 - Variable 'unused' is declared but never used.
```

### 4. searchSymbols - 符号搜索

在工作区中搜索符号。

**参数:**
- `operation`: `"searchSymbols"`
- `filePath`: `"."` (工作区根目录)
- `query`: 搜索查询
- `limit`: 最大结果数量 (可选)

**示例:**
```json
{
  "operation": "searchSymbols",
  "filePath": ".",
  "query": "UserService"
}
```

**输出:**
```markdown
符号搜索："UserService"

1. UserService (src/services/user.ts) - class
2. IUserService (src/interfaces/user.ts) - interface
3. UserServiceImpl (src/services/user-impl.ts) - class
```

### 5. analyzeCallHierarchy - 调用层次分析

分析函数的调用层次（入向和出向调用）。

**参数:**
- `operation`: `"analyzeCallHierarchy"`
- `filePath`: 文件路径
- `line`: 行号
- `character`: 列号
- `limit`: 最大结果数量 (可选)

**示例:**
```json
{
  "operation": "analyzeCallHierarchy",
  "filePath": "src/utils.ts",
  "line": 25,
  "character": 10
}
```

**输出:**
```markdown
调用层次分析：src/utils.ts:25:10

## processData
类型：function
文件：src/utils.ts

## 入向调用（谁调用了这个函数）
1. handleRequest
2. processBatch

## 出向调用（这个函数调用了谁）
1. validateInput
2. transformData
```

### 6. getHoverInfo - 获取悬停信息

获取指定位置的悬停信息（类型、文档等）。

**参数:**
- `operation`: `"getHoverInfo"`
- `filePath`: 文件路径
- `line`: 行号
- `character`: 列号

**示例:**
```json
{
  "operation": "getHoverInfo",
  "filePath": "src/index.ts",
  "line": 10,
  "character": 5
}
```

### 7. getDocumentSymbols - 获取文档符号

获取文档中的所有符号。

**参数:**
- `operation`: `"getDocumentSymbols"`
- `filePath`: 文件路径
- `limit`: 最大结果数量 (可选)

**示例:**
```json
{
  "operation": "getDocumentSymbols",
  "filePath": "src/index.ts"
}
```

**输出:**
```markdown
文档符号：src/index.ts

1. App - class
2. AppConfig - interface
3. createApp - function
4. DEFAULT_CONFIG - constant
```

## 在 planning-with-files 中使用

### 场景 1: 代码理解

当 agent 需要理解代码库结构时：

```
用户：帮我分析这个项目的架构

Agent 思考：我需要使用 LSP 工具来分析代码结构
1. 首先搜索主要符号
2. 然后分析关键类的引用
3. 检查代码诊断
```

### 场景 2: 代码重构

当 agent 需要进行代码重构时：

```
用户：帮我重构这个函数

Agent 思考：我需要先分析函数的使用情况
1. 使用 analyzeSymbol 查找定义和引用
2. 使用 analyzeCallHierarchy 了解调用关系
3. 使用 getCodeDiagnostics 检查潜在问题
```

### 场景 3: 问题排查

当 agent 需要排查代码问题时：

```
用户：这段代码为什么报错？

Agent 思考：我需要检查代码诊断
1. 使用 getCodeDiagnostics 获取错误信息
2. 使用 getHoverInfo 查看类型信息
3. 使用 analyzeSymbol 分析相关符号
```

## 最佳实践

1. **先分析后操作**: 在进行代码修改前，先使用 LSP 工具分析代码结构
2. **批量分析**: 对于复杂的代码变更，使用多个 LSP 操作获取全面信息
3. **错误处理**: 注意处理 LSP 工具返回的错误信息
4. **结果限制**: 使用 `limit` 参数避免返回过多结果

## 错误处理

工具可能返回以下错误：

- `LSP 分析工具不可用（LSP 未启用或未初始化）` - LSP 服务未启动
- `错误：需要提供文件路径` - 缺少必需的 filePath 参数
- `错误：需要提供行号` - 某些操作需要 line 参数
- `错误：需要提供搜索查询` - searchSymbols 需要 query 参数
- `LSP 分析失败：[错误信息]` - LSP 操作执行失败

## 注意事项

1. LSP 工具需要 LSP 服务器已启动并初始化
2. 文件路径可以是绝对路径或相对于工作区的路径
3. 行号和列号都是 1-based（从 1 开始计数）
4. 某些操作（如 analyzeCallHierarchy）可能需要较长时间执行
