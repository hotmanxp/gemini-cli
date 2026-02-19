# LSP 功能实现 - 调研发现

## 项目结构分析 (2026-02-19)

### 当前 CLI 架构
这是一个 monorepo 项目，使用 npm workspaces 管理多个包：

```
packages/
├── cli/           # 主 CLI 包 (入口)
├── core/          # 核心功能包
├── sdk/           # SDK 包
├── a2a-server/    # A2A 服务器
├── vscode-ide-companion/  # VSCode 扩展
├── test-utils/    # 测试工具
```

### CLI 包结构 (packages/cli/src/)
```
src/
├── commands/      # 命令实现 (extensions, mcp, skills, hooks)
├── config/        # 配置管理
├── core/          # CLI 核心逻辑
├── services/      # 服务层
├── ui/            # UI 组件 (基于 Ink/React)
├── utils/         # 工具函数
└── zed-integration/ # Zed 编辑器集成
```

### Core 包结构 (packages/core/src/)
```
src/
├── agents/        # Agent 实现
├── commands/      # 命令处理
├── config/        # 配置服务
├── core/          # 核心逻辑
├── hooks/         # 钩子系统
├── ide/           # IDE 集成
├── mcp/           # MCP (Model Context Protocol)
├── services/      # 各种服务
├── tools/         # 工具实现
└── utils/         # 工具函数
```

## 现有扩展点分析

### 1. MCP (Model Context Protocol) 支持
- 位置：packages/cli/src/commands/mcp/, packages/core/src/mcp/
- 已有 MCP 服务器管理功能
- 可作为 LSP 集成的参考架构

### 2. 命令系统
- 位置：packages/cli/src/commands/
- 支持扩展命令注册
- 使用 Yargs 进行命令行解析

### 3. 服务架构
- 位置：packages/core/src/services/
- 已有多种服务实现：
  - shellExecutionService: Shell 执行服务
  - fileDiscoveryService: 文件发现服务
  - gitService: Git 服务
  - contextManager: 上下文管理

### 4. IDE 集成
- 位置：packages/core/src/ide/
- 已有 VSCode 集成
- 可作为 LSP 客户端集成的参考

## LSP 实现方案

### 方案 1: 基于现有 MCP 架构扩展
**优点**:
- 复用现有架构
- 统一的协议处理

**缺点**:
- MCP 和 LSP 协议不同，需要适配

### 方案 2: 独立 LSP 服务模块
**优点**:
- 清晰的职责分离
- 易于维护和扩展

**缺点**:
- 需要新建架构

### 推荐方案：方案 2
创建独立的 LSP 服务模块，参考现有服务架构：

```
packages/core/src/services/lsp/
├── LspService.ts        # LSP 服务主类
├── LspClient.ts         # LSP 客户端 (JSON-RPC)
├── LspServerManager.ts  # LSP Server 进程管理
├── languages/           # 各语言 LSP 配置
│   ├── typescript.ts
│   ├── python.ts
│   ├── java.ts
│   ├── go.ts
│   └── rust.ts
└── types.ts             # LSP 类型定义
```

## 各语言 LSP Server 信息

| 语言 | LSP Server | 安装方式 | 启动命令 |
|------|-----------|---------|---------|
| TypeScript | typescript-language-server | npm install -g | typescript-language-server --stdio |
| Python | pyright | npm install -g | pyright --stdio |
| Java | jdtls | 下载 eclipse.jdt.ls | java -jar jdtls.jar |
| Go | gopls | go install | gopls |
| Rust | rust-analyzer | rustup | rust-analyzer |

## 需要实现的 LSP 功能

1. **基本功能**:
   - 初始化 (initialize)
   - 文本同步 (textDocument/didOpen, didChange, didClose)
   - 关闭 (shutdown, exit)

2. **核心功能**:
   - 代码补全 (textDocument/completion)
   - 跳转定义 (textDocument/definition)
   - 查找引用 (textDocument/references)
   - 诊断信息 (textDocument/publishDiagnostics)
   - 悬停提示 (textDocument/hover)
   - 符号搜索 (workspace/symbol)

## 待确认事项
- [ ] 是否需要支持 LSP 配置自定义
- [ ] 是否需要支持多语言项目检测
- [ ] LSP Server 自动安装策略
- [ ] 与现有 MCP 系统的集成方式
