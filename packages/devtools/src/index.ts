/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  NetworkLog,
  ConsoleLogPayload,
  InspectorConsoleLog,
} from './types.js';
import { INDEX_HTML, CLIENT_JS } from './_client-assets.js';

export type {
  NetworkLog,
  ConsoleLogPayload,
  InspectorConsoleLog,
} from './types.js';

interface IncomingNetworkPayload extends Partial<NetworkLog> {
  chunk?: {
    index: number;
    data: string;
    timestamp: number;
  };
}

export interface SessionInfo {
  sessionId: string;
  ws: WebSocket;
  lastPing: number;
}

/**
 * DevTools Viewer
 *
 * Receives logs via WebSocket from CLI sessions.
 */
export class DevTools extends EventEmitter {
  private static instance: DevTools | undefined;
  private logs: NetworkLog[] = [];
  private consoleLogs: InspectorConsoleLog[] = [];
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private sessions = new Map<string, SessionInfo>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private port = 25417;
  private static readonly DEFAULT_PORT = 25417;
  private static readonly MAX_PORT_RETRIES = 10;

  // Memory protection: reduced limits to prevent OOM in long-running sessions
  private static readonly MAX_CONSOLE_LOGS = 1000; // Reduced from 5000
  private static readonly MAX_NETWORK_LOGS = 500; // Reduced from 2000
  private static readonly SSE_CLEANUP_TIMEOUT = 5000; // 5s cleanup timeout for SSE connections

  private constructor() {
    super();
    // Each SSE client adds 3 listeners; raise the limit to avoid warnings
    this.setMaxListeners(100);
    // Suppress MaxListenersExceededWarning for debugging
    this.on('error', () => {}); // Ignore EventEmitter errors
  }

  static getInstance(): DevTools {
    if (!DevTools.instance) {
      DevTools.instance = new DevTools();
    }
    return DevTools.instance;
  }

  addInternalConsoleLog(
    payload: ConsoleLogPayload,
    sessionId?: string,
    timestamp?: number,
  ) {
    const entry: InspectorConsoleLog = {
      ...payload,
      id: randomUUID(),
      sessionId,
      timestamp: timestamp || Date.now(),
    };
    this.consoleLogs.push(entry);
    // Memory protection: trim array when exceeding limit
    if (this.consoleLogs.length > DevTools.MAX_CONSOLE_LOGS) {
      const removeCount = this.consoleLogs.length - DevTools.MAX_CONSOLE_LOGS;
      this.consoleLogs.splice(0, removeCount);
    }
    this.emit('console-update', entry);
  }

  addInternalNetworkLog(
    payload: IncomingNetworkPayload,
    sessionId?: string,
    timestamp?: number,
  ) {
    if (!payload.id) return;
    const existingIndex = this.logs.findIndex((l) => l.id === payload.id);
    if (existingIndex > -1) {
      const existing = this.logs[existingIndex];

      // Handle chunk accumulation
      if (payload.chunk) {
        const chunks = existing.chunks || [];
        // Memory protection: limit chunk accumulation
        if (chunks.length >= 100) {
          // Drop oldest chunks if we have too many
          chunks.splice(0, chunks.length - 100);
        }
        chunks.push(payload.chunk);
        this.logs[existingIndex] = {
          ...existing,
          chunks,
          sessionId: sessionId || existing.sessionId,
        };
      } else {
        this.logs[existingIndex] = {
          ...existing,
          ...payload,
          sessionId: sessionId || existing.sessionId,
          // Drop chunks once we have the full response body — the data
          // is redundant and keeping both can blow past V8's string limit
          // when serializing the snapshot.
          chunks: payload.response?.body ? undefined : existing.chunks,
          response: payload.response
            ? { ...existing.response, ...payload.response }
            : existing.response,
        } as NetworkLog;
      }
      this.emit('update', this.logs[existingIndex]);
    } else if (payload.url) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const entry = {
        ...payload,
        sessionId,
        timestamp: timestamp || Date.now(),
        chunks: payload.chunk ? [payload.chunk] : undefined,
      } as NetworkLog;
      this.logs.push(entry);
      // Memory protection: trim array when exceeding limit
      if (this.logs.length > DevTools.MAX_NETWORK_LOGS) {
        const removeCount = this.logs.length - DevTools.MAX_NETWORK_LOGS;
        this.logs.splice(0, removeCount);
      }
      this.emit('update', entry);
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  getPort(): number {
    return this.port;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
      // Reset singleton so a fresh start() is possible
      DevTools.instance = undefined;
    });
  }

  start(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        resolve(this.getUrl());
        return;
      }
      this.server = http.createServer((req, res) => {
        // Only allow same-origin requests — the client is served from this
        // server so cross-origin access is unnecessary and would let arbitrary
        // websites exfiltrate logs (which may contain API keys/headers).
        const origin = req.headers.origin;
        if (origin) {
          const allowed = `http://127.0.0.1:${this.port}`;
          if (origin === allowed) {
            res.setHeader('Access-Control-Allow-Origin', allowed);
          }
        }

        // API routes
        if (req.url === '/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          // Send full snapshot on connect
          const snapshot = JSON.stringify({
            networkLogs: this.logs,
            consoleLogs: this.consoleLogs,
            sessions: Array.from(this.sessions.keys()),
          });
          res.write(`event: snapshot\ndata: ${snapshot}\n\n`);

          // Memory protection: track cleanup state
          let cleanupDone = false;
          let cleanupTimeout: NodeJS.Timeout | null = null;

          // Incremental updates
          const onNetwork = (log: NetworkLog) => {
            res.write(`event: network\ndata: ${JSON.stringify(log)}\n\n`);
          };
          const onConsole = (log: InspectorConsoleLog) => {
            res.write(`event: console\ndata: ${JSON.stringify(log)}\n\n`);
          };
          const onSession = () => {
            const sessions = Array.from(this.sessions.keys());
            res.write(`event: session\ndata: ${JSON.stringify(sessions)}\n\n`);
          };

          // Safe cleanup function that can only be called once
          const cleanup = () => {
            if (cleanupDone) return;
            cleanupDone = true;
            if (cleanupTimeout) {
              clearTimeout(cleanupTimeout);
              cleanupTimeout = null;
            }
            this.off('update', onNetwork);
            this.off('console-update', onConsole);
            this.off('session-update', onSession);
          };

          this.on('update', onNetwork);
          this.on('console-update', onConsole);
          this.on('session-update', onSession);

          // Cleanup on close with timeout protection
          const handleClose = () => {
            cleanup();
          };
          const handleError = () => {
            cleanup();
          };

          req.on('close', handleClose);
          req.on('error', handleError);

          // Memory protection: force cleanup after timeout even if close doesn't fire
          cleanupTimeout = setTimeout(() => {
            cleanup();
          }, DevTools.SSE_CLEANUP_TIMEOUT);

          // Unref timeout to allow process to exit
          cleanupTimeout.unref();
        } else if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(INDEX_HTML);
        } else if (req.url === '/assets/main.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(CLIENT_JS);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      this.server.on('error', (e: unknown) => {
        if (
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          e.code === 'EADDRINUSE'
        ) {
          if (this.port - DevTools.DEFAULT_PORT >= DevTools.MAX_PORT_RETRIES) {
            reject(
              new Error(
                `DevTools: all ports ${DevTools.DEFAULT_PORT}–${this.port} in use`,
              ),
            );
            return;
          }
          this.port++;
          this.server?.listen(this.port, '127.0.0.1');
        } else {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
      this.server.listen(this.port, '127.0.0.1', () => {
        this.setupWebSocketServer();
        resolve(this.getUrl());
      });
    });
  }

  private setupWebSocketServer() {
    if (!this.server) return;

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      let sessionId: string | null = null;
      let cleanupDone = false;
      let connectionTimeout: NodeJS.Timeout | null = null;

      // Memory protection: timeout for unregistered connections
      connectionTimeout = setTimeout(() => {
        if (!sessionId && !cleanupDone) {
          ws.terminate(); // Force close unregistered connections
        }
      }, 60000); // 1 minute timeout for registration
      connectionTimeout.unref();

      const cleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        if (sessionId) {
          this.sessions.delete(sessionId);
          this.emit('session-update');
        }
      };

      ws.on('message', (data: Buffer) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const message = JSON.parse(data.toString());

          // Handle registration first
          if (message.type === 'register') {
            sessionId = String(message.sessionId);
            if (!sessionId) return;

            // Clear registration timeout
            if (connectionTimeout) {
              clearTimeout(connectionTimeout);
              connectionTimeout = null;
            }

            this.sessions.set(sessionId, {
              sessionId,
              ws,
              lastPing: Date.now(),
            });

            // Notify session update
            this.emit('session-update');

            // Send registration acknowledgement
            ws.send(
              JSON.stringify({
                type: 'registered',
                sessionId,
                timestamp: Date.now(),
              }),
            );
          } else if (sessionId) {
            this.handleWebSocketMessage(sessionId, message);
          }
        } catch {
          // Invalid WebSocket message
        }
      });

      ws.on('close', () => {
        cleanup();
      });

      ws.on('error', () => {
        // WebSocket error — cleanup will be handled by close event
      });
    });

    // Heartbeat mechanism
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const sessionsToRemove: string[] = [];

      // First pass: identify stale sessions
      this.sessions.forEach((session, sessionId) => {
        if (now - session.lastPing > 30000) {
          sessionsToRemove.push(sessionId);
        } else {
          // Send ping with error handling
          try {
            if (session.ws.readyState === WebSocket.OPEN) {
              session.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
            }
          } catch {
            // Mark for removal if send fails
            sessionsToRemove.push(sessionId);
          }
        }
      });

      // Second pass: remove stale sessions
      for (const sessionId of sessionsToRemove) {
        const session = this.sessions.get(sessionId);
        if (session) {
          try {
            session.ws.close();
          } catch {
            // Ignore close errors
          }
          this.sessions.delete(sessionId);
        }
      }

      if (sessionsToRemove.length > 0) {
        this.emit('session-update');
      }
    }, 10000);
    this.heartbeatTimer.unref();
  }

  private handleWebSocketMessage(
    sessionId: string,
    message: Record<string, unknown>,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (message['type']) {
      case 'pong':
        session.lastPing = Date.now();
        break;

      case 'console':
        this.addInternalConsoleLog(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          message['payload'] as ConsoleLogPayload,
          sessionId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          message['timestamp'] as number,
        );
        break;

      case 'network':
        this.addInternalNetworkLog(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          message['payload'] as IncomingNetworkPayload,
          sessionId,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          message['timestamp'] as number,
        );
        break;

      default:
        break;
    }
  }
}
