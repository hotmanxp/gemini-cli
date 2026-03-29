export interface Session {
  id: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'busy';
}

export interface SessionMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  parts: Part[];
  createdAt: number;
}

export type Part =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: string; state: string };

export interface SessionEvent {
  type: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

export type EventHandler = (event: SessionEvent) => void;

export class GeminiWebClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private handlers: Set<EventHandler> = new Set();
  private reconnectDelay = 250;
  private maxReconnectDelay = 30000;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = 'http://localhost:4096') {
    this.baseUrl = baseUrl;
  }

  async listSessions(): Promise<Session[]> {
    const res = await fetch(`${this.baseUrl}/sessions`);
    if (!res.ok) throw new Error(`Failed to list sessions: ${res.statusText}`);
    return res.json();
  }

  async getSession(id: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/sessions/${id}`);
    if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
    return res.json();
  }

  async createSession(): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/sessions`, { method: 'POST' });
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

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    this.connect();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) {
        this.disconnect();
      }
    };
  }

  private connect(): void {
    if (this.eventSource) return;

    this.abortController = new AbortController();
    this.eventSource = new EventSource(`${this.baseUrl}/session-events`);

    this.eventSource.onmessage = (event) => {
      try {
        const data: SessionEvent = JSON.parse(event.data);
        for (const handler of this.handlers) {
          handler(data);
        }
      } catch {}
    };

    this.eventSource.onerror = () => {
      this.reconnect();
    };
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
