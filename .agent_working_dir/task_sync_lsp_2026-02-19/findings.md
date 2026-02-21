# Findings & Decisions

## Requirements
- 将 qwen-code 项目中功能完善的 LSP 实现同步到 gemini-cli
- gemini-cli 当前已有 LSP 实现但功能不完善
- 需要保留或增强 gemini-cli 的现有 LSP 功能

## Research Findings

### qwen-code LSP 架构分析

**核心文件结构:**
```
packages/core/src/lsp/
├── NativeLspService.ts         # 统一 LSP 服务层，提供高级 API
├── LspServerManager.ts         # LSP 服务器管理器，处理启动/停止
├── LspConnectionFactory.ts     # LSP 连接工厂 (stdio/tcp/socket)
├── LspResponseNormalizer.ts    # LSP 响应标准化器
├── LspLanguageDetector.ts      # 语言检测器
├── LspConfigLoader.ts          # 配置加载器 (.lsp.json)
└── NativeLspClient.ts          # LSP 客户端实现
```

**核心功能:**
1. **NativeLspService** (高级 API):
   - `discoverAndPrepare()` - 自动发现和准备 LSP 服务器
   - `workspaceSymbols()` - 工作区符号搜索
   - `definitions()` - 跳转定义
   - `references()` - 查找引用
   - `hover()` - 悬停信息
   - `documentSymbols()` - 文档符号
   - `implementations()` - 跳转实现
   - `prepareCallHierarchy()` - 准备调用层次
   - `incomingCalls()` / `outgoingCalls()` - 调用者/被调用者
   - `diagnostics()` / `workspaceDiagnostics()` - 诊断信息
   - `codeActions()` - 代码操作
   - `applyWorkspaceEdit()` - 应用工作区编辑

2. **LspServerManager** (服务器管理):
   - 支持多服务器并发启动
   - 自动重启机制 (crash recovery)
   - TypeScript 服务器 warmup 机制
   - 支持 stdio/tcp/socket 传输
   - 工作区信任检查
   - 用户确认机制

3. **LspConnectionFactory** (连接层):
   - JsonRpcConnection 类处理 LSP 协议
   - 支持 stdio 和 TCP/Socket 连接
   - 超时和重试机制
   - 请求/响应匹配

4. **LspResponseNormalizer** (响应标准化):
   - 诊断信息标准化
   - 代码操作标准化
   - 符号信息标准化
   - 调用层次标准化
   - 支持多种响应格式

5. **LspLanguageDetector** (语言检测):
   - 文件扩展名映射
   - 根目录标记文件检测 (package.json, tsconfig.json 等)
   - 语言频率统计

6. **LspConfigLoader** (配置加载):
   - 用户 `.lsp.json` 配置
   - 扩展配置支持
   - 配置合并策略
   - 内置预设 (typescript, python, go 等)

7. **LspTool** (工具层):
   - 统一的 LSP 工具接口
   - 支持 12 种操作
   - 参数验证和错误处理
   - 格式化输出

### gemini-cli 当前 LSP 状态

**核心文件结构:**
```
packages/core/src/services/lsp/
├── LspService.ts              # LSP 服务层 (功能有限)
├── LspServerManager.ts        # 服务器管理器 (简化版)
├── LspClient.ts               # LSP 客户端 (基础实现)
└── languages.ts               # 语言配置 (未找到文件)
```

**当前问题:**
1. **功能不完善**:
   - 只有基础的 completion/definition/references/hover
   - 缺少 documentSymbols/workspaceSymbols
   - 缺少 call hierarchy (incoming/outgoing calls)
   - 缺少 implementations
   - 缺少 diagnostics 支持
   - 缺少 codeActions
   - 缺少 workspace edit 支持

2. **架构差异**:
   - LspService 基于语言 ID 管理 (较简单)
   - LspServerManager 只支持单个客户端类
   - 缺少自动语言检测
   - 缺少配置加载器
   - 缺少响应标准化
   - 缺少多服务器支持

3. **代码质量问题**:
   - LspClient 中字符串转义问题 (`\\r\\n` 应为 `\r\n`)
   - 错误处理不完善
   - 缺少超时和重试机制

### 迁移策略

**推荐方法: 完全替换 + 适配**

qwen-code 的 LSP 实现明显更完善，应该:
1. 将 qwen-code 的 LSP 代码复制到 gemini-cli
2. 适配 gemini-cli 的项目结构 (路径、导入等)
3. 更新 gemini-cli 的 CLI 命令层使用新的 LSP API
4. 保留 gemini-cli 的特定功能 (如果有)

**需要迁移的文件:**
```
packages/core/src/lsp/
├── NativeLspService.ts
├── LspServerManager.ts
├── LspConnectionFactory.ts
├── LspResponseNormalizer.ts
├── LspLanguageDetector.ts
├── LspConfigLoader.ts
├── NativeLspClient.ts (覆盖现有的 LspClient.ts)
├── types.ts (需要检查类型定义)
└── constants.ts (需要检查常量定义)
```

**工具层迁移:**
- `packages/core/src/tools/lsp.ts` - 需要适配到 gemini-cli 的工具系统

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 完全替换而非增量更新 | qwen-code 实现更完善，增量更新成本高且易出错 |
| 保留 API 兼容性 | 确保 gemini-cli 现有代码能继续使用 LSP 功能 |
| 分阶段迁移 | 先迁移核心层，再迁移工具层，最后测试验证 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 待迁移过程中发现 | 待解决 |

## Resources
- qwen-code LSP 路径：/Users/ethan/code/qwen-code/packages/core/src/lsp/
- gemini-cli LSP 路径：/Users/ethan/code/gemini-cli/packages/core/src/services/lsp/
- qwen-code LSP 工具：/Users/ethan/code/qwen-code/packages/core/src/tools/lsp.ts
- gemini-cli LSP 命令：/Users/ethan/code/gemini-cli/packages/cli/src/commands/lsp.ts

## Visual/Browser Findings
- 无

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
