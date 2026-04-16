# Findings & Decisions

## Requirements
- 实现 Web 界面与后端 Gemini 进程之间的 WebSocket 通信
- 参考 OpenCode 项目的 WebSocket 架构模式
- 使 Web 界面能够显示 Gemini CLI 的运行状态和日志

## Research Findings

### Gemini CLI 当前架构问题
1. **Web 服务器启动后无后续操作** - `packages/cli/src/gemini.tsx:285-298` 启动 Web 服务器后，没有建立 WebSocket 连接
2. **WebSocket 处理器为空** - `packages/web-server/src/server.ts:99-117` 仅监听连接和错误，不处理任何消息
3. **缺少客户端连接** - CLI 主进程从未作为 WebSocket 客户端连接到 Web 服务器

### OpenCode 架构参考

#### 1. 服务器启动模式 (Bun + Hono)
```typescript
// packages/opencode/src/server/server.ts
Bun.serve({
  hostname: opts.hostname,
  idleTimeout: 0,
  fetch: app.fetch,
  websocket: websocket,  // 关键：启用 WebSocket 支持
})
```

#### 2. WebSocket 路由模式
```typescript
// packages/opencode/src/server/routes/pty.ts
upgradeWebSocket(async (c) => ({
  async onOpen(_event, ws) {
    handler = await Pty.connect(id, socket, cursor)
    ready = true
  },
  onMessage(event) {
    if (!ready) { pending.push(event.data); return }
    handler?.onMessage(event.data)
  },
  onClose() { handler?.onClose() },
  onError() { handler?.onClose() },
}))
```

#### 3. 后端处理器模式
```typescript
// packages/opencode/src/pty/index.ts
type Active = {
  subscribers: Map<unknown, Socket>  // 多客户端订阅
  buffer: string                      // 输出缓冲
  cursor: number                      // 游标位置
}

// 数据推送
for (const [key, ws] of session.subscribers.entries()) {
  if (ws.readyState !== 1) continue
  ws.send(chunk)
}
```

#### 4. 前端连接模式
```typescript
// packages/app/src/components/terminal.tsx
const ws = new WebSocket(url)
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'register', sessionId }))
}
ws.onmessage = (event) => {
  // 处理服务器推送的数据
}
ws.onclose = () => {
  // 重连逻辑
}
```

## Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| 采用 OpenCode 的订阅者模式 | 支持多客户端同时连接，便于扩展 | 2026-03-28 |
| 使用升级 WebSocket 模式 | Hono/Bun 提供的类型安全 WebSocket API | 2026-03-28 |
| 复用 activityLogger.ts 的客户端实现 | 已有完整的重连、心跳、注册逻辑 | 2026-03-28 |

## Issues Encountered
| Issue | Solution |
|-------|----------|
| Gemini CLI 使用 Express 而非 Hono | 需要适配 Express 的 WebSocket 升级方式 |
| Gemini CLI 在 Node.js 而非 Bun 运行 | 使用 `ws` 库替代 Bun 原生 WebSocket |

## Resources
- OpenCode WebSocket 实现：`/Users/ethan/code/opencode/packages/opencode/src/server/routes/pty.ts`
- OpenCode PTY 后端：`/Users/ethan/code/opencode/packages/opencode/src/pty/index.ts`
- OpenCode 前端连接：`/Users/ethan/code/opencode/packages/app/src/components/terminal.tsx`
- Gemini CLI activityLogger：`/Users/ethan/code/gemini-cli/packages/cli/src/utils/activityLogger.ts:719-950`
- Gemini CLI web-server：`/Users/ethan/code/gemini-cli/packages/web-server/src/server.ts`
