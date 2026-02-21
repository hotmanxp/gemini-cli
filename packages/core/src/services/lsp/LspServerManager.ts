/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LspClient } from './LspClient.js';
import type { LspServerConfig, InitializeParams } from './types.js';

interface LspServerInstance {
  config: LspServerConfig;
  client: LspClient;
  workspaceRoot: string;
}

export class LspServerManager {
  private servers = new Map<string, LspServerInstance>();
  private LspClientClass: typeof LspClient;

  constructor(LspClientClass: typeof LspClient) {
    this.LspClientClass = LspClientClass;
  }

  async startServer(
    config: LspServerConfig,
    workspaceRoot: string,
    clientInfo: { name: string; version?: string } = { name: 'gemini-cli' }
  ): Promise<void> {
    const key = config.languageId;
    if (this.servers.has(key)) {
      await this.stopServer(config.languageId);
    }
    const client = new this.LspClientClass();
    await client.start(config.command, config.args, config.env);
    const initParams: InitializeParams = {
      processId: process.pid,
      clientInfo,
      rootUri: `file://${workspaceRoot}`,
      rootPath: workspaceRoot,
      capabilities: {
        textDocument: {
          synchronization: { dynamicRegistration: false, didSave: true },
          completion: { dynamicRegistration: false, completionItem: { snippetSupport: true } },
          hover: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
        },
        workspace: { workspaceFolders: true },
      },
      workspaceFolders: [{ uri: `file://${workspaceRoot}`, name: 'workspace' }],
    };
    await client.initialize(initParams);
    this.servers.set(key, { config, client, workspaceRoot });
  }

  async stopServer(languageId: string): Promise<void> {
    const server = this.servers.get(languageId);
    if (server) {
      await server.client.shutdown();
      this.servers.delete(languageId);
    }
  }

  getClient(languageId: string): LspClient | null {
    const server = this.servers.get(languageId);
    return server?.client ?? null;
  }

  getClientForFile(filePath: string): { client: LspClient; config: LspServerConfig } | null {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const keys = Array.from(this.servers.keys());
    for (const languageId of keys) {
      const server = this.servers.get(languageId)!;
      if (server.config.extensions.includes(ext)) {
        return { client: server.client, config: server.config };
      }
    }
    return null;
  }

  getActiveLanguages(): string[] {
    return Array.from(this.servers.keys());
  }

  isServerRunning(languageId: string): boolean {
    return this.servers.has(languageId);
  }

  async shutdown(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    this.servers.forEach((_, languageId) => {
      promises.push(this.stopServer(languageId));
    });
    await Promise.all(promises);
  }
}
