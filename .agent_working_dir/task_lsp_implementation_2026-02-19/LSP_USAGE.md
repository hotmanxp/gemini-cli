# LSP 功能使用文档

## 概述

Gemini CLI 现在支持 Language Server Protocol (LSP)，可以为多种编程语言提供智能代码补全、跳转定义、查找引用、悬停信息和诊断信息等功能。

## 支持的语言

| 语言 | LSP Server | 安装方式 |
|------|-----------|---------|
| TypeScript/JavaScript | typescript-language-server | `npm install -g typescript-language-server typescript` |
| Python | pyright | `npm install -g pyright` |
| Java | jdtls | 下载 [eclipse.jdt.ls](https://projects.eclipse.org/projects/eclipse.jdt.ls) |
| Go | gopls | `go install golang.org/x/tools/gopls@latest` |
| Rust | rust-analyzer | `rustup component add rust-analyzer` |

## 命令列表

### 1. 启动 LSP 服务器

```bash
# 启动特定语言的 LSP 服务器
gemini lsp start <language>

# 示例
gemini lsp start typescript
gemini lsp start python
gemini lsp start go
```

**选项:**
- `-w, --workspace <dir>`: 指定工作目录（默认：当前目录）

### 2. 查看状态

```bash
# 查看所有 LSP 服务器状态
gemini lsp status
```

**输出示例:**
```
LSP Server Status
--------------------
No LSP servers currently running

Supported languages:
  - typescript: typescript-language-server
  - python: pyright
  - java: jdtls
  - go: gopls
  - rust: rust-analyzer
```

### 3. 停止 LSP 服务器

```bash
# 停止特定语言的 LSP 服务器
gemini lsp stop <language>

# 停止所有 LSP 服务器
gemini lsp stop --all
# 或
gemini lsp stop
```

### 4. 代码补全

```bash
# 获取代码补全建议
gemini lsp completion <file> -l <line> -c <column>

# 示例：获取 src/index.ts 第 10 行第 5 列的补全
gemini lsp completion src/index.ts -l 10 -c 5
```

**选项:**
- `-l, --line <n>`: 行号（从 0 开始，默认：0）
- `-c, --column <n>`: 列号（从 0 开始，默认：0）
- `-w, --workspace <dir>`: 工作目录

**输出示例:**
```
Completions at line 10, column 5:
──────────────────────────────────────────────────
  [3] useState - import { useState }
  [3] useEffect - import { useEffect }
  [3] useCallback - import { useCallback }
  ... and 7 more
```

### 5. 跳转定义

```bash
# 跳转到符号定义
gemini lsp definition <file> -l <line> -c <column>

# 别名
gemini lsp def <file> -l <line> -c <column>
gemini lsp goto <file> -l <line> -c <column>
```

**选项:**
- `-l, --line <n>`: 行号（从 0 开始，默认：0）
- `-c, --column <n>`: 列号（从 0 开始，默认：0）
- `-w, --workspace <dir>`: 工作目录

**输出示例:**
```
Definitions at line 10, column 5:
──────────────────────────────────────────────────
  📍 src/utils/helper.ts
     Line 25, Column 0
```

### 6. 查找引用

```bash
# 查找符号的所有引用
gemini lsp references <file> -l <line> -c <column>

# 别名
gemini lsp refs <file> -l <line> -c <column>
```

**选项:**
- `-l, --line <n>`: 行号（从 0 开始，默认：0）
- `-c, --column <n>`: 列号（从 0 开始，默认：0）
- `-w, --workspace <dir>`: 工作目录
- `-d, --include-declaration`: 包含声明（默认：true）

**输出示例:**
```
References at line 25, column 0:
──────────────────────────────────────────────────

  📄 src/utils/helper.ts:
     Line 25, Column 0

  📄 src/index.ts:
     Line 5, Column 9
     Line 12, Column 2

Total: 3 reference(s)
```

### 7. 悬停信息

```bash
# 获取悬停信息（类型、文档等）
gemini lsp hover <file> -l <line> -c <column>
```

**选项:**
- `-l, --line <n>`: 行号（从 0 开始，默认：0）
- `-c, --column <n>`: 列号（从 0 开始，默认：0）
- `-w, --workspace <dir>`: 工作目录

**输出示例:**
```
Hover information at line 10, column 5:
──────────────────────────────────────────────────
function useState<T>(initialState: T): [T, (newState: T) => void]

Returns a stateful value and a function to update it.
```

### 8. 诊断信息

```bash
# 获取诊断信息（错误、警告等）
gemini lsp diagnostics <file>

# 别名
gemini lsp diag <file>
gemini lsp errors <file>
```

**选项:**
- `-w, --workspace <dir>`: 工作目录

**输出示例:**
```
Diagnostics for src/index.ts:
──────────────────────────────────────────────────

❌ Errors (1):
   10:5 - Cannot find name 'undeclaredVar'.

⚠️  Warnings (2):
   5:0 - 'React' is defined but never used.
   15:10 - Missing return type.

Total: 3 issue(s)
```

## 使用流程示例

### TypeScript 项目

```bash
# 1. 确保安装了 LSP server
npm install -g typescript-language-server typescript

# 2. 在项目根目录启动 LSP 服务器
cd /path/to/typescript-project
gemini lsp start typescript

# 3. 查看状态
gemini lsp status

# 4. 获取代码补全
gemini lsp completion src/index.ts -l 10 -c 5

# 5. 查看诊断信息
gemini lsp diagnostics src/index.ts

# 6. 完成后停止服务器
gemini lsp stop --all
```

### Python 项目

```bash
# 1. 安装 LSP server
npm install -g pyright

# 2. 启动 LSP 服务器
cd /path/to/python-project
gemini lsp start python

# 3. 获取函数定义
gemini lsp definition src/main.py -l 20 -c 10

# 4. 查找引用
gemini lsp references src/main.py -l 20 -c 10

# 5. 查看错误和警告
gemini lsp diagnostics src/main.py
```

### Go 项目

```bash
# 1. 安装 LSP server
go install golang.org/x/tools/gopls@latest

# 2. 启动 LSP 服务器
cd /path/to/go-project
gemini lsp start go

# 3. 获取悬停信息
gemini lsp hover main.go -l 15 -c 5

# 4. 跳转定义
gemini lsp def main.go -l 15 -c 5
```

## 注意事项

1. **LSP Server 安装**: 使用前请确保已安装对应语言的 LSP 服务器
2. **项目根目录**: 建议在项目根目录下启动 LSP 服务器以获得最佳效果
3. **资源占用**: 每个 LSP 服务器会占用一定的系统资源，使用完毕后请及时停止
4. **文件路径**: 所有命令中的文件路径应为绝对路径或相对于当前工作目录的路径
5. **行/列号**: 行号和列号均从 0 开始计数

## 故障排除

### LSP 服务器无法启动

1. 确认 LSP server 已正确安装
2. 检查 LSP server 是否在 PATH 中
3. 查看错误日志：使用 `--debug` 模式运行

```bash
gemini --debug lsp start typescript
```

### 补全/定义等功能无响应

1. 确认 LSP 服务器正在运行：`gemini lsp status`
2. 确认文件路径正确
3. 等待 LSP 服务器初始化完成（可能需要几秒）

### 诊断信息不准确

1. 确保在项目根目录下运行
2. 检查语言的配置文件（如 tsconfig.json, pyproject.toml 等）
3. 尝试重启 LSP 服务器

## 技术细节

- **LSP 协议版本**: 3.17
- **通信方式**: JSON-RPC 2.0 over stdio
- **支持的请求类型**:
  - `textDocument/completion` - 代码补全
  - `textDocument/definition` - 跳转定义
  - `textDocument/references` - 查找引用
  - `textDocument/hover` - 悬停信息
  - `textDocument/publishDiagnostics` - 诊断信息

## 未来计划

- [ ] 支持更多语言（C/C++, PHP, Ruby 等）
- [ ] 实现代码重构功能
- [ ] 实现符号搜索
- [ ] 实现工作区编辑
- [ ] 支持 LSP 配置自定义
- [ ] 多语言项目自动检测
