# OpenCode Web UI Architecture Documentation

This document provides detailed documentation of the OpenCode Web UI
architecture, extracted from the upstream repository for migration purposes.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend Architecture (SolidJS)](#frontend-architecture-solidjs)
3. [Backend Architecture (Hono Server)](#backend-architecture-hono-server)
4. [Communication Protocols](#communication-protocols)
5. [State Management](#state-management)
6. [Session Management](#session-management)
7. [Multi-Tab Synchronization](#multi-tab-synchronization)
8. [Key File Reference](#key-file-reference)

---

## Architecture Overview

### Technology Stack

| Layer                  | Technology                       |
| ---------------------- | -------------------------------- |
| **Frontend Framework** | SolidJS + Vite                   |
| **Backend Framework**  | Hono (lightweight web framework) |
| **Database**           | SQLite with Drizzle ORM          |
| **AI SDK**             | Vercel AI SDK                    |
| **State Management**   | SolidJS Store + Effect Framework |
| **Styling**            | Tailwind CSS                     |
| **UI Components**      | Custom @opencode-ai/ui           |
| **Routing**            | @solidjs/router                  |
| **Markdown Rendering** | marked + Shiki                   |

### Package Structure

```
packages/
├── app/                    # Main SolidJS Web Application
│   └── src/
│       ├── app.tsx         # Root component + routing
│       ├── pages/           # Page components
│       │   ├── home.tsx    # Home page - project list
│       │   ├── session.tsx # Session page (core)
│       │   └── layout.tsx  # Layout wrapper
│       ├── components/      # Reusable UI components
│       │   ├── session/    # Session-related components
│       │   ├── prompt-input/ # Input area
│       │   └── dialog-*.tsx # Dialogs
│       └── context/         # State management contexts
│           ├── sync.tsx       # Session sync state
│           ├── global-sync.tsx # Global sync
│           ├── sdk.tsx        # SDK client context
│           └── settings.tsx   # Settings state
│
├── ui/                     # Shared UI Component Library
│   └── src/components/
│       ├── markdown.tsx     # Markdown renderer
│       ├── button.tsx
│       └── dialog.tsx
│
├── opencode/              # Backend (Hono + Effect)
│   └── src/
│       ├── server/         # HTTP Server
│       │   ├── server.ts   # Hono app + WebSocket
│       │   ├── router.ts   # Route middleware
│       │   └── routes/     # API endpoints
│       │       ├── session.ts
│       │       ├── event.ts    # SSE endpoint
│       │       └── global.ts
│       ├── session/         # Session Core
│       │   ├── index.ts    # Session Service
│       │   ├── processor.ts # LLM call + tool loop
│       │   └── message-v2.ts
│       ├── bus/            # Event Bus (Effect PubSub)
│       ├── storage/        # SQLite + Drizzle
│       └── tool/           # Tool system
│
└── sdk/                   # Frontend SDK
    └── js/src/client.ts   # HTTP client factory
```

---

## Frontend Architecture (SolidJS)

### Routing Structure

```typescript
// app.tsx
<Route path="/" component={HomeRoute} />
<Route path="/:dir" component={DirectoryLayout}>
  <Route path="/" component={SessionIndexRoute} />
  <Route path="/session/:id?" component={SessionRoute} />
</Route>
```

### Provider Hierarchy

```typescript
// app.tsx - Provider nesting order
<AppBaseProviders>
  <ThemeProvider>
    <LanguageProvider>
      <I18nProvider>
        <ErrorBoundary>
          <QueryProvider>           // TanStack Query
            <DialogProvider>
              <MarkedProvider>      // Markdown parser
                <FileComponentProvider>
                  <AppShellProviders>
                    <SettingsProvider>
                      <PermissionProvider>
                        <LayoutProvider>
                          <NotificationProvider>
                            <ModelsProvider>
                              <CommandProvider>
                                <HighlightsProvider>
                                  <Layout>
                                    {/* Page content */}
                                  </Layout>
                                </HighlightsProvider>
                              </CommandProvider>
                            </ModelsProvider>
                          </NotificationProvider>
                        </LayoutProvider>
                      </PermissionProvider>
                    </SettingsProvider>
                  </AppShellProviders>
                </FileComponentProvider>
              </MarkedProvider>
            </DialogProvider>
          </QueryProvider>
        </ErrorBoundary>
      </I18nProvider>
    </LanguageProvider>
  </ThemeProvider>
</AppBaseProviders>
```

### Session Page Structure

```tsx
// pages/session.tsx
<Session>
  ├── SessionHeader          // Top bar
  ├── <Switch>
  │   ├── <Match when={params.id}>  // Session view
  │   │   ├── MessageTimeline        // Message list
  │   │   ├── SessionComposerRegion   // Input area
  │   │   ├── TerminalPanel          // Terminal (collapsible)
  │   │   └── ReviewTab             // Code review panel
  │   └── <Match when={!params.id}> // New session view
  │       └── SessionNewView
  └── </Switch>
</Session>
```

### Key State Management Contexts

#### 1. GlobalSyncProvider (`context/global-sync.tsx`)

- Manages global state: project list, provider config, settings
- Each project directory has a child store
- Handles project switching and initialization

#### 2. SyncProvider (`context/sync.tsx`)

- Manages session messages
- Handles message pagination and optimistic updates
- Tracks session diffs and todos

#### 3. SDKProvider (`context/sdk.tsx`)

- Creates per-directory SDK client
- Routes events from GlobalSDK to local emitter

#### 4. GlobalSDKProvider (`context/global-sdk.tsx`)

- Maintains SSE connection to backend
- Receives and distributes server events
- Handles reconnection with heartbeat

---

## Backend Architecture (Hono Server)

### Server Setup

```typescript
// server/server.ts
export const ControlPlaneRoutes = (opts?: { cors?: string[] }): Hono => {
  const app = new Hono();
  return app
    .onError(errorHandler(log))
    .use(cors()) // CORS middleware
    .use(compress()) // gzip compression
    .route('/global', GlobalRoutes())
    .route('/session', SessionRoutes())
    .route('/project', ProjectRoutes());
  // ... more routes
};
```

### SSE Endpoint (`/event`)

```typescript
// server/routes/event.ts
app.get('/event', async (c) => {
  return streamSSE(c, async (stream) => {
    const q = new AsyncQueue<string | null>();

    // Heartbeat every 10s
    const heartbeat = setInterval(() => {
      q.push(JSON.stringify({ type: 'server.heartbeat' }));
    }, 10_000);

    // Subscribe to all Bus events
    const unsub = Bus.subscribeAll((event) => {
      q.push(JSON.stringify(event));
    });

    for await (const data of q) {
      await stream.writeSSE({ data });
    }
  });
});
```

### Session API Routes

| Endpoint                    | Method | Description              |
| --------------------------- | ------ | ------------------------ |
| `/session`                  | GET    | List all sessions        |
| `/session`                  | POST   | Create new session       |
| `/session/:id`              | GET    | Get session details      |
| `/session/:id`              | PUT    | Update session           |
| `/session/:id/messages`     | GET    | Get messages (paginated) |
| `/session/:id/diff`         | GET    | Get session diff         |
| `/session/:id/prompt_async` | POST   | **Send prompt (async)**  |
| `/session/:id/abort`        | POST   | Abort current operation  |
| `/session/:id/share`        | POST   | Share session            |
| `/session/:id/revert`       | POST   | Revert to message        |

---

## Communication Protocols

### 1. HTTP/REST API - Request/Response

Used for: CRUD operations, sending prompts, querying data

```typescript
// SDK Client Usage
const client = createOpencodeClient({ directory: '/project/path' });

// List sessions
const sessions = await client.session.list();

// Get session messages
const messages = await client.session.messages({
  sessionID: 'xxx',
  limit: 80,
});

// Send prompt
await client.session.prompt_async({
  sessionID: 'xxx',
  prompt: [{ type: 'text', content: 'Hello' }],
});
```

### 2. SSE (Server-Sent Events) - Subscriptions

Used for: Real-time updates, streaming responses

```typescript
// Backend publishes events
Bus.publish(Session.Event.PartDelta, {
  sessionID,
  messageID,
  partID,
  delta: 'text chunk',
});

// Frontend subscribes
for await (const event of events.stream) {
  if (event.type === 'message.part.delta') {
    // Update local message store
    updatePartDelta(event.properties);
  }
}
```

### Event Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Backend   │         │     SSE     │         │   Frontend  │
│             │         │   Route     │         │             │
│  Session    │──Event──▶│  /event     │──Event──▶│  GlobalSDK  │
│  Processor  │         │             │         │             │
└─────────────┘         └─────────────┘         └──────┬──────┘
                                                      │
                                                      ▼
                                              ┌─────────────┐
                                              │   Stores    │
                                              │  (Sync)     │
                                              └─────────────┘
```

---

## State Management

### GlobalSync Structure

```typescript
type GlobalStore = {
  ready: boolean;
  path: Path; // Paths (state, config, worktree, etc.)
  project: Project[]; // Project list
  session_todo: Todo[]; // Session todos
  provider: ProviderListResponse; // Available providers
  provider_auth: ProviderAuthResponse;
  config: Config; // User configuration
};
```

### SyncStore Structure

```typescript
type SyncStore = {
  session: Session[]; // Session list
  message: Record<string, Message[]>; // Messages by session
  part: Record<string, Part[]>; // Parts by message
  session_diff: Record<string, Diff[]>;
  todo: Record<string, Todo[]>;
  status: Record<string, SessionStatus>;
};
```

### Optimistic Updates

```typescript
// Optimistic add - immediately update UI
sync.session.optimistic.add({
  sessionID: 'xxx',
  message: newUserMessage,
  parts: [],
});

// Backend confirms → remove optimistic entry
// Backend rejects → rollback optimistic entry
```

---

## Session Management

### Session Lifecycle

```
1. Create Session
   └─ POST /session → { id, slug, projectID, ... }

2. Send Prompt
   └─ POST /session/:id/prompt_async
       ├─ Check busy status (BusyError if busy)
       ├─ Create assistant message
       ├─ Set status = busy
       └─ Start processor loop

3. Processor Loop
   while (!done) {
     ├─ Build prompt from messages
     ├─ Stream LLM response
     │   ├─ text-delta → update Part
     │   ├─ reasoning-* → update reasoning parts
     │   └─ tool-call → execute tool → continue
     ├─ Execute tools
     └─ Check for completion
   }

4. Session Idle
   └─ Set status = idle → publish idle event
```

### Message Structure

```typescript
// Message types
interface Message {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: { created: number; updated?: number };
  agent?: string;
  model?: { providerID: string; modelID: string };
  parts: Part[];
  finish?: string;
  cost?: number;
  tokens?: number;
}

// Part types
type Part =
  | TextPart // { type: "text", text: string }
  | ReasoningPart // { type: "reasoning", text: string }
  | ToolPart // { type: "tool", tool: string, state: ToolState }
  | FilePart // { type: "file", path: string }
  | PatchPart // { type: "patch", files: Diff[] }
  | StepStartPart // { type: "step-start" }
  | StepFinishPart; // { type: "step-finish", reason: string }
```

---

## Multi-Tab Synchronization

### Event Broadcasting

All connected clients receive the same events via SSE:

```typescript
// Event types
type Event =
  | { type: 'server.connected' }
  | { type: 'server.heartbeat' }
  | { type: 'session.status'; properties: { sessionID; status } }
  | { type: 'message.added'; properties: { message } }
  | { type: 'message.part.delta'; properties: { messageID; partID; delta } }
  | { type: 'message.part.updated'; properties: { part } }
  | { type: 'session.diff'; properties: { diff } }
  | { type: 'lsp.updated' };
```

### Concurrency Control

**BusyError**: When one tab is processing a prompt, others receive this error if
they try to send:

```typescript
// Backend check
assertNotBusy(sessionID) {
  const match = state()[sessionID]
  if (match) throw new BusyError(sessionID)
}
```

### Tab Synchronization Scenarios

| Scenario                               | Result                                     |
| -------------------------------------- | ------------------------------------------ |
| Tab A processing, Tab B sends prompt   | Tab B gets `BusyError`                     |
| Tab A completes, Tab B doesn't refresh | Tab B receives `idle` event, enables input |
| Tab A edits file, Tab B open           | Tab B receives `lsp.updated` event         |
| Tab A aborts                           | Tab B receives `idle` event                |

---

## Key File Reference

### Backend Files

| File                       | Purpose                          |
| -------------------------- | -------------------------------- |
| `server/server.ts`         | Hono app setup, CORS, middleware |
| `server/routes/event.ts`   | SSE endpoint for subscriptions   |
| `server/routes/session.ts` | Session CRUD + prompt submission |
| `bus/index.ts`             | Effect PubSub event bus          |
| `session/index.ts`         | Session service (Effect)         |
| `session/processor.ts`     | LLM streaming + tool execution   |
| `session/message-v2.ts`    | Message/Part types               |
| `storage/db.ts`            | SQLite connection + Drizzle      |

### Frontend Files

| File                       | Purpose                            |
| -------------------------- | ---------------------------------- |
| `app.tsx`                  | Root component, providers, routing |
| `context/global-sdk.tsx`   | SSE connection, event distribution |
| `context/sync.tsx`         | Session message state              |
| `context/global-sync.tsx`  | Global state management            |
| `pages/session.tsx`        | Session page (1700+ lines)         |
| `pages/home.tsx`           | Home/project list                  |
| `components/markdown.tsx`  | Markdown rendering with streaming  |
| `components/prompt-input/` | Input area components              |

---

## Migration Notes for Gemini CLI

### Key Differences to Address

1. **HTTP Framework**: OpenCode uses Hono, Gemini CLI uses Express
   - Consider: Keep Express for compatibility or adopt Hono for performance

2. **State Management**: OpenCode uses Effect + PubSub
   - Consider: Can adapt to Gemini CLI's existing patterns

3. **Database**: OpenCode uses SQLite + Drizzle
   - Gemini CLI already has session handling, may need schema updates

4. **Event Bus**: OpenCode has a sophisticated Effect-based PubSub
   - Can implement similar SSE broadcasting

5. **SDK Pattern**: OpenCode has a generated SDK client
   - Gemini CLI has `packages/sdk` - can extend similarly

### Suggested Migration Order

1. **Phase 1: Backend Foundation**
   - Set up SSE endpoint in web-server
   - Implement event bus for broadcasting
   - Create session management service

2. **Phase 2: Frontend Foundation**
   - Set up SolidJS in web-ui
   - Implement SDK client for backend communication
   - Create GlobalSync and Sync providers

3. **Phase 3: Core Features**
   - Implement session page with message timeline
   - Implement prompt input and submission
   - Implement markdown rendering

4. **Phase 4: Polish**
   - Add multi-tab synchronization
   - Add settings dialogs
   - Add file tree and terminal panel
