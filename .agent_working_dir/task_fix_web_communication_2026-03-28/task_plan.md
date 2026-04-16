# Task Plan: Fix Web Interface Communication

## Goal
实现 Web 界面与后端 Gemini 进程之间的 WebSocket 通信，采用 OpenCode 的订阅者模式和现代化 WebSocket 架构，使 Web 界面能够显示 Gemini CLI 的运行状态和日志。

## Current Phase
Phase 2

## Phases

### Phase 1: Project Research & Solution Design
- [x] Analyze project structure and architecture
- [x] Identify affected modules and files
- [x] Research existing patterns and conventions
- [x] Develop 2-3 alternative solutions
- [x] Document findings in findings.md
- [x] Present solutions to user and get confirmation
- [x] User selected Solution B (参考 OpenCode 重新设计)
- **Status:** completed

### Phase 2: Implementation - WebSocket Server Enhancement
- [ ] 设计 WebSocket 消息协议（register、log、ping/pong）
- [ ] 实现订阅者管理（Map<sessionId, WebSocket>）
- [ ] 处理连接、消息、关闭、错误事件
- [ ] 添加心跳机制保持连接
- **Status:** in_progress

### Phase 3: Implementation - CLI Client Connection
- [ ] 在 gemini.tsx 中启动 WebSocket 客户端
- [ ] 发送 register 消息注册会话
- [ ] 将 ActivityLogger 指向 Web 服务器
- [ ] 实现断线重连逻辑
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] 启动 Web 服务器
- [ ] 验证 WebSocket 连接建立
- [ ] 测试日志消息推送
- [ ] 测试断线重连
- **Status:** pending

## Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| 采用方案 B：参考 OpenCode 重新设计 | 更现代的架构，支持多客户端订阅，便于扩展 | 2026-03-28 |
| 使用 ws 库而非 Bun 原生 WebSocket | Gemini CLI 运行在 Node.js 环境 | 2026-03-28 |
| 消息协议参考 activityLogger 现有实现 | 保持一致性，降低前端修改成本 | 2026-03-28 |

## Errors Encountered
| Error | Resolution | Date |
|-------|------------|------|
|       |            |      |
