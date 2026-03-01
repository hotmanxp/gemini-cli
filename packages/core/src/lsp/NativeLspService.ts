/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion */

import type { Config as CoreConfig } from '../config/config.js';
import type { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import type { WorkspaceContext } from '../utils/workspaceContext.js';
import type {
  LspCallHierarchyIncomingCall,
  LspCallHierarchyItem,
  LspCallHierarchyOutgoingCall,
  LspCodeAction,
  LspCodeActionContext,
  LspDefinition,
  LspDiagnostic,
  LspFileDiagnostics,
  LspHoverResult,
  LspLocation,
  LspRange,
  LspReference,
  LspSymbolInformation,
  LspTextEdit,
  LspWorkspaceEdit,
  LspConnectionInterface,
  LspServerHandle,
  LspServerStatus,
  NativeLspServiceOptions,
} from './types.js';
import type { EventEmitter } from 'node:events';
import { LspConfigLoader } from './LspConfigLoader.js';
import { LspLanguageDetector } from './LspLanguageDetector.js';
import { LspResponseNormalizer } from './LspResponseNormalizer.js';
import { LspServerManager } from './LspServerManager.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import { debugLogger } from '../utils/debugLogger.js';
import { DEFAULT_LSP_WARMUP_DELAY_MS } from './constants.js';

export class NativeLspService {
  private config: CoreConfig;
  private workspaceContext: WorkspaceContext;
  private fileDiscoveryService: FileDiscoveryService;
  private requireTrustedWorkspace: boolean;
  private workspaceRoot: string;
  private configLoader: LspConfigLoader;
  private serverManager: LspServerManager;
  private languageDetector: LspLanguageDetector;
  private normalizer: LspResponseNormalizer;

  constructor(
    config: CoreConfig,
    workspaceContext: WorkspaceContext,
    _eventEmitter: EventEmitter,
    fileDiscoveryService: FileDiscoveryService,

    options: NativeLspServiceOptions = {},
  ) {
    this.config = config;
    this.workspaceContext = workspaceContext;
    this.fileDiscoveryService = fileDiscoveryService;
    this.requireTrustedWorkspace = options.requireTrustedWorkspace ?? true;
    this.workspaceRoot =
      options.workspaceRoot ??
      (config as { getProjectRoot: () => string }).getProjectRoot();
    this.configLoader = new LspConfigLoader(this.workspaceRoot);
    this.languageDetector = new LspLanguageDetector(
      this.workspaceContext,
      this.fileDiscoveryService,
    );
    this.normalizer = new LspResponseNormalizer();
    this.serverManager = new LspServerManager(
      this.config,
      this.workspaceContext,
      this.fileDiscoveryService,
      {
        requireTrustedWorkspace: this.requireTrustedWorkspace,
        workspaceRoot: this.workspaceRoot,
      },
    );
  }

  /**
   * Discover and prepare LSP servers (lazy loading - don't start yet)
   */
  async discoverAndPrepare(): Promise<void> {
    const workspaceTrusted = this.config.isTrustedFolder();
    this.serverManager.clearServerHandles();

    // Check if workspace is trusted
    if (this.requireTrustedWorkspace && !workspaceTrusted) {
      debugLogger.warn(
        'Workspace is not trusted, skipping LSP server discovery',
      );
      return;
    }

    // Detect languages in workspace (for LSP server configuration)
    const userConfigs = await this.configLoader.loadUserConfigs();
    const extensionConfigs = await this.configLoader.loadExtensionConfigs(
      this.getActiveExtensions(),
    );
    const extensionOverrides =
      this.configLoader.collectExtensionToLanguageOverrides([
        ...extensionConfigs,
        ...userConfigs,
      ]);
    const detectedLanguages =
      await this.languageDetector.detectLanguages(extensionOverrides);

    // Merge configs: built-in presets + extension LSP configs + user .lsp.json
    const serverConfigs = this.configLoader.mergeConfigs(
      detectedLanguages,
      extensionConfigs,
      userConfigs,
    );

    // Only configure servers, don't start them yet (lazy loading)
    this.serverManager.setServerConfigs(serverConfigs);

    // Lightweight check for TypeScript/Python project detection (no full file scan)
    // Only check for project marker files, not individual source files
    const hasTsConfig = fs.existsSync(
      path.join(this.workspaceRoot, 'tsconfig.json'),
    );
    const hasPackageJson = fs.existsSync(
      path.join(this.workspaceRoot, 'package.json'),
    );
    const hasPyProject = fs.existsSync(
      path.join(this.workspaceRoot, 'pyproject.toml'),
    );
    const hasSetupPy = fs.existsSync(path.join(this.workspaceRoot, 'setup.py'));
    const hasRequirements = fs.existsSync(
      path.join(this.workspaceRoot, 'requirements.txt'),
    );

    const shouldWarmupTypescript = hasTsConfig || hasPackageJson;
    const shouldWarmupPython = hasPyProject || hasSetupPy || hasRequirements;

    if (shouldWarmupTypescript) {
      try {
        await this.warmup('typescript');
      } catch (error) {
        debugLogger.warn('TypeScript warmup failed:', error);
      }
    }

    if (shouldWarmupPython) {
      try {
        // Use 'python' as the server name (which maps to pyright-langserver)
        await this.warmup('python');
      } catch (error) {
        debugLogger.warn('Python warmup failed, trying pylsp...', error);
        try {
          await this.warmup('pylsp');
        } catch (pylspError) {
          debugLogger.warn('Both Python LSP servers failed:', pylspError);
        }
      }
    }
  }

  private getActiveExtensions(): any[] {
    const configWithExtensions = this.config as unknown as {
      getActiveExtensions?: () => any[];
    };
    return typeof configWithExtensions.getActiveExtensions === 'function'
      ? configWithExtensions.getActiveExtensions()
      : [];
  }

  /**
   * Start all LSP servers (deprecated - use lazy loading instead)
   * @deprecated Servers are now started on-demand when needed
   */
  async start(): Promise<void> {
    debugLogger.warn(
      'LSP service start() called - lazy loading is now default',
    );
    // Don't start all servers automatically
    // Servers will be started on-demand when tools request them
  }

  /**
   * Start a specific LSP server on-demand
   */
  async startServer(language: string): Promise<void> {
    await this.serverManager.startServerByName(language);
  }

  /**
   * Ensure LSP server is running for a given language
   * This is called lazily when tools need LSP functionality
   */
  async ensureServerRunning(language: string): Promise<void> {
    await this.serverManager.startServerByName(language);
  }

  /**
   * Release reference to LSP server.
   * Called when LSP operation is complete.
   */
  async releaseServer(language: string): Promise<void> {
    await this.serverManager.releaseServer(language);
  }

  /**
   * Stop all LSP servers
   */
  async stop(): Promise<void> {
    await this.serverManager.stopAll();
  }

  /**
   * Get LSP server status
   */
  getStatus(): Map<string, LspServerStatus> {
    return this.serverManager.getStatus();
  }

  /**
   * Get ready server handles filtered by optional server name.
   * Each handle is guaranteed to have a valid connection.
   *
   * @param serverName - Optional server name to filter by
   * @returns Array of [serverName, handle] tuples with active connections
   */
  private getReadyHandles(
    serverName?: string,
  ): Array<[string, LspServerHandle & { connection: LspConnectionInterface }]> {
    const allHandles = Array.from(this.serverManager.getHandles().entries());
    const result = allHandles.filter(
      (
        entry,
      ): entry is [
        string,
        LspServerHandle & { connection: LspConnectionInterface },
      ] =>
        entry[1].status === 'READY' &&
        entry[1].connection !== undefined &&
        (!serverName || entry[0] === serverName),
    );
    return result;
  }

  /**
   * Get a single server handle for a given URI and optional server name.
   *
   * @param uri - The file URI to find a server for
   * @param serverName - Optional specific server name
   * @returns The server handle or null if not found
   */
  private getServerHandle(
    uri: string,
    serverName?: string,
  ): (LspServerHandle & { connection: LspConnectionInterface }) | null {
    const handles = this.getReadyHandles(serverName);
    if (handles.length === 0) {
      return null;
    }
    // Return the first ready handle (or the one matching serverName if provided)
    return handles[0][1];
  }

  /**
   * Open a file in the LSP server to ensure it's tracked for language features.
   * This is necessary for language servers that require files to be opened
   * before they can provide definitions, references, etc.
   *
   * @param handle - The LSP server handle
   * @param uri - The file URI to open
   */
  private async openFileInServer(
    handle: LspServerHandle & { connection: LspConnectionInterface },
    uri: string,
  ): Promise<void> {
    if (!handle.connection || !uri) {
      return;
    }

    try {
      const filePath = fileURLToPath(uri);
      // Check if file exists and is readable
      if (!fs.existsSync(filePath)) {
        return;
      }

      // Determine language ID based on file extension and server type
      const languageId = this.getLanguageIdForFile(uri, handle);
      if (!languageId) {
        return;
      }

      const text = await fs.promises.readFile(filePath, 'utf-8');

      // Send didOpen notification to the LSP server
      handle.connection.send({
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId,
            version: 1,
            text,
          },
        },
      });

      // Wait for the server to process the file
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_LSP_WARMUP_DELAY_MS),
      );
    } catch (error) {
      debugLogger.warn(`Failed to open file in LSP server: ${uri}`, error);
    }
  }

  /**
   * Determine the language ID for a file based on its extension and LSP server type.
   *
   * @param uri - The file URI
   * @param handle - The LSP server handle
   * @returns The language ID or null if not supported
   */
  private getLanguageIdForFile(
    uri: string,
    handle: LspServerHandle,
  ): string | null {
    const ext = path.extname(uri).toLowerCase();

    // TypeScript/JavaScript server
    if (this.serverManager.isTypescriptServer(handle)) {
      if (['.ts', '.mts', '.cts'].includes(ext)) {
        return 'typescript';
      }
      if (['.tsx'].includes(ext)) {
        return 'typescriptreact';
      }
      if (['.js', '.mjs', '.cjs'].includes(ext)) {
        return 'javascript';
      }
      if (['.jsx'].includes(ext)) {
        return 'javascriptreact';
      }
      return null;
    }

    // Python server
    if (this.serverManager.isPythonServer(handle)) {
      if (['.py', '.pyi', '.pyw'].includes(ext)) {
        return 'python';
      }
      return null;
    }

    // Java server (JDTLS)
    if (this.isJavaServer(handle)) {
      if (['.java'].includes(ext)) {
        return 'java';
      }
      return null;
    }

    // Go server (gopls)
    if (this.isGoServer(handle)) {
      if (['.go'].includes(ext)) {
        return 'go';
      }
      return null;
    }

    // Rust server (rust-analyzer)
    if (this.isRustServer(handle)) {
      if (['.rs'].includes(ext)) {
        return 'rust';
      }
      return null;
    }

    // For other servers, try to infer from extension
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.pyi': 'python',
      '.pyw': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sh': 'shellscript',
      '.bash': 'shellscript',
    };

    return languageMap[ext] || null;
  }

  /**
   * Check if the given handle is a Java language server (JDTLS).
   */
  private isJavaServer(handle: LspServerHandle): boolean {
    const command = handle.config.command ?? '';
    return (
      handle.config.name.includes('java') ||
      handle.config.name.includes('jdtls') ||
      command.includes('jdtls') ||
      (command.includes('java') &&
        command.includes('language') &&
        command.includes('server'))
    );
  }

  /**
   * Check if the given handle is a Go language server (gopls).
   */
  private isGoServer(handle: LspServerHandle): boolean {
    const command = handle.config.command ?? '';
    return (
      handle.config.name.includes('go') ||
      handle.config.name.includes('gopls') ||
      command.includes('gopls')
    );
  }

  /**
   * Check if the given handle is a Rust language server (rust-analyzer).
   */
  private isRustServer(handle: LspServerHandle): boolean {
    const command = handle.config.command ?? '';
    return (
      handle.config.name.includes('rust') ||
      handle.config.name.includes('rust-analyzer') ||
      command.includes('rust-analyzer')
    );
  }

  /**
   * Workspace symbol search across all ready LSP servers.
   */
  async workspaceSymbols(
    query: string,
    limit = 50,
  ): Promise<LspSymbolInformation[]> {
    const results: LspSymbolInformation[] = [];

    for (const [serverName, handle] of Array.from(
      this.serverManager.getHandles(),
    )) {
      if (handle.status !== 'READY' || !handle.connection) {
        continue;
      }
      try {
        await this.serverManager.warmupTypescriptServer(handle);
        let response = await handle.connection.request('workspace/symbol', {
          query,
        });
        if (
          this.serverManager.isTypescriptServer(handle) &&
          this.isNoProjectErrorResponse(response)
        ) {
          await this.serverManager.warmupTypescriptServer(handle, true);
          response = await handle.connection.request('workspace/symbol', {
            query,
          });
        }
        if (!Array.isArray(response)) {
          continue;
        }
        for (const item of response) {
          const symbol = this.normalizer.normalizeSymbolResult(
            item,
            serverName,
          );
          if (symbol) {
            results.push(symbol);
          }
          if (results.length >= limit) {
            return results.slice(0, limit);
          }
        }
      } catch (error) {
        debugLogger.warn(
          `LSP workspace/symbol failed for ${serverName}:`,
          error,
        );
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Go to definition
   */
  async definitions(
    location: LspLocation,
    serverName?: string,
    limit = 50,
  ): Promise<LspDefinition[]> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        // Ensure the file is opened in the LSP server before requesting definitions
        await this.openFileInServer(handle, location.uri);
        const response = await handle.connection.request(
          'textDocument/definition',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
          },
        );
        const candidates = Array.isArray(response)
          ? response
          : response
            ? [response]
            : [];
        const definitions: LspDefinition[] = [];
        for (const def of candidates) {
          const normalized = this.normalizer.normalizeLocationResult(def, name);
          if (normalized) {
            definitions.push(normalized);
            if (definitions.length >= limit) {
              return definitions.slice(0, limit);
            }
          }
        }
        if (definitions.length > 0) {
          return definitions.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP textDocument/definition failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Find references
   */
  async references(
    location: LspLocation,
    serverName?: string,
    includeDeclaration = false,
    limit = 200,
  ): Promise<LspReference[]> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        // Ensure the file is opened in the LSP server before requesting references
        await this.openFileInServer(handle, location.uri);
        const response = await handle.connection.request(
          'textDocument/references',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
            context: { includeDeclaration },
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const refs: LspReference[] = [];
        for (const ref of response) {
          const normalized = this.normalizer.normalizeLocationResult(ref, name);
          if (normalized) {
            refs.push(normalized);
          }
          if (refs.length >= limit) {
            return refs.slice(0, limit);
          }
        }
        if (refs.length > 0) {
          return refs.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP textDocument/references failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Get hover information
   */
  async hover(
    location: LspLocation,
    serverName?: string,
  ): Promise<LspHoverResult | null> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        // Ensure the file is opened before requesting hover
        await this.openFileInServer(handle, location.uri);
        const response = await handle.connection.request('textDocument/hover', {
          textDocument: { uri: location.uri },
          position: location.range.start,
        });
        const normalized = this.normalizer.normalizeHoverResult(response, name);
        if (normalized) {
          return normalized;
        }
      } catch (error) {
        debugLogger.warn(`LSP textDocument/hover failed for ${name}:`, error);
      }
    }

    return null;
  }

  /**
   * Get document symbols
   */
  async documentSymbols(
    uri: string,
    serverName?: string,
    limit = 200,
  ): Promise<LspSymbolInformation[]> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        // Open file in LSP server before requesting symbols
        await this.openFileInServer(handle, uri);
        await this.serverManager.warmupTypescriptServer(handle);

        // Small delay to allow LSP server to process the file
        await new Promise((resolve) => setTimeout(resolve, 100));

        const response = await handle.connection.request(
          'textDocument/documentSymbol',
          {
            textDocument: { uri },
          },
        );
        if (!Array.isArray(response)) {
          debugLogger.warn(
            `LSP documentSymbol response is not an array: ${typeof response}`,
          );
          continue;
        }
        const symbols: LspSymbolInformation[] = [];
        for (const item of response) {
          if (!item || typeof item !== 'object') {
            continue;
          }
          const itemObj = item as Record<string, unknown>;
          if (this.normalizer.isDocumentSymbol(itemObj)) {
            this.normalizer.collectDocumentSymbol(
              itemObj,
              uri,
              name,
              symbols,
              limit,
            );
          } else {
            const normalized = this.normalizer.normalizeSymbolResult(
              itemObj,
              name,
            );
            if (normalized) {
              symbols.push(normalized);
            } else {
              debugLogger.warn(
                `Failed to normalize symbol: ${JSON.stringify(itemObj['name'])}`,
              );
            }
          }
          if (symbols.length >= limit) {
            return symbols.slice(0, limit);
          }
        }
        if (symbols.length > 0) {
          return symbols.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP textDocument/documentSymbol failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }
  /**
   * Find implementations
   */
  async implementations(
    location: LspLocation,
    serverName?: string,
    limit = 50,
  ): Promise<LspDefinition[]> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        // Ensure the file is opened in the LSP server before requesting implementations
        await this.openFileInServer(handle, location.uri);
        const response = await handle.connection.request(
          'textDocument/implementation',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
          },
        );
        const candidates = Array.isArray(response)
          ? response
          : response
            ? [response]
            : [];
        const implementations: LspDefinition[] = [];
        for (const item of candidates) {
          const normalized = this.normalizer.normalizeLocationResult(
            item,
            name,
          );
          if (normalized) {
            implementations.push(normalized);
            if (implementations.length >= limit) {
              return implementations.slice(0, limit);
            }
          }
        }
        if (implementations.length > 0) {
          return implementations.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP textDocument/implementation failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Prepare call hierarchy
   */
  async prepareCallHierarchy(
    location: LspLocation,
    serverName?: string,
    limit = 50,
  ): Promise<LspCallHierarchyItem[]> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        await this.serverManager.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'textDocument/prepareCallHierarchy',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
          },
        );
        const candidates = Array.isArray(response)
          ? response
          : response
            ? [response]
            : [];
        const items: LspCallHierarchyItem[] = [];
        for (const item of candidates) {
          const normalized = this.normalizer.normalizeCallHierarchyItem(
            item,
            name,
          );
          if (normalized) {
            items.push(normalized);
            if (items.length >= limit) {
              return items.slice(0, limit);
            }
          }
        }
        if (items.length > 0) {
          return items.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP textDocument/prepareCallHierarchy failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Find callers of the current function
   */
  async incomingCalls(
    item: LspCallHierarchyItem,
    serverName?: string,
    limit = 50,
  ): Promise<LspCallHierarchyIncomingCall[]> {
    const targetServer = serverName ?? item.serverName;
    const handles = this.getReadyHandles(targetServer);

    for (const [name, handle] of handles) {
      try {
        await this.serverManager.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'callHierarchy/incomingCalls',
          {
            item: this.normalizer.toCallHierarchyItemParams(item),
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const calls: LspCallHierarchyIncomingCall[] = [];
        for (const call of response) {
          const normalized = this.normalizer.normalizeIncomingCall(call, name);
          if (normalized) {
            calls.push(normalized);
            if (calls.length >= limit) {
              return calls.slice(0, limit);
            }
          }
        }
        if (calls.length > 0) {
          return calls.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP callHierarchy/incomingCalls failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Find functions called by the current function
   */
  async outgoingCalls(
    item: LspCallHierarchyItem,
    serverName?: string,
    limit = 50,
  ): Promise<LspCallHierarchyOutgoingCall[]> {
    const targetServer = serverName ?? item.serverName;
    const handles = this.getReadyHandles(targetServer);

    for (const [name, handle] of handles) {
      try {
        await this.serverManager.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'callHierarchy/outgoingCalls',
          {
            item: this.normalizer.toCallHierarchyItemParams(item),
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const calls: LspCallHierarchyOutgoingCall[] = [];
        for (const call of response) {
          const normalized = this.normalizer.normalizeOutgoingCall(call, name);
          if (normalized) {
            calls.push(normalized);
            if (calls.length >= limit) {
              return calls.slice(0, limit);
            }
          }
        }
        if (calls.length > 0) {
          return calls.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP callHierarchy/outgoingCalls failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Get diagnostics for a document with wait mechanism.
   * Waits up to 3 seconds for diagnostics to be available.
   */
  async diagnostics(
    uri: string,
    serverName?: string,
  ): Promise<LspDiagnostic[]> {
    const handles = this.getReadyHandles(serverName);
    const allDiagnostics: LspDiagnostic[] = [];

    // Try to get diagnostics immediately
    for (const [name, handle] of handles) {
      try {
        // Ensure the file is opened before requesting diagnostics
        await this.openFileInServer(handle, uri);

        // Request pull diagnostics if the server supports it
        const response = await handle.connection.request(
          'textDocument/diagnostic',
          {
            textDocument: { uri },
          },
        );

        if (response && typeof response === 'object') {
          const responseObj = response as Record<string, unknown>;
          const items = responseObj['items'];
          if (Array.isArray(items)) {
            for (const item of items) {
              const normalized = this.normalizer.normalizeDiagnostic(
                item,
                name,
              );
              if (normalized) {
                allDiagnostics.push(normalized);
              }
            }
          }
        }
      } catch (error) {
        // Fall back to cached diagnostics from publishDiagnostics notifications
        // This is handled by the notification handler if implemented
        debugLogger.warn(
          `LSP textDocument/diagnostic failed for ${name}:`,
          error,
        );
      }
    }

    // If we got diagnostics, return them
    if (allDiagnostics.length > 0) {
      return allDiagnostics;
    }

    // Wait for diagnostics with timeout (3s, 150ms polling)
    const timeout = 3000;
    const pollInterval = 150;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      for (const [name, handle] of handles) {
        try {
          const response = await handle.connection.request(
            'textDocument/diagnostic',
            {
              textDocument: { uri },
            },
          );

          if (response && typeof response === 'object') {
            const responseObj = response as Record<string, unknown>;
            const items = responseObj['items'];
            if (Array.isArray(items) && items.length > 0) {
              allDiagnostics.length = 0; // Clear previous empty results
              for (const item of items) {
                const normalized = this.normalizer.normalizeDiagnostic(
                  item,
                  name,
                );
                if (normalized) {
                  allDiagnostics.push(normalized);
                }
              }
            }
          }
        } catch {
          // Ignore errors during polling
        }
      }

      if (allDiagnostics.length > 0) {
        break;
      }
    }

    return allDiagnostics;
  }

  /**
   * Get diagnostics for all documents in the workspace
   */
  async workspaceDiagnostics(
    serverName?: string,
    limit = 100,
  ): Promise<LspFileDiagnostics[]> {
    const handles = this.getReadyHandles(serverName);
    const results: LspFileDiagnostics[] = [];

    for (const [name, handle] of handles) {
      try {
        await this.serverManager.warmupTypescriptServer(handle);

        // Request workspace diagnostics if supported
        const response = await handle.connection.request(
          'workspace/diagnostic',
          {
            previousResultIds: [],
          },
        );

        if (response && typeof response === 'object') {
          const responseObj = response as Record<string, unknown>;
          const items = responseObj['items'];
          if (Array.isArray(items)) {
            for (const item of items) {
              if (results.length >= limit) {
                break;
              }
              const normalized = this.normalizer.normalizeFileDiagnostics(
                item,
                name,
              );
              if (normalized && normalized.diagnostics.length > 0) {
                results.push(normalized);
              }
            }
          }
        }
      } catch (error) {
        debugLogger.warn(`LSP workspace/diagnostic failed for ${name}:`, error);
      }

      if (results.length >= limit) {
        break;
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get code actions at the specified position
   */
  async codeActions(
    uri: string,
    range: LspRange,
    context: LspCodeActionContext,
    serverName?: string,
    limit = 20,
  ): Promise<LspCodeAction[]> {
    const handles = this.getReadyHandles(serverName);

    for (const [name, handle] of handles) {
      try {
        // Ensure the file is opened before requesting code actions
        await this.openFileInServer(handle, uri);

        // Convert context diagnostics to LSP format
        const lspDiagnostics = context.diagnostics.map((d: LspDiagnostic) =>
          this.normalizer.denormalizeDiagnostic(d),
        );

        const response = await handle.connection.request(
          'textDocument/codeAction',
          {
            textDocument: { uri },
            range,
            context: {
              diagnostics: lspDiagnostics,
              only: context.only,
              triggerKind:
                context.triggerKind === 'automatic'
                  ? 2 // CodeActionTriggerKind.Automatic
                  : 1, // CodeActionTriggerKind.Invoked
            },
          },
        );

        if (!Array.isArray(response)) {
          continue;
        }

        const actions: LspCodeAction[] = [];
        for (const item of response) {
          const normalized = this.normalizer.normalizeCodeAction(item, name);
          if (normalized) {
            actions.push(normalized);
            if (actions.length >= limit) {
              break;
            }
          }
        }

        if (actions.length > 0) {
          return actions.slice(0, limit);
        }
      } catch (error) {
        debugLogger.warn(
          `LSP textDocument/codeAction failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * Apply workspace edit
   */
  async applyWorkspaceEdit(
    edit: LspWorkspaceEdit,
    _serverName?: string,
  ): Promise<boolean> {
    // Apply edits locally - this doesn't go through LSP server
    // Instead, it applies the edits to the file system
    try {
      if (edit.changes) {
        for (const [uri, edits] of Object.entries(edit.changes)) {
          await this.applyTextEdits(uri, edits);
        }
      }

      if (edit.documentChanges) {
        for (const docChange of edit.documentChanges) {
          await this.applyTextEdits(
            docChange.textDocument.uri,
            docChange.edits,
          );
        }
      }

      return true;
    } catch (error) {
      debugLogger.error('Failed to apply workspace edit:', error);
      return false;
    }
  }

  /**
   * Apply text edits to a file
   */
  private async applyTextEdits(
    uri: string,
    edits: LspTextEdit[],
  ): Promise<void> {
    let filePath = uri.startsWith('file://') ? fileURLToPath(uri) : uri;
    if (!path.isAbsolute(filePath)) {
      filePath = path.resolve(this.workspaceRoot, filePath);
    }
    if (!this.workspaceContext.isPathWithinWorkspace(filePath)) {
      throw new Error(`Refusing to apply edits outside workspace: ${filePath}`);
    }

    // Read the current file content
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      // File doesn't exist, treat as empty
      content = '';
    }

    // Sort edits in reverse order to apply from end to start
    const sortedEdits = [...edits].sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return b.range.start.line - a.range.start.line;
      }
      return b.range.start.character - a.range.start.character;
    });

    const lines = content.split('\n');

    for (const edit of sortedEdits) {
      const { range, newText } = edit;
      const startLine = range.start.line;
      const endLine = range.end.line;
      const startChar = range.start.character;
      const endChar = range.end.character;

      // Get the affected lines
      const startLineText = lines[startLine] ?? '';
      const endLineText = lines[endLine] ?? '';

      // Build the new content
      const before = startLineText.slice(0, startChar);
      const after = endLineText.slice(endChar);

      // Replace the range with new text
      const newLines = (before + newText + after).split('\n');

      // Replace affected lines
      lines.splice(startLine, endLine - startLine + 1, ...newLines);
    }

    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  private isNoProjectErrorResponse(response: unknown): boolean {
    if (!response) {
      return false;
    }
    const message =
      typeof response === 'string'
        ? response
        : typeof (response as Record<string, unknown>)['message'] === 'string'
          ? ((response as Record<string, unknown>)['message'] as string)
          : '';
    return message.includes('No Project');
  }

  /**
   * Warm up LSP servers by opening representative files.
   * This triggers language server initialization and project analysis.
   *
   * @param serverName - Optional server name to warm up. If not provided, warms up all servers.
   */
  async warmup(serverName?: string): Promise<void> {
    await this.serverManager.warmupServer(serverName);
  }

  /**
   * Prepare rename operation at a location.
   *
   * @param location - The source location to prepare rename for
   * @param serverName - Optional specific LSP server to query
   * @returns Promise resolving to rename range and placeholder or null if not available
   */
  async prepareRename(
    location: LspLocation,
    serverName?: string,
  ): Promise<{ range: LspRange; placeholder: string } | null> {
    const handle = this.getServerHandle(location.uri, serverName);
    if (!handle?.connection) {
      return null;
    }

    try {
      // Ensure the file is opened and server is ready
      await this.openFileInServer(handle, location.uri);

      const position = location.range.start;
      const response = await handle.connection.request(
        'textDocument/prepareRename',
        {
          textDocument: { uri: location.uri },
          position,
        },
      );

      if (!response || typeof response !== 'object') {
        return null;
      }

      const result = response as {
        range?: LspRange;
        placeholder?: string;
      } | null;
      if (!result?.range || !result?.placeholder) {
        return null;
      }

      return {
        range: result.range,
        placeholder: result.placeholder,
      };
    } catch (error) {
      debugLogger.warn('Prepare rename failed:', error);
      return null;
    }
  }

  /**
   * Rename a symbol at a location to a new name.
   *
   * @param location - The source location to rename
   * @param newName - The new name for the symbol
   * @param serverName - Optional specific LSP server to query
   * @returns Promise resolving to workspace edit or null if rename failed
   */
  async rename(
    location: LspLocation,
    newName: string,
    serverName?: string,
  ): Promise<LspWorkspaceEdit | null> {
    const handle = this.getServerHandle(location.uri, serverName);
    if (!handle?.connection) {
      return null;
    }

    try {
      // Ensure the file is opened and server is ready
      await this.openFileInServer(handle, location.uri);

      const position = location.range.start;
      const response = await handle.connection.request('textDocument/rename', {
        textDocument: { uri: location.uri },
        position,
        newName,
      });

      if (!response || typeof response !== 'object') {
        return null;
      }

      return response as LspWorkspaceEdit;
    } catch (error) {
      debugLogger.warn('Rename failed:', error);
      return null;
    }
  }
}
