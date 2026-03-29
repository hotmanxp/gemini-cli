# Web UI Migration Plan: OpenCode → Gemini CLI

## Overview

This document outlines the migration plan for implementing a Web UI for Gemini
CLI, based on the OpenCode Web UI architecture.

---

## Phase 1: Analysis of Current State

### Existing Packages

| Package               | Current State                                                 | Purpose                        |
| --------------------- | ------------------------------------------------------------- | ------------------------------ |
| `packages/web-server` | Empty `src/routes/`                                           | HTTP server for web UI         |
| `packages/web-ui`     | Empty directories (`components/`, `hooks/`, `lib/`, `pages/`) | Frontend UI (scaffold only)    |
| `packages/sdk`        | Has `agent.ts`, `session.ts`, `types.ts`                      | Client SDK for Gemini CLI      |
| `packages/a2a-server` | Express-based HTTP server with SSE                            | Existing server implementation |

### Gap Analysis

| Component          | OpenCode         | Gemini CLI           | Gap                          |
| ------------------ | ---------------- | -------------------- | ---------------------------- |
| HTTP Framework     | Hono             | Express (a2a-server) | Need SSE route in web-server |
| Event Bus          | Effect PubSub    | None                 | Need event broadcasting      |
| Session State      | SQLite + Drizzle | File-based (chats/)  | Need session API routes      |
| Frontend Framework | SolidJS          | Empty                | Need SolidJS setup           |
| State Management   | Effect + Stores  | None                 | Need Sync contexts           |
| SDK Client         | Generated client | Basic SDK            | Need extended SDK with SSE   |

---

## Phase 2: Backend Implementation

### 2.1 Set Up Event Bus System

**Location**: `packages/web-server/src/event-bus.ts`

```typescript
// Core event bus for SSE broadcasting
interface SessionEvent {
  type: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

class EventBus {
  private subscribers: Set<(event: SessionEvent) => void> = new Set();

  publish(event: SessionEvent): void {
    for (const callback of this.subscribers) {
      callback(event);
    }
  }

  subscribe(callback: (event: SessionEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const eventBus = new EventBus();
```

### 2.2 Implement SSE Endpoint

**Location**: `packages/web-server/src/routes/session-events.ts`

```typescript
import express, { Request, Response } from 'express';
import { eventBus } from '../event-bus.js';

export function sessionEventsRouter() {
  const router = express.Router();

  router.get('/session-events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Send heartbeat every 10s
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 10000);

    // Subscribe to events
    const unsubscribe = eventBus.subscribe((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Cleanup on close
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return router;
}
```

### 2.3 Extend Session Routes

**Location**: `packages/web-server/src/routes/sessions.ts`

Required endpoints:

| Method | Endpoint                 | Description             |
| ------ | ------------------------ | ----------------------- |
| GET    | `/sessions`              | List all sessions       |
| GET    | `/sessions/:id`          | Get session details     |
| POST   | `/sessions`              | Create new session      |
| POST   | `/sessions/:id/prompt`   | Send prompt (streaming) |
| GET    | `/sessions/:id/messages` | Get messages            |
| POST   | `/sessions/:id/abort`    | Abort current operation |
| GET    | `/sessions/:id/status`   | Get session status      |

### 2.4 Integrate with SDK

**Location**: `packages/sdk/src/web-client.ts`

```typescript
export class GeminiWebClient {
  constructor(private baseUrl: string) {}

  // Session management
  async listSessions(): Promise<Session[]>;
  async getSession(id: string): Promise<Session>;
  async createSession(): Promise<Session>;
  async sendPrompt(sessionId: string, prompt: string): Promise<void>;
  async getMessages(sessionId: string, limit?: number): Promise<Message[]>;

  // Event subscription
  subscribeToEvents(callback: (event: SessionEvent) => void): () => void;
}
```

---

## Phase 3: Frontend Foundation

### 3.1 Set Up SolidJS

**Location**: `packages/web-ui/`

Need to add to package.json:

```json
{
  "dependencies": {
    "solid-js": "^1.8.0",
    "@solidjs/router": "^0.14.0",
    "@solid-primitives/event-bus": "^1.1.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vite-plugin-solid": "^2.8.0"
  }
}
```

### 3.2 Create App Entry Point

**Location**: `packages/web-ui/src/index.tsx`

```typescript
import { render } from 'solid-js/web'
import { Router, Route } from '@solidjs/router'
import { App } from './app'

render(() => (
  <Router>
    <Route path="/" component={App} />
  </Router>
), document.getElementById('root')!)
```

### 3.3 Implement SDK Provider

**Location**: `packages/web-ui/src/context/sdk.tsx`

```typescript
import { createContext, useContext, type ParentProps, createMemo } from 'solid-js'
import { GeminiWebClient } from '@google/gemini-cli-sdk'

const SdkContext = createContext<{
  client: () => GeminiWebClient
  subscribe: (cb: (event: SessionEvent) => void) => () => void
}>()

export function SdkProvider(props: ParentProps) {
  const client = createMemo(() => new GeminiWebClient('http://localhost:4096'))

  const subscribe = (callback: (event: SessionEvent) => void) => {
    return client().subscribeToEvents(callback)
  }

  return (
    <SdkContext.Provider value={{ client, subscribe }}>
      {props.children}
    </SdkContext.Provider>
  )
}

export const useSdk = () => {
  const ctx = useContext(SdkContext)
  if (!ctx) throw new Error('useSdk must be used within SdkProvider')
  return ctx
}
```

### 3.4 Implement Sync Provider

**Location**: `packages/web-ui/src/context/sync.tsx`

Manages session state with optimistic updates.

---

## Phase 4: Core UI Components

### 4.1 Session Page

**Location**: `packages/web-ui/src/pages/session.tsx`

Main chat interface with:

- Message timeline (scrollable)
- Prompt input (fixed bottom)
- Session header
- Optional: file tree, terminal panel

### 4.2 Message Timeline

**Location**: `packages/web-ui/src/components/message-timeline.tsx`

Renders messages with:

- User messages (right-aligned)
- Assistant messages (left-aligned)
- Tool results
- Code blocks with syntax highlighting

### 4.3 Prompt Input

**Location**: `packages/web-ui/src/components/prompt-input.tsx`

- Text input area
- Send button
- Attachment support (future)

### 4.4 Markdown Renderer

**Location**: `packages/web-ui/src/components/markdown.tsx`

Using `marked` + `shiki` for code highlighting.

---

## Phase 5: State Synchronization

### 5.1 Multi-Tab Support

Implement reconnection logic similar to OpenCode:

```typescript
const HEARTBEAT_TIMEOUT_MS = 15000;
const RECONNECT_DELAY_MS = 250;

async function connect() {
  while (!abort.signal.aborted) {
    try {
      const events = await sdk.subscribeToEvents(handler);
      for await (const event of events) {
        handleEvent(event);
      }
    } catch (error) {
      // Reconnect on error
      await sleep(RECONNECT_DELAY_MS);
    }
  }
}
```

### 5.2 Event Types

```typescript
type Event =
  | { type: 'connected' }
  | { type: 'heartbeat' }
  | { type: 'message.added'; properties: { message: Message } }
  | { type: 'message.delta'; properties: { messageId: string; delta: string } }
  | { type: 'session.status'; properties: { status: 'idle' | 'busy' } };
```

---

## Phase 6: File Structure

```
packages/
├── web-server/
│   └── src/
│       ├── index.ts              # Entry point
│       ├── event-bus.ts          # SSE event bus
│       └── routes/
│           ├── session-events.ts  # SSE endpoint
│           ├── sessions.ts        # Session CRUD
│           └── messages.ts        # Message endpoints
│
├── web-ui/
│   ├── src/
│   │   ├── index.tsx            # Entry point
│   │   ├── app.tsx              # Root component
│   │   ├── pages/
│   │   │   ├── home.tsx         # Session list
│   │   │   └── session.tsx      # Chat interface
│   │   ├── components/
│   │   │   ├── message-timeline.tsx
│   │   │   ├── message.tsx
│   │   │   ├── prompt-input.tsx
│   │   │   ├── markdown.tsx
│   │   │   └── session-header.tsx
│   │   ├── context/
│   │   │   ├── sdk.tsx          # SDK context
│   │   │   ├── sync.tsx         # State sync
│   │   │   └── settings.tsx
│   │   └── lib/
│   │       └── types.ts
│   └── package.json
│
└── sdk/
    └── src/
        ├── index.ts
        ├── web-client.ts         # New web client
        └── types.ts
```

---

## Implementation Order

### Step 1: Backend Foundation

1. Create event bus (`packages/web-server/src/event-bus.ts`)
2. Add SSE endpoint (`packages/web-server/src/routes/session-events.ts`)
3. Implement session routes

### Step 2: SDK Extension

1. Create web client (`packages/sdk/src/web-client.ts`)
2. Add event subscription methods

### Step 3: Frontend Setup

1. Set up SolidJS dependencies
2. Create basic app structure
3. Implement SDK provider

### Step 4: Core UI

1. Build session list page
2. Build chat page with message timeline
3. Implement prompt input
4. Add markdown rendering

### Step 5: Polish

1. Multi-tab synchronization
2. Error handling
3. Loading states

---

## Key Differences from OpenCode

| Aspect         | OpenCode         | Gemini CLI Migration                 |
| -------------- | ---------------- | ------------------------------------ |
| HTTP Framework | Hono             | Express (keep a2a-server compatible) |
| Database       | SQLite + Drizzle | File-based (existing chat files)     |
| Event Bus      | Effect PubSub    | Simple event emitter                 |
| State          | Effect + Stores  | SolidJS Stores                       |
| Streaming      | Native SSE       | SSE via Express response             |

---

## References

- OpenCode Web UI Architecture: `/docs/web-ui-architecture.md`
- OpenCode Backend: `packages/opencode/src/server/`
- OpenCode Frontend: `packages/app/src/`
