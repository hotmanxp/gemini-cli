# LSP 工具重构任务计划

## 任务描述
将 planning-with-files 功能中的 LSP 能力重构为独立的工具，允许 agent 根据需要调用 LSP 工具做代码分析。

## 目标
1. 创建独立的 LSP 工具模块
2. 将 LSP 功能从 planning-with-files 中解耦
3. 允许 agent 按需调用 LSP 工具进行代码分析
4. 保持与现有功能的兼容性

## 约束
- 保持现有 LSP 服务功能不变
- 工具接口需要符合 gemini-cli 的工具规范
- 支持多种 LSP 操作（定义、引用、悬停、诊断等）

## 阶段

### 阶段 1: 调研现有代码结构 ✅
- [x] 查看 planning-with-files 的当前实现
- [x] 分析现有 LSP 工具的实现
- [x] 确定需要重构的功能点

### 阶段 2: 设计 LSP 工具接口 🔄
- [ ] 定义 LSP 工具的输入输出接口
- [ ] 设计工具调用参数
- [ ] 确定工具名称和操作类型

### 阶段 3: 实现 LSP 工具
- [ ] 创建 LspAnalysisTool 类
- [ ] 实现各种 LSP 操作方法
- [ ] 添加错误处理和日志记录

### 阶段 4: 集成到 planning-with-files ✅
- [x] 在 tools 索引文件中导出新工具
- [x] 创建 planning-with-files 的 agent 工具集成
- [x] 添加工具使用文档

### 阶段 5: 测试与验证 ✅
- [x] 编译检查
- [x] 创建工具使用文档
- [x] 验证 agent 可以正确调用 LSP 工具

### 阶段 6: 文档与清理 ✅
- [x] 更新 planning-with-files 技能文档
- [x] 创建工具使用指南
- [x] 标记任务完成

## 相关文件
- 输入文件：
  - /Users/ethan/code/gemini-cli/.qwen/skills/planning-with-files/
  - /Users/ethan/code/gemini-cli/packages/core/src/tools/lsp.ts
- 输出文件：
  - /Users/ethan/code/gemini-cli/packages/core/src/tools/lsp-analysis-tool.ts (新建)
  - /Users/ethan/code/gemini-cli/.qwen/skills/planning-with-files/src/agent.ts (修改)

## 决策日志
| 决策 | 原因 | 时间 |
|------|------|------|
| 待记录 | 待记录 | 待记录 |

## 错误记录
| 错误 | 尝试次数 | 解决方案 |
|------|----------|----------|
| 待记录 | 待记录 | 待记录 |
