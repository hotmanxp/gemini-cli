export interface Session {
  id: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'busy';
  workspace?: string;
  workspaceName?: string;
}

export interface WorkspaceGroup {
  workspace: string;
  name: string;
  sessions: Session[];
}

export interface SessionMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  parts: Part[];
  createdAt: number;
  tokens?: TokenUsage;
  cost?: CostInfo;
}

export interface TokenUsage {
  input: number;
  output: number;
  thoughts?: number;
  total: number;
}

export interface CostInfo {
  amount: number;
  currency?: string;
}

export type Part =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: string; state: unknown }
  | { type: 'usage'; tokens: TokenUsage };

export interface SessionEvent {
  type: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

export class GeminiWebClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private handlers: Set<(event: SessionEvent) => void> = new Set();
  private reconnectDelay = 250;
  private maxReconnectDelay = 30000;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = 'http://localhost:4097') {
    this.baseUrl = baseUrl;
  }

  async listSessions(): Promise<Session[]> {
    const res = await fetch(`${this.baseUrl}/sessions`);
    if (!res.ok) throw new Error(`Failed to list sessions: ${res.statusText}`);
    return res.json();
  }

  async getGroupedSessions(): Promise<WorkspaceGroup[]> {
    const res = await fetch(`${this.baseUrl}/sessions/grouped`);
    if (!res.ok)
      throw new Error(`Failed to get grouped sessions: ${res.statusText}`);
    return res.json();
  }

  async getCommands(): Promise<{
    commands: Array<{ name: string; description: string; kind: string }>;
  }> {
    const res = await fetch(`${this.baseUrl}/sessions/commands`);
    if (!res.ok) throw new Error(`Failed to get commands: ${res.statusText}`);
    return res.json();
  }

  async searchFiles(query: string, cwd?: string): Promise<string[]> {
    const params = new URLSearchParams({ q: query });
    if (cwd) params.set('cwd', cwd);
    const res = await fetch(`${this.baseUrl}/sessions/files?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  }

  async listDirectories(dir?: string): Promise<{
    directories: Array<{ name: string; path: string }>;
    parent: string | null;
    homeDir: string;
  }> {
    const params = dir
      ? new URLSearchParams({ path: dir })
      : new URLSearchParams();
    const res = await fetch(`${this.baseUrl}/sessions/directories?${params}`);
    if (!res.ok) return { directories: [], parent: null, homeDir: '/Users' };
    return res.json();
  }

  async executeCommand(
    command: string,
    args?: string,
  ): Promise<{ type: string; messageType?: string; content?: string }> {
    const res = await fetch(`${this.baseUrl}/sessions/commands/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args }),
    });
    if (!res.ok)
      throw new Error(`Failed to execute command: ${res.statusText}`);
    const data = await res.json();
    return data.result;
  }

  async getSession(id: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/sessions/${id}`);
    if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
    return res.json();
  }

  async createSession(
    workspace?: string,
    workspaceName?: string,
  ): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace, workspaceName }),
    });
    if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
    return res.json();
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`Failed to send prompt: ${res.statusText}`);
  }

  async getMessages(
    sessionId: string,
  ): Promise<{ messages: SessionMessage[] }> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/messages`);
    if (!res.ok) throw new Error(`Failed to get messages: ${res.statusText}`);
    return res.json();
  }

  async getSessionStatus(sessionId: string): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/status`);
    if (!res.ok) throw new Error(`Failed to get status: ${res.statusText}`);
    return res.json();
  }

  async abortSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/abort`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to abort session: ${res.statusText}`);
  }

  subscribe(handler: (event: SessionEvent) => void): () => void {
    this.handlers.add(handler);
    this.connect();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.disconnect();
    };
  }

  private connect(): void {
    if (this.eventSource) return;
    this.abortController = new AbortController();
    this.eventSource = new EventSource(`${this.baseUrl}/session-events`);

    const eventTypes = [
      'message.added',
      'message.updated',
      'session.status',
      'error',
    ];
    for (const eventType of eventTypes) {
      this.eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          for (const h of this.handlers)
            h({
              type: eventType,
              properties: data,
              timestamp: Date.now(),
            } as SessionEvent);
        } catch {}
      });
    }

    this.eventSource.onmessage = (event) => {
      try {
        const data: SessionEvent = JSON.parse(event.data);
        for (const h of this.handlers) h(data);
      } catch {}
    };
    this.eventSource.onerror = () => this.reconnect();
  }

  private reconnect(): void {
    if (this.abortController?.signal.aborted) return;
    this.disconnect();
    setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );
      this.connect();
    }, this.reconnectDelay);
  }

  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  destroy(): void {
    this.disconnect();
    this.handlers.clear();
  }
}
