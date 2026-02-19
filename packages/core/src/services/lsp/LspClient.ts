/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  InitializeParams,
  InitializeResult,
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  CompletionParams,
  CompletionList,
  DefinitionParams,
  Location,
  ReferenceParams,
  HoverParams,
  Hover,
  PublishDiagnosticsParams,
  ServerCapabilities,
} from './types.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  method: string;
  timestamp: number;
}

interface LspClientEventMap {
  notification: [method: string, params: unknown];
  diagnostics: [params: PublishDiagnosticsParams];
  error: [error: Error];
  exit: [code: number | null, signal: string | null];
}

export class LspClient extends EventEmitter<LspClientEventMap> {
  private process: ChildProcess | null = null;
  private buffer = '';
  private requestId = 0;
  private pendingRequests = new Map<number | string, PendingRequest>();
  private initialized = false;
  private serverCapabilities?: ServerCapabilities;

  async start(command: string, args: string[], env?: Record<string, string>): Promise<void> {
    const { spawn } = await import('node:child_process');
    return new Promise((resolve, reject) => {
      this.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...env },
      });
      if (!this.process.stdin || !this.process.stdout) {
        reject(new Error('Failed to spawn LSP process'));
        return;
      }
      this.process.on('error', (err) => { this.emit('error', err); reject(err); });
      this.process.on('exit', (code, signal) => { this.emit('exit', code, signal); this.cleanup(); });
      this.process.stdout.on('data', (data: Buffer) => { this.handleData(data.toString()); });
      this.process.stderr?.on('data', (data: Buffer) => { console.error('[LSP stderr]', data.toString()); });
      setTimeout(() => { if (this.process) resolve(); }, 100);
    });
  }

  private handleData(data: string): void {
    this.buffer += data;
    while (true) {
      const headerEnd = this.buffer.indexOf('\\r\\n\\r\\n');
      if (headerEnd === -1) break;
      const headerSection = this.buffer.substring(0, headerEnd);
      const contentLengthMatch = headerSection.match(/Content-Length: (\\d+)/);
      if (!contentLengthMatch) { this.buffer = this.buffer.substring(headerEnd + 4); continue; }
      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (this.buffer.length < bodyEnd) break;
      const body = this.buffer.substring(bodyStart, bodyEnd);
      this.buffer = this.buffer.substring(bodyEnd);
      try { const message = JSON.parse(body); this.handleMessage(message); } catch (err) { console.error('Failed to parse LSP message:', err); }
    }
  }

  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    if ('id' in message && message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if ('error' in message && message.error) { pending.reject(new Error(message.error.message)); }
        else { pending.resolve(message.result); }
      }
    } else if ('method' in message) {
      this.emit('notification', message.method, message.params);
      if (message.method === 'textDocument/publishDiagnostics') {
        this.emit('diagnostics', message.params as PublishDiagnosticsParams);
      }
    }
  }

  private async sendRequest<T>(method: string, params?: unknown, timeout = 30000): Promise<T> {
    if (!this.process?.stdin) throw new Error('LSP process not started');
    const id = ++this.requestId;
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => { this.pendingRequests.delete(id); reject(new Error('Request timed out')); }, timeout);
      this.pendingRequests.set(id, { resolve: (value) => { clearTimeout(timeoutId); resolve(value as T); }, reject, method, timestamp: Date.now() });
      const content = JSON.stringify(request);
      const header = 'Content-Length: ' + Buffer.byteLength(content) + '\\r\\n\\r\\n';
      if (this.process?.stdin) {
        this.process.stdin.write(header + content);
      } else {
        reject(new Error('LSP process not started'));
      }
    });
  }

  private sendNotification(method: string, params?: unknown): void {
    if (!this.process?.stdin) throw new Error('LSP process not started');
    const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    const content = JSON.stringify(notification);
    const header = 'Content-Length: ' + Buffer.byteLength(content) + '\\r\\n\\r\\n';
    this.process.stdin.write(header + content);
  }

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    const result = await this.sendRequest<InitializeResult>('initialize', params);
    this.serverCapabilities = result.capabilities;
    this.sendNotification('initialized');
    this.initialized = true;
    return result;
  }

  didOpen(params: DidOpenTextDocumentParams): void { this.sendNotification('textDocument/didOpen', params); }
  didChange(params: DidChangeTextDocumentParams): void { this.sendNotification('textDocument/didChange', params); }
  didClose(params: DidCloseTextDocumentParams): void { this.sendNotification('textDocument/didClose', params); }

  async completion(params: CompletionParams): Promise<CompletionList | null> {
    if (!this.initialized) throw new Error('LSP not initialized');
    return this.sendRequest('textDocument/completion', params);
  }

  async definition(params: DefinitionParams): Promise<Location | Location[] | null> {
    if (!this.initialized) throw new Error('LSP not initialized');
    return this.sendRequest('textDocument/definition', params);
  }

  async references(params: ReferenceParams): Promise<Location[] | null> {
    if (!this.initialized) throw new Error('LSP not initialized');
    return this.sendRequest('textDocument/references', params);
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    if (!this.initialized) throw new Error('LSP not initialized');
    return this.sendRequest('textDocument/hover', params);
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    try { await this.sendRequest('shutdown'); this.sendNotification('exit'); } catch (err) { console.error('Error during LSP shutdown:', err); }
    finally { this.dispose(); }
  }

  private cleanup(): void {
    this.pendingRequests.forEach((pending) => { pending.reject(new Error('LSP process exited')); });
    this.pendingRequests.clear();
    this.initialized = false;
  }

  dispose(): void {
    if (this.process) { this.process.kill(); this.process = null; }
    this.cleanup();
    this.buffer = '';
  }

  getCapabilities(): ServerCapabilities | undefined { return this.serverCapabilities; }
  isInitialized(): boolean { return this.initialized; }
}
