/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import type { Config as CoreConfig } from '../config/config.js';
import type { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import type { WorkspaceContext } from '../utils/workspaceContext.js';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { globSync } from 'glob';
import { LspConnectionFactory } from './LspConnectionFactory.js';
import {
  DEFAULT_LSP_INIT_TIMEOUT_MS,
  DEFAULT_LSP_IDLE_TIMEOUT_MS,
  DEFAULT_LSP_MAX_RESTARTS,
  DEFAULT_LSP_SOCKET_MAX_RETRY_DELAY_MS,
  DEFAULT_LSP_SOCKET_RETRY_DELAY_MS,
  DEFAULT_LSP_STARTUP_TIMEOUT_MS,
  DEFAULT_LSP_WARMUP_DELAY_MS,
} from './constants.js';
import type {
  LspConnectionResult,
  LspServerConfig,
  LspServerHandle,
  LspServerStatus,
  LspSocketOptions,
} from './types.js';
import { debugLogger } from '../utils/debugLogger.js';
import {
  tryAutoInstallLspServer,
  getInstallationHint,
} from './LspInstaller.js';
import { spawnJdtls, checkJavaPrerequisites } from './jdtls.js';

/**
 * Get environment variable safely
 */
function getEnvVar(name: string): string | undefined {
  return process.env[name as keyof typeof process.env];
}

export interface LspServerManagerOptions {
  requireTrustedWorkspace: boolean;
  workspaceRoot: string;
}

export class LspServerManager {
  private serverHandles: Map<string, LspServerHandle> = new Map();
  private idleTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private requireTrustedWorkspace: boolean;
  private workspaceRoot: string;

  constructor(
    private readonly config: CoreConfig,
    private readonly workspaceContext: WorkspaceContext,
    private readonly fileDiscoveryService: FileDiscoveryService,
    options: LspServerManagerOptions,
  ) {
    this.requireTrustedWorkspace = options.requireTrustedWorkspace;
    this.workspaceRoot = options.workspaceRoot;
    this.startIdleCleanupTimer();
  }

  setServerConfigs(configs: LspServerConfig[]): void {
    this.serverHandles.clear();
    const now = Date.now();
    for (const config of configs) {
      this.serverHandles.set(config.name, {
        config,
        status: 'NOT_STARTED',
        refCount: 0,
        isInitializing: false,
        lastUsedAt: now,
      });
    }
  }

  clearServerHandles(): void {
    this.serverHandles.clear();
  }

  getHandles(): ReadonlyMap<string, LspServerHandle> {
    return this.serverHandles;
  }

  getStatus(): Map<string, LspServerStatus> {
    const statusMap = new Map<string, LspServerStatus>();
    for (const [name, handle] of Array.from(this.serverHandles)) {
      statusMap.set(name, handle.status);
    }
    return statusMap;
  }

  /**
   * Start all LSP servers (deprecated)
   * @deprecated Use startServer for on-demand loading
   */
  async startAll(): Promise<void> {
    debugLogger.warn(
      'startAll() is deprecated - use startServer(language) for lazy loading',
    );
    for (const [name, handle] of Array.from(this.serverHandles)) {
      await this.doStartServer(name, handle);
    }
  }

  /**
   * Start a specific LSP server by name (public API for lazy loading).
   * Implements race condition prevention with initialization locks.
   */
  async startServerByName(name: string): Promise<void> {
    const serverHandle = this.serverHandles.get(name);
    if (!serverHandle) {
      const message = `LSP server "${name}" is not configured. This usually means the required language server is not installed. Please install the LSP server for this language.`;
      debugLogger.error(message);
      throw new Error(message);
    }

    const now = Date.now();

    // Check if already initializing
    if (serverHandle.isInitializing && serverHandle.initPromise) {
      // Check for timeout
      if (
        serverHandle.initializingSince &&
        now - serverHandle.initializingSince > DEFAULT_LSP_INIT_TIMEOUT_MS
      ) {
        // Initialization timeout - cleanup and retry
        debugLogger.warn(
          `LSP server ${name} initialization timeout, restarting...`,
        );
        await this.cleanupFailedInitialization(serverHandle);
      } else {
        // Wait for existing initialization
        try {
          await serverHandle.initPromise;
          serverHandle.refCount++;
          serverHandle.lastUsedAt = Date.now();
          return;
        } catch (_error) {
          // Initialization failed - cleanup and retry
          debugLogger.warn(
            `LSP server ${name} initialization failed, retrying...`,
          );
          await this.cleanupFailedInitialization(serverHandle);
        }
      }
    }

    // Check if server is already running
    if (serverHandle.status === 'READY' && serverHandle.connection) {
      serverHandle.refCount++;
      serverHandle.lastUsedAt = now;
      return;
    }

    // Check if server previously failed to start
    if (serverHandle.status === 'FAILED') {
      const errorMessage = serverHandle.error?.message || 'Unknown error';
      const message = `LSP server "${name}" failed to start: ${errorMessage}. Please check if the required language server is installed and properly configured.`;
      debugLogger.error(message);
      throw new Error(message);
    }

    // Start new initialization with lock
    await this.initializeServerWithLock(name, serverHandle);
  }

  /**
   * Initialize server with proper locking to prevent race conditions.
   */
  private async initializeServerWithLock(
    name: string,
    handle: LspServerHandle,
  ): Promise<void> {
    const now = Date.now();

    // Set initialization lock
    handle.isInitializing = true;
    handle.initializingSince = now;
    handle.refCount = 1;
    handle.lastUsedAt = now;

    const initPromise = this.doStartServer(name, handle);
    handle.initPromise = initPromise;

    try {
      await initPromise;
      // Initialization successful - clear lock
      handle.isInitializing = false;
      handle.initPromise = undefined;
      handle.initializingSince = undefined;
    } catch (error) {
      // Initialization failed - cleanup state
      handle.isInitializing = false;
      handle.initPromise = undefined;
      handle.initializingSince = undefined;
      handle.refCount = 0;
      debugLogger.error(`LSP server ${name} initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Cleanup failed initialization state.
   */
  private async cleanupFailedInitialization(
    handle: LspServerHandle,
  ): Promise<void> {
    handle.isInitializing = false;
    handle.initPromise = undefined;
    handle.initializingSince = undefined;
    handle.refCount = 0;
    handle.lastUsedAt = Date.now();

    // Stop any existing connection
    if (handle.connection || handle.process) {
      try {
        await this.stopServer('', handle);
      } catch {
        // Ignore stop errors during cleanup
      }
    }
  }

  /**
   * Get server handle by name
   */
  getServerHandle(name: string): LspServerHandle | undefined {
    return this.serverHandles.get(name);
  }

  /**
   * Release reference to LSP server.
   * Called when LSP operation is complete.
   */
  async releaseServer(name: string): Promise<void> {
    const handle = this.serverHandles.get(name);
    if (!handle) {
      debugLogger.warn(`LSP server ${name} not found for release`);
      return;
    }

    if (handle.refCount > 0) {
      handle.refCount--;
      handle.lastUsedAt = Date.now();
    }
  }

  /**
   * Start idle cleanup timer to automatically stop unused servers.
   */
  private startIdleCleanupTimer(): void {
    setInterval(() => {
      this.cleanupIdleServers();
    }, 60000); // Check every minute
  }

  /**
   * Clean up servers that have been idle for too long.
   */
  private cleanupIdleServers(): void {
    const now = Date.now();

    for (const [name, handle] of this.serverHandles) {
      // Skip servers that are initializing
      if (handle.isInitializing) continue;

      // Skip servers that are still in use
      if (handle.refCount > 0) continue;

      // Check if idle timeout exceeded
      if (now - handle.lastUsedAt > DEFAULT_LSP_IDLE_TIMEOUT_MS) {
        void this.stopServer(name, handle);
      }
    }
  }

  /**
   * Stop all LSP servers
   */
  async stopAll(): Promise<void> {
    for (const [name, handle] of Array.from(this.serverHandles)) {
      await this.stopServer(name, handle);
    }
    this.serverHandles.clear();
    this.clearAllIdleTimeouts();
  }

  /**
   * Clear all idle timeouts.
   */
  private clearAllIdleTimeouts(): void {
    for (const timeout of this.idleTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.idleTimeouts.clear();
  }

  /**
   * Reset the idle timeout for a server.
   * Called after each server request to track activity.
   */
  private resetIdleTimeout(serverName: string): void {
    // Clear existing timeout
    const existingTimeout = this.idleTimeouts.get(serverName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      const handle = this.serverHandles.get(serverName);
      if (handle && handle.status === 'READY') {
        void this.stopServer(serverName, handle);
      }
      this.idleTimeouts.delete(serverName);
    }, DEFAULT_LSP_IDLE_TIMEOUT_MS);

    this.idleTimeouts.set(serverName, timeout);
  }

  /**
   * Ensure tsserver has at least one file open so navto/navtree requests succeed.
   * Sets warmedUp flag only after successful warm-up to allow retry on failure.
   */
  async warmupTypescriptServer(
    handle: LspServerHandle,
    force = false,
  ): Promise<void> {
    if (!handle.connection || !this.isTypescriptServer(handle)) {
      return;
    }
    if (handle.warmedUp && !force) {
      return;
    }
    const tsFile = this.findFirstTypescriptFile();
    if (!tsFile) {
      return;
    }

    const uri = pathToFileURL(tsFile).toString();
    const languageId = tsFile.endsWith('.tsx')
      ? 'typescriptreact'
      : tsFile.endsWith('.jsx')
        ? 'javascriptreact'
        : tsFile.endsWith('.js')
          ? 'javascript'
          : 'typescript';
    try {
      const text = fs.readFileSync(tsFile, 'utf-8');
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
      // Give tsserver a moment to build the project.
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_LSP_WARMUP_DELAY_MS),
      );
      // Only mark as warmed up after successful completion
      handle.warmedUp = true;
    } catch (error) {
      // Do not set warmedUp to true on failure, allowing retry
      debugLogger.warn('TypeScript server warm-up failed:', error);
    }
  }

  /**
   * Ensure Python language server has at least one file open so it can analyze the project.
   * Detects virtual environment and sets pythonPath if found.
   * Sets warmedUp flag only after successful warm-up to allow retry on failure.
   */
  async warmupPythonServer(
    handle: LspServerHandle,
    force = false,
  ): Promise<void> {
    if (!handle.connection || !this.isPythonServer(handle)) {
      return;
    }
    if (handle.warmedUp && !force) {
      return;
    }

    // Detect Python virtual environment (reference: OpenCode)
    const potentialVenvPaths = [
      (process.env as Record<string, string>)['VIRTUAL_ENV'],
      path.join(this.workspaceRoot, '.venv'),
      path.join(this.workspaceRoot, 'venv'),
    ].filter((p): p is string => p !== undefined);

    for (const venvPath of potentialVenvPaths) {
      const isWindows = process.platform === 'win32';
      const potentialPythonPath = isWindows
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python');

      if (await this.checkFileExists(potentialPythonPath)) {
        // Update initialization options with detected pythonPath
        if (handle.config.initializationOptions) {
          (handle.config.initializationOptions as Record<string, unknown>)[
            'pythonPath'
          ] = potentialPythonPath;
        }
        break;
      }
    }

    const pyFile = this.findFirstPythonFile();
    if (!pyFile) {
      return;
    }

    const uri = pathToFileURL(pyFile).toString();
    const languageId = 'python';
    try {
      const text = fs.readFileSync(pyFile, 'utf-8');
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
      // Give Python language server a moment to analyze the project.
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_LSP_WARMUP_DELAY_MS),
      );
      // Only mark as warmed up after successful completion
      handle.warmedUp = true;
    } catch (error) {
      // Do not set warmedUp to true on failure, allowing retry
      debugLogger.warn('Python server warm-up failed:', error);
    }
  }

  /**
   * Check if the given handle is a TypeScript language server.
   *
   * @param handle - The LSP server handle
   * @returns true if it's a TypeScript server
   */
  isTypescriptServer(handle: LspServerHandle): boolean {
    return (
      handle.config.name.includes('typescript') ||
      (handle.config.command?.includes('typescript') ?? false)
    );
  }

  /**
   * Check if the given handle is a Python language server.
   *
   * @param handle - The LSP server handle
   * @returns true if it's a Python server
   */
  isPythonServer(handle: LspServerHandle): boolean {
    return (
      handle.config.name.includes('python') ||
      handle.config.name.includes('pylsp') ||
      handle.config.name.includes('pyright') ||
      (handle.config.command?.includes('python') ?? false) ||
      (handle.config.command?.includes('pylsp') ?? false) ||
      (handle.config.command?.includes('pyright') ?? false)
    );
  }

  /**
   * Check if the given config is the Java language server (JDTLS).
   */
  private isJdtlsServer(config: LspServerConfig): boolean {
    return (
      config.name.includes('jdtls') ||
      config.name.includes('java') ||
      config.command === 'java'
    );
  }

  /**
   * Warm up a specific LSP server or all servers if no name is provided.
   * This is the public API for manual warmup.
   * First ensures the server is started, then performs warmup.
   *
   * @param serverName - Optional server name to warm up. If not provided, warms up all servers.
   */
  async warmupServer(serverName?: string): Promise<void> {
    if (serverName) {
      // First ensure server is started
      await this.startServerByName(serverName);

      const handle = this.serverHandles.get(serverName);
      if (handle) {
        await this.warmupServerHandle(handle);
      } else {
        debugLogger.warn(`LSP server "${serverName}" not found for warmup`);
      }
    } else {
      // Warm up all configured servers
      for (const [name, handle] of this.serverHandles) {
        if (handle.status !== 'READY') {
          await this.startServerByName(name);
        }
        await this.warmupServerHandle(handle);
      }
    }
  }

  /**
   * Internal method to warm up a single server handle.
   */
  private async warmupServerHandle(handle: LspServerHandle): Promise<void> {
    if (!handle.connection) {
      return;
    }

    if (this.isTypescriptServer(handle)) {
      await this.warmupTypescriptServer(handle, true);
    } else if (this.isPythonServer(handle)) {
      await this.warmupPythonServer(handle, true);
    }
    // Other language servers can be added here as needed
  }

  /**
   * Start individual LSP server with lock to prevent concurrent startup attempts.
   *
   * @param name - The name of the LSP server
   * @param handle - The LSP server handle
   */
  private async startServer(
    name: string,
    handle: LspServerHandle,
  ): Promise<void> {
    // If already starting, wait for the existing promise
    if (handle.startingPromise) {
      return handle.startingPromise;
    }

    if (handle.status === 'IN_PROGRESS' || handle.status === 'READY') {
      return;
    }
    handle.stopRequested = false;

    // Create a promise to lock concurrent calls
    handle.startingPromise = this.doStartServer(name, handle).finally(() => {
      handle.startingPromise = undefined;
    });

    return handle.startingPromise;
  }

  /**
   * Internal method that performs the actual server startup.
   *
   * @param name - The name of the LSP server
   * @param handle - The LSP server handle
   */
  private async doStartServer(
    name: string,
    handle: LspServerHandle,
  ): Promise<void> {
    const workspaceTrusted = this.config.isTrustedFolder();
    if (
      (this.requireTrustedWorkspace || handle.config.trustRequired) &&
      !workspaceTrusted
    ) {
      debugLogger.warn(
        `LSP server ${name} requires trusted workspace, skipping startup`,
      );
      handle.status = 'FAILED';
      return;
    }

    // Request user confirmation
    const consent = await this.requestUserConsent(
      name,
      handle.config,
      workspaceTrusted,
    );
    if (!consent) {
      debugLogger.log(`User declined to start LSP server ${name}`);
      handle.status = 'FAILED';
      return;
    }

    // Special handling for JDTLS (Java Language Server)
    if (this.isJdtlsServer(handle.config)) {
      debugLogger.log('Starting JDTLS (Java Language Server)...');
      // Check Java prerequisites
      const javaCheck = await checkJavaPrerequisites(21);
      if (!javaCheck.available) {
        const message = `JDTLS requires Java 21+: ${javaCheck.error}. Please install Java 21 or newer and ensure it's in your PATH.`;
        debugLogger.error(message);
        handle.status = 'FAILED';
        handle.error = new Error(message);
        throw new Error(message);
      }
      debugLogger.log(`Java version: ${javaCheck.version}`);

      try {
        handle.error = undefined;
        handle.warmedUp = false;
        handle.status = 'IN_PROGRESS';

        // Use spawnJdtls to download and start JDTLS
        const jdtlsResult = await spawnJdtls(
          handle.config.workspaceFolder ?? this.workspaceRoot,
        );

        if (!jdtlsResult) {
          const message =
            'Failed to spawn JDTLS process. Please check if release.tar.gz is downloaded to ~/.gemini/lsp-servers/jdtls/ or check your network connection.';
          throw new Error(message);
        }

        handle.process = jdtlsResult.process;
        handle.connection = undefined; // Will be set by createLspConnection

        // Create LSP connection using the JDTLS process
        const connection = await this.createLspConnectionFromProcess(
          jdtlsResult.process,
          handle.config,
        );
        handle.connection = connection.connection;

        // Initialize LSP server
        await this.initializeLspServer(connection, handle.config);

        handle.status = 'READY';
        this.attachRestartHandler(name, handle);
        this.resetIdleTimeout(name);
        debugLogger.log('JDTLS started successfully');
        return;
      } catch (error) {
        handle.status = 'FAILED';
        handle.error = error as Error;
        debugLogger.error('JDTLS failed to start:', error);
        throw error;
      }
    }

    // Check if command exists (for other servers)
    if (handle.config.command) {
      const commandCwd = handle.config.workspaceFolder ?? this.workspaceRoot;

      // Try to check if command exists
      const commandExists = await this.commandExists(handle.config.command);

      // If command not found, try auto-install (only for npm-based servers)
      if (!commandExists) {
        const autoInstallServers = [
          'typescript-language-server',
          'vue-language-server',
          'svelteserver',
          'yaml-language-server',
          'bash-language-server',
          'sql-language-server',
          'markdownlint',
          'vscode-json-languageserver',
          'css-languageserver',
          'html-languageserver',
          'pyright-langserver',
          'pylsp',
          'ruff',
          'intelephense',
          'astro-ls',
          'docker-langserver',
          'vscode-eslint-language-server',
          'oxlint',
          'biome',
        ];

        const shouldTryInstall = autoInstallServers.some(
          (server) =>
            handle.config.command &&
            (handle.config.command.includes(server) ||
              server.includes(handle.config.command)),
        );

        if (shouldTryInstall) {
          debugLogger.log(
            `LSP server ${name} command '${handle.config.command}' not found, attempting auto-install...`,
          );

          const installResult = await tryAutoInstallLspServer(
            name,
            handle.config.command,
          );

          if (installResult.installed) {
            debugLogger.log(`Successfully auto-installed LSP server ${name}`);
            // Re-check command after install
            const commandNowExists = await this.commandExists(
              handle.config.command,
            );
            if (commandNowExists) {
              // Continue with server startup
            } else {
              debugLogger.warn(
                `LSP server ${name} installed but command still not found`,
              );
              handle.status = 'FAILED';
              return;
            }
          } else {
            const hint = getInstallationHint(name);
            debugLogger.warn(
              `Failed to auto-install LSP server ${name}. ${installResult.error ?? ''}\nPlease install manually: ${hint}`,
            );
            handle.status = 'FAILED';
            return;
          }
        } else {
          debugLogger.warn(
            `LSP server ${name} command not found: ${handle.config.command}. ${getInstallationHint(name)}`,
          );
          handle.status = 'FAILED';
          return;
        }
      }

      // Check path safety
      if (
        !this.isPathSafe(handle.config.command, this.workspaceRoot, commandCwd)
      ) {
        debugLogger.warn(
          `LSP server ${name} command path is unsafe: ${handle.config.command}`,
        );
        handle.status = 'FAILED';
        return;
      }
    }

    try {
      handle.error = undefined;
      handle.warmedUp = false;
      handle.status = 'IN_PROGRESS';

      // Create LSP connection
      const connection = await this.createLspConnection(handle.config);
      handle.connection = connection.connection;
      handle.process = connection.process;

      // Initialize LSP server
      await this.initializeLspServer(connection, handle.config);

      handle.status = 'READY';
      this.attachRestartHandler(name, handle);
      this.resetIdleTimeout(name); // Start idle timeout when server is ready
      debugLogger.log(`LSP server ${name} started successfully`);
    } catch (error) {
      handle.status = 'FAILED';
      handle.error = error as Error;
      debugLogger.error(`LSP server ${name} failed to start:`, error);
    }
  }

  /**
   * Stop individual LSP server
   */
  private async stopServer(
    name: string,
    handle: LspServerHandle,
  ): Promise<void> {
    handle.stopRequested = true;

    // Clear idle timeout
    const idleTimeout = this.idleTimeouts.get(name);
    if (idleTimeout) {
      clearTimeout(idleTimeout);
      this.idleTimeouts.delete(name);
    }

    if (handle.connection) {
      try {
        await this.shutdownConnection(handle);
      } catch (error) {
        debugLogger.error(`Error closing LSP server ${name}:`, error);
      }
    } else if (handle.process && handle.process.exitCode === null) {
      handle.process.kill();
    }
    handle.connection = undefined;
    handle.process = undefined;
    handle.status = 'NOT_STARTED';
    handle.warmedUp = false;
    handle.restartAttempts = 0;
  }

  private async shutdownConnection(handle: LspServerHandle): Promise<void> {
    if (!handle.connection) {
      return;
    }
    try {
      const shutdownPromise = handle.connection.shutdown();
      if (typeof handle.config.shutdownTimeout === 'number') {
        await Promise.race([
          shutdownPromise,
          new Promise<void>((resolve) =>
            setTimeout(resolve, handle.config.shutdownTimeout),
          ),
        ]);
      } else {
        await shutdownPromise;
      }
    } finally {
      handle.connection.end();
    }
  }

  private attachRestartHandler(name: string, handle: LspServerHandle): void {
    if (!handle.process) {
      return;
    }
    handle.process.once('exit', (code) => {
      if (handle.stopRequested) {
        return;
      }
      if (!handle.config.restartOnCrash) {
        handle.status = 'FAILED';
        return;
      }
      const maxRestarts = handle.config.maxRestarts ?? DEFAULT_LSP_MAX_RESTARTS;
      if (maxRestarts <= 0) {
        handle.status = 'FAILED';
        return;
      }
      const attempts = handle.restartAttempts ?? 0;
      if (attempts >= maxRestarts) {
        debugLogger.warn(
          `LSP server ${name} reached max restart attempts (${maxRestarts}), stopping restarts`,
        );
        handle.status = 'FAILED';
        return;
      }
      handle.restartAttempts = attempts + 1;
      debugLogger.warn(
        `LSP server ${name} exited (code ${code ?? 'unknown'}), restarting (${handle.restartAttempts}/${maxRestarts})`,
      );
      this.resetHandle(handle);
      void this.startServer(name, handle);
    });
  }

  private resetHandle(handle: LspServerHandle): void {
    if (handle.connection) {
      handle.connection.end();
    }
    if (handle.process && handle.process.exitCode === null) {
      handle.process.kill();
    }
    handle.connection = undefined;
    handle.process = undefined;
    handle.status = 'NOT_STARTED';
    handle.error = undefined;
    handle.warmedUp = false;
    handle.stopRequested = false;
  }

  private buildProcessEnv(
    env: Record<string, string> | undefined,
  ): NodeJS.ProcessEnv | undefined {
    if (!env || Object.keys(env).length === 0) {
      return undefined;
    }
    return { ...process.env, ...env };
  }

  private async connectSocketWithRetry(
    socket: LspSocketOptions,
    timeoutMs: number,
  ): Promise<
    Awaited<ReturnType<typeof LspConnectionFactory.createSocketConnection>>
  > {
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error('LSP server connection timeout');
      }
      try {
        return await LspConnectionFactory.createSocketConnection(
          socket,
          remaining,
        );
      } catch (error) {
        attempt += 1;
        if (Date.now() >= deadline) {
          throw error;
        }
        const delay = Math.min(
          DEFAULT_LSP_SOCKET_RETRY_DELAY_MS * attempt,
          DEFAULT_LSP_SOCKET_MAX_RETRY_DELAY_MS,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create LSP connection
   */
  private async createLspConnection(
    config: LspServerConfig,
  ): Promise<LspConnectionResult> {
    const workspaceFolder = config.workspaceFolder ?? this.workspaceRoot;
    const startupTimeout =
      config.startupTimeout ?? DEFAULT_LSP_STARTUP_TIMEOUT_MS;
    const env = this.buildProcessEnv(config.env);

    if (config.transport === 'stdio') {
      if (!config.command) {
        throw new Error('LSP stdio transport requires a command');
      }

      // Fix: use cwd as cwd instead of rootUri
      const lspConnection = await LspConnectionFactory.createStdioConnection(
        config.command,
        config.args ?? [],
        { cwd: workspaceFolder, env },
        startupTimeout,
      );

      return {
        connection: lspConnection.connection,
        process: lspConnection.process as ChildProcess,
        shutdown: async () => {
          await lspConnection.connection.shutdown();
        },
        exit: () => {
          if (lspConnection.process && !lspConnection.process.killed) {
            lspConnection.process.kill();
          }
          lspConnection.connection.end();
        },
        initialize: async (params: unknown) =>
          lspConnection.connection.initialize(params),
      };
    } else if (config.transport === 'tcp' || config.transport === 'socket') {
      if (!config.socket) {
        throw new Error('LSP socket transport requires host/port or path');
      }

      let process: ChildProcess | undefined;
      if (config.command) {
        process = spawn(config.command, config.args ?? [], {
          cwd: workspaceFolder,
          env,
          stdio: 'ignore',
        });
        await new Promise<void>((resolve, reject) => {
          process?.once('spawn', () => resolve());
          process?.once('error', (error) => {
            reject(new Error(`Failed to spawn LSP server: ${error.message}`));
          });
        });
      }

      try {
        const lspConnection = await this.connectSocketWithRetry(
          config.socket,
          startupTimeout,
        );

        return {
          connection: lspConnection.connection,
          process,
          shutdown: async () => {
            await lspConnection.connection.shutdown();
          },
          exit: () => {
            lspConnection.connection.end();
          },
          initialize: async (params: unknown) =>
            lspConnection.connection.initialize(params),
        };
      } catch (error) {
        if (process && process.exitCode === null) {
          process.kill();
        }
        throw error;
      }
    } else {
      throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  /**
   * Create LSP connection from an existing process (used by JDTLS)
   */
  private async createLspConnectionFromProcess(
    process: ChildProcess,
    config: LspServerConfig,
  ): Promise<LspConnectionResult> {
    const startupTimeout =
      config.startupTimeout ?? DEFAULT_LSP_STARTUP_TIMEOUT_MS;

    const lspConnection =
      await LspConnectionFactory.createStdioConnectionFromProcess(
        process as import('node:child_process').ChildProcessWithoutNullStreams,
        startupTimeout,
      );

    return {
      connection: lspConnection.connection,
      process,
      shutdown: async () => {
        await lspConnection.connection.shutdown();
      },
      exit: () => {
        if (process && !process.killed) {
          process.kill();
        }
        lspConnection.connection.end();
      },
      initialize: async (params: unknown) =>
        lspConnection.connection.initialize(params),
    };
  }

  /**
   * Initialize LSP server
   */
  private async initializeLspServer(
    connection: LspConnectionResult,
    config: LspServerConfig,
  ): Promise<void> {
    const workspaceFolderPath = config.workspaceFolder ?? this.workspaceRoot;
    const workspaceFolder = {
      name: path.basename(workspaceFolderPath) || workspaceFolderPath,
      uri: config.rootUri,
    };

    const initializeParams = {
      processId: process.pid,
      rootUri: config.rootUri,
      rootPath: workspaceFolderPath,
      workspaceFolders: [workspaceFolder],
      capabilities: {
        textDocument: {
          completion: { dynamicRegistration: true },
          hover: { dynamicRegistration: true },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          documentSymbol: { dynamicRegistration: true },
          codeAction: { dynamicRegistration: true },
        },
        workspace: {
          workspaceFolders: { supported: true },
        },
      },
      initializationOptions: config.initializationOptions,
    };

    await connection.initialize(initializeParams);

    // Send initialized notification and workspace folders change to help servers (e.g. tsserver)
    // create projects in the correct workspace.
    connection.connection.send({
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    });
    connection.connection.send({
      jsonrpc: '2.0',
      method: 'workspace/didChangeWorkspaceFolders',
      params: {
        event: {
          added: [workspaceFolder],
          removed: [],
        },
      },
    });

    if (config.settings && Object.keys(config.settings).length > 0) {
      connection.connection.send({
        jsonrpc: '2.0',
        method: 'workspace/didChangeConfiguration',
        params: {
          settings: config.settings,
        },
      });
    }

    // Warm up TypeScript server by opening a workspace file so it can create a project.
    if (
      config.name.includes('typescript') ||
      (config.command?.includes('typescript') ?? false)
    ) {
      try {
        const tsFile = this.findFirstTypescriptFile();
        if (tsFile) {
          const uri = pathToFileURL(tsFile).toString();
          const languageId = tsFile.endsWith('.tsx')
            ? 'typescriptreact'
            : 'typescript';
          const text = fs.readFileSync(tsFile, 'utf-8');
          connection.connection.send({
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
        }
      } catch (error) {
        debugLogger.warn('TypeScript LSP warm-up failed:', error);
      }
    }
  }

  /**
   * Check if command exists
   */
  private async commandExists(command: string): Promise<boolean> {
    // First check if command is in PATH
    const inPath = await this.checkCommandInPath(command);
    if (inPath) {
      debugLogger.log(`Command ${command} found in PATH`);
      return true;
    }

    // Also check in global bin directory
    const globalBinCommand = path.join(
      getEnvVar('HOME') ?? getEnvVar('USERPROFILE') ?? '',
      '.gemini',
      'lsp-servers',
      'bin',
      command,
    );
    const globalBinCommandExists = await this.checkFileExists(globalBinCommand);
    if (globalBinCommandExists) {
      debugLogger.log(
        `Command ${command} found in global bin: ${globalBinCommand}`,
      );
      return true;
    }

    debugLogger.warn(`Command ${command} not found in PATH or global bin`);
    return false;
  }

  private async checkCommandInPath(command: string): Promise<boolean> {
    const pathEnv = getEnvVar('PATH') ?? '';
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const paths = pathEnv.split(pathSeparator);

    const isWindows = process.platform === 'win32';
    const extensions = isWindows ? ['', '.exe', '.cmd', '.bat'] : [''];

    for (const p of paths) {
      for (const ext of extensions) {
        const fullPath = path.join(p, command + ext);
        if (await this.checkFileExists(fullPath)) {
          return true;
        }
      }
    }

    return false;
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check path safety
   */
  private isPathSafe(
    command: string,
    workspacePath: string,
    cwd?: string,
  ): boolean {
    // Allow commands without path separators (global PATH commands like 'typescript-language-server')
    // These are resolved by the shell from PATH and are generally safe
    if (!command.includes(path.sep) && !command.includes('/')) {
      return true;
    }

    // For explicit paths (absolute or relative), verify they're within workspace
    const resolvedWorkspacePath = path.resolve(workspacePath);
    const basePath = cwd ? path.resolve(cwd) : resolvedWorkspacePath;
    const resolvedPath = path.isAbsolute(command)
      ? path.resolve(command)
      : path.resolve(basePath, command);

    return (
      resolvedPath.startsWith(resolvedWorkspacePath + path.sep) ||
      resolvedPath === resolvedWorkspacePath
    );
  }

  /**
   * 请求用户确认启动 LSP 服务器
   */
  private async requestUserConsent(
    serverName: string,
    serverConfig: LspServerConfig,
    workspaceTrusted: boolean,
  ): Promise<boolean> {
    if (workspaceTrusted) {
      return true; // Auto-allow in trusted workspace
    }

    if (this.requireTrustedWorkspace || serverConfig.trustRequired) {
      debugLogger.warn(
        `Workspace not trusted, skipping LSP server ${serverName} (${serverConfig.command ?? serverConfig.transport})`,
      );
      return false;
    }

    debugLogger.log(
      `Untrusted workspace, but LSP server ${serverName} has trustRequired=false, attempting cautious startup`,
    );
    return true;
  }

  /**
   * Find a representative TypeScript/JavaScript file to warm up tsserver.
   */
  private findFirstTypescriptFile(): string | undefined {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
    ];

    for (const root of this.workspaceContext.getDirectories()) {
      for (const pattern of patterns) {
        try {
          const matches = globSync(pattern, {
            cwd: root,
            ignore: excludePatterns,
            absolute: true,
            nodir: true,
          });
          for (const file of matches) {
            if (this.fileDiscoveryService.shouldIgnoreFile(file)) {
              continue;
            }
            return file;
          }
        } catch (_error) {
          // ignore glob errors
        }
      }
    }

    return undefined;
  }

  /**
   * Find a representative Python file to warm up Python language server.
   */
  private findFirstPythonFile(): string | undefined {
    const patterns = ['**/*.py'];
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/*.pyc',
      '**/.venv/**',
      '**/venv/**',
    ];

    for (const root of this.workspaceContext.getDirectories()) {
      for (const pattern of patterns) {
        try {
          const matches = globSync(pattern, {
            cwd: root,
            ignore: excludePatterns,
            absolute: true,
            nodir: true,
          });
          for (const file of matches) {
            if (this.fileDiscoveryService.shouldIgnoreFile(file)) {
              continue;
            }
            return file;
          }
        } catch (_error) {
          // ignore glob errors
        }
      }
    }

    return undefined;
  }
}
