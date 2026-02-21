/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LspClient } from './LspClient.js';
import { LspServerManager } from './LspServerManager.js';
import { getLanguageConfigById, getLanguageConfig } from './languages.js';
import type { TextDocumentItem, Diagnostic } from './types.js';
import { debugLogger } from '../../utils/debugLogger.js';

interface DocumentState {
  item: TextDocumentItem;
  version: number;
  content: string;
}

/**
 * LSP service
 * Provides a unified LSP functionality interface
 */
export class LspService {
  private manager: LspServerManager;
  private documents = new Map<string, DocumentState>();
  private diagnostics = new Map<string, Diagnostic[]>();

  constructor() {
    this.manager = new LspServerManager(LspClient);
  }

  /**
   * Start a language LSP server
   */
  async startLanguage(
    languageId: string,
    workspaceRoot: string,
  ): Promise<boolean> {
    const config = getLanguageConfigById(languageId);
    if (!config) return false;
    try {
      await this.manager.startServer(config, workspaceRoot);
      return true;
    } catch (err) {
      debugLogger.debug(`Failed to start LSP server for ${languageId}:`, err);
      return false;
    }
  }

  /**
   * Auto-start language based on file path
   */
  async autoStartLanguage(
    filePath: string,
    workspaceRoot: string,
  ): Promise<boolean> {
    const config = getLanguageConfig(filePath);
    if (!config) return false;
    if (this.manager.isServerRunning(config.languageId)) return true;
    try {
      await this.manager.startServer(config, workspaceRoot);
      return true;
    } catch (err) {
      debugLogger.debug(
        `Failed to start LSP server for ${config.languageId}:`,
        err,
      );
      return false;
    }
  }

  /**
   * Open a document
   */
  async openDocument(
    uri: string,
    languageId: string,
    content: string,
  ): Promise<void> {
    const client = this.manager.getClient(languageId);
    if (!client) return;
    const version = 1;
    const item: TextDocumentItem = { uri, languageId, version, text: content };
    this.documents.set(uri, { item, version, content });
    client.didOpen({ textDocument: item });
  }

  /**
   * Update document content
   */
  async updateDocument(uri: string, content: string): Promise<void> {
    const doc = this.documents.get(uri);
    if (!doc) return;
    const client = this.manager.getClient(doc.item.languageId);
    if (!client) return;
    doc.version++;
    const lines = doc.content.split('\n');
    const contentChanges = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: {
            line: lines.length - 1,
            character: lines[lines.length - 1]?.length || 0,
          },
        },
        text: content,
      },
    ];
    client.didChange({
      textDocument: { uri, version: doc.version },
      contentChanges,
    });
    doc.content = content;
  }

  /**
   * Close a document
   */
  async closeDocument(uri: string): Promise<void> {
    const doc = this.documents.get(uri);
    if (!doc) return;
    const client = this.manager.getClient(doc.item.languageId);
    if (client) client.didClose({ textDocument: { uri } });
    this.documents.delete(uri);
    this.diagnostics.delete(uri);
  }

  /**
   * Get code completions
   */
  async getCompletion(
    uri: string,
    line: number,
    column: number,
  ): Promise<unknown[] | null> {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    const client = this.manager.getClient(doc.item.languageId);
    if (!client) return null;
    try {
      const result = await client.completion({
        textDocument: { uri },
        position: { line, character: column },
      });
      if (!result) return null;
      return Array.isArray(result) ? result : (result as any).items;
    } catch (err) {
      debugLogger.debug('Completion error:', err);
      return null;
    }
  }

  /**
   * Go to definition
   */
  async goToDefinition(
    uri: string,
    line: number,
    column: number,
  ): Promise<unknown[] | null> {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    const client = this.manager.getClient(doc.item.languageId);
    if (!client) return null;
    try {
      const result = await client.definition({
        textDocument: { uri },
        position: { line, character: column },
      });
      if (!result) return null;
      return Array.isArray(result) ? result : [result];
    } catch (err) {
      debugLogger.debug('Definition error:', err);
      return null;
    }
  }

  /**
   * Find references
   */
  async findReferences(
    uri: string,
    line: number,
    column: number,
  ): Promise<unknown[] | null> {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    const client = this.manager.getClient(doc.item.languageId);
    if (!client) return null;
    try {
      const result = await client.references({
        textDocument: { uri },
        position: { line, character: column },
        context: { includeDeclaration: true },
      });
      return result || null;
    } catch (err) {
      debugLogger.debug('References error:', err);
      return null;
    }
  }

  /**
   * Get hover information
   */
  async getHover(
    uri: string,
    line: number,
    column: number,
  ): Promise<string | null> {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    const client = this.manager.getClient(doc.item.languageId);
    if (!client) return null;
    try {
      const result = await client.hover({
        textDocument: { uri },
        position: { line, character: column },
      });
      if (!result || !result.contents) return null;
      if (typeof result.contents === 'string') return result.contents;
      if ('value' in result.contents) return result.contents.value;
      if (Array.isArray(result.contents)) {
        return result.contents.map((c: any) => c.value || '').join('\n');
      }
      return null;
    } catch (err) {
      debugLogger.debug('Hover error:', err);
      return null;
    }
  }

  /**
   * Get diagnostics for a document
   */
  getDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) || [];
  }

  /**
   * Stop a language LSP server
   */
  async stopLanguage(languageId: string): Promise<void> {
    return this.manager.stopServer(languageId);
  }

  /**
   * Shutdown all LSP servers
   */
  async shutdown(): Promise<void> {
    await this.manager.shutdown();
    this.documents.clear();
    this.diagnostics.clear();
  }

  /**
   * Get active languages
   */
  getActiveLanguages(): string[] {
    return this.manager.getActiveLanguages();
  }

  /**
   * Check if a language is running
   */
  isLanguageRunning(languageId: string): boolean {
    return this.manager.isServerRunning(languageId);
  }
}
