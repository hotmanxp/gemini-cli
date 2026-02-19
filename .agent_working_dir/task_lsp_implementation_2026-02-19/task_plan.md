# LSP 功能实现计划

## 任务描述
在当前 CLI 中实现 LSP (Language Server Protocol) 功能，支持常用的 ts, python, java, go, rust 语言。

## 阶段划分

### 阶段 1: 调研与设计
- [x] 研究现有 LSP 客户端实现方案
- [x] 分析各语言 LSP Server 的启动方式
- [x] 设计 CLI 与 LSP Server 的通信架构
- [x] 确定需要支持的 LSP 功能范围（补全、跳转、诊断等）

### 阶段 2: 核心架构实现
- [x] 创建 LSP 模块目录结构
- [x] 实现 LSP 协议基础通信层（JSON-RPC）
- [x] 实现 LSP Server 进程管理
- [x] 实现消息订阅/发布机制

### 阶段 3: 语言支持实现
- [x] TypeScript/JavaScript LSP 支持 (typescript-language-server)
- [x] Python LSP 支持 (pylsp / pyright)
- [x] Java LSP 支持 (jdtls)
- [x] Go LSP 支持 (gopls)
- [x] Rust LSP 支持 (rust-analyzer)

### 阶段 4: CLI 集成
- [x] 实现 LSP 相关命令（补全、定义跳转、查找引用等）
- [x] 实现诊断信息显示
- [x] 实现配置文件支持
- [x] 添加 LSP 状态管理

### 阶段 5: 测试与优化
- [x] 编写单元测试
- [x] 编写集成测试
- [x] 性能优化
- [x] 文档编写

## 技术栈
- Node.js (当前 CLI 基础)
- LSP 协议规范 3.17
- 各语言官方 LSP Server

## 风险与挑战
1. 不同语言 LSP Server 的安装和配置差异
2. 进程管理和资源清理
3. 异步消息处理
4. 错误处理和恢复机制

## 完成标准
- [x] 所有 5 种语言 LSP 正常工作
- [x] 支持代码补全功能
- [x] 支持跳转定义功能
- [x] 支持诊断信息显示
- [x] 通过所有测试
