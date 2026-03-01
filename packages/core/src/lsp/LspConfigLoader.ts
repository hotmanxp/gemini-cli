/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  LspInitializationOptions,
  LspServerConfig,
  LspSocketOptions,
} from './types.js';
import { debugLogger } from '../utils/debugLogger.js';
import { getBuiltinServerConfig } from './builtinServers.js';
import { parse as parseJsonc } from 'jsonc-parser';

/**
 * Replace template variables in a string.
 */
function hydrateString(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\$\{([^}]+)\}/g,
    (_match, key) => variables[key] ?? _match,
  );
}

/**
 * Recursively hydrate JSON values with template variables.
 */
function hydrateJsonValue(
  value: unknown,
  variables: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    return hydrateString(value, variables);
  }
  if (Array.isArray(value)) {
    return value.map((item) => hydrateJsonValue(item, variables));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = hydrateJsonValue(val, variables);
    }
    return result;
  }
  return value;
}

export class LspConfigLoader {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Load user LSP configuration from .lsp.json or .lsp.jsonc files.
   * Supports JSONC format (allows comments and trailing commas).
   */
  async loadUserConfigs(): Promise<LspServerConfig[]> {
    // Try .lsp.jsonc first (supports comments), then fall back to .lsp.json
    const lspJsoncPath = path.join(this.workspaceRoot, '.lsp.jsonc');
    const lspJsonPath = path.join(this.workspaceRoot, '.lsp.json');

    let configPath: string | null = null;
    let configContent: string | null = null;

    if (fs.existsSync(lspJsoncPath)) {
      configPath = lspJsoncPath;
      try {
        const rawContent = fs.readFileSync(lspJsoncPath, 'utf-8');
        configContent = JSON.stringify(parseJsonc(rawContent));
      } catch (error) {
        debugLogger.warn('Failed to parse .lsp.jsonc config:', error);
      }
    }

    if (!configContent && fs.existsSync(lspJsonPath)) {
      configPath = lspJsonPath;
      try {
        configContent = fs.readFileSync(lspJsonPath, 'utf-8');
      } catch (error) {
        debugLogger.warn('Failed to read .lsp.json config:', error);
      }
    }

    if (!configContent || !configPath) {
      return [];
    }

    try {
      const data = JSON.parse(configContent) as unknown;
      return this.parseConfigSource(data, configPath);
    } catch (_error) {
      debugLogger.warn(`Failed to parse LSP config from ${configPath}:`);
      return [];
    }
  }

  /**
   * Load LSP configurations declared by extensions (Claude plugins).
   */
  async loadExtensionConfigs(
    _extensions: unknown[],
  ): Promise<LspServerConfig[]> {
    const configs: LspServerConfig[] = [];

    for (const extension of _extensions) {
      const extRecord = extension as Record<string, unknown>;
      const extConfig = extRecord['config'] as
        | Record<string, unknown>
        | undefined;
      const lspServers = extConfig?.['lspServers'];
      if (!lspServers) {
        continue;
      }

      const originBase = `extension ${String(extRecord['name'] ?? 'unknown')}`;
      if (typeof lspServers === 'string') {
        const configPath = this.resolveExtensionConfigPath(
          String(extRecord['path'] ?? ''),
          lspServers,
        );
        if (!fs.existsSync(configPath)) {
          debugLogger.warn(
            `LSP config not found for ${originBase}: ${configPath}`,
          );
          continue;
        }

        try {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const data = JSON.parse(configContent) as unknown;
          const hydrated = this.hydrateExtensionLspConfig(
            data,
            String(extRecord['path'] ?? ''),
          );
          configs.push(
            ...this.parseConfigSource(
              hydrated,
              `${originBase} (${configPath})`,
            ),
          );
        } catch (_error) {
          debugLogger.warn(
            `Failed to load extension LSP config from ${configPath}:`,
          );
        }
      } else if (this.isRecord(lspServers)) {
        const hydrated = this.hydrateExtensionLspConfig(
          lspServers,
          String(extRecord['path'] ?? ''),
        );
        configs.push(
          ...this.parseConfigSource(hydrated, `${originBase} (lspServers)`),
        );
      } else {
        debugLogger.warn(
          `LSP config for ${originBase} must be an object or a JSON file path.`,
        );
      }
    }

    return configs;
  }

  /**
   * Merge configs: built-in presets + extension configs + user configs
   */
  mergeConfigs(
    detectedLanguages: string[],
    extensionConfigs: LspServerConfig[],
    userConfigs: LspServerConfig[],
  ): LspServerConfig[] {
    // Built-in preset configurations
    const presets = this.getBuiltInPresets(detectedLanguages);

    // Merge configs, user configs take priority
    const mergedConfigs = [...presets];

    const applyConfigs = (configs: LspServerConfig[]) => {
      for (const config of configs) {
        // Find if there's a preset with the same name, if so replace it
        const existingIndex = mergedConfigs.findIndex(
          (c) => c.name === config.name,
        );
        if (existingIndex !== -1) {
          mergedConfigs[existingIndex] = config;
        } else {
          mergedConfigs.push(config);
        }
      }
    };

    applyConfigs(extensionConfigs);
    applyConfigs(userConfigs);

    return mergedConfigs;
  }

  collectExtensionToLanguageOverrides(
    configs: LspServerConfig[],
  ): Record<string, string> {
    const overrides: Record<string, string> = {};
    for (const config of configs) {
      if (!config.extensionToLanguage) {
        continue;
      }
      for (const [key, value] of Object.entries(config.extensionToLanguage)) {
        if (typeof value !== 'string') {
          continue;
        }
        const normalized = key.startsWith('.') ? key.slice(1) : key;
        if (!normalized) {
          continue;
        }
        overrides[normalized.toLowerCase()] = value;
      }
    }
    return overrides;
  }

  /**
   * Get built-in preset configurations based on detected languages.
   * Supports 40+ languages from builtinServers.ts.
   */
  private getBuiltInPresets(detectedLanguages: string[]): LspServerConfig[] {
    const presets: LspServerConfig[] = [];

    // Convert directory path to file URI format
    const rootUri = pathToFileURL(this.workspaceRoot).toString();

    // Generate corresponding LSP server config based on detected languages
    for (const language of detectedLanguages) {
      const config = getBuiltinServerConfig(language);
      if (!config) {
        continue;
      }

      // Merge with detected language info
      config.rootUri = rootUri;
      config.workspaceFolder = this.workspaceRoot;

      presets.push(config);
    }

    return presets;
  }

  /**
   * Parse configuration source and extract server configs.
   * Expects basic format keyed by language identifier.
   */
  private parseConfigSource(
    source: unknown,
    origin: string,
  ): LspServerConfig[] {
    if (!this.isRecord(source)) {
      return [];
    }

    const configs: LspServerConfig[] = [];

    for (const [key, spec] of Object.entries(source)) {
      if (!this.isRecord(spec)) {
        continue;
      }

      // In basic format: key is language name, server name comes from command.
      const languages = [key];
      const name = typeof spec['command'] === 'string' ? spec['command'] : key;

      const config = this.buildServerConfig(name, languages, spec, origin);
      if (config) {
        configs.push(config);
      }
    }

    return configs;
  }

  private resolveExtensionConfigPath(
    extensionPath: string,
    configPath: string,
  ): string {
    return path.isAbsolute(configPath)
      ? path.resolve(configPath)
      : path.resolve(extensionPath, configPath);
  }

  private hydrateExtensionLspConfig(
    source: unknown,
    extensionPath: string,
  ): unknown {
    const variables: Record<string, string> = {
      extensionPath,
      CLAUDE_PLUGIN_ROOT: extensionPath,
      workspacePath: this.workspaceRoot,
      '/': path.sep,
      pathSeparator: path.sep,
    };
    return hydrateJsonValue(source, variables);
  }

  private buildServerConfig(
    name: string,
    languages: string[],
    spec: Record<string, unknown>,
    origin: string,
  ): LspServerConfig | null {
    const transport = this.normalizeTransport(spec['transport']);
    const command =
      typeof spec['command'] === 'string' ? spec['command'] : undefined;
    const args = this.normalizeStringArray(spec['args']) ?? [];
    const env = this.normalizeEnv(spec['env']);
    const initializationOptions = this.isRecord(spec['initializationOptions'])
      ? (spec['initializationOptions'] as LspInitializationOptions)
      : undefined;
    const settings = this.isRecord(spec['settings'])
      ? spec['settings']
      : undefined;
    const extensionToLanguage = this.normalizeExtensionToLanguage(
      spec['extensionToLanguage'],
    );
    const workspaceFolder = this.resolveWorkspaceFolder(
      spec['workspaceFolder'],
    );
    const rootUri = pathToFileURL(workspaceFolder).toString();
    const startupTimeout = this.normalizeTimeout(spec['startupTimeout']);
    const shutdownTimeout = this.normalizeTimeout(spec['shutdownTimeout']);
    const restartOnCrash =
      typeof spec['restartOnCrash'] === 'boolean'
        ? spec['restartOnCrash']
        : undefined;
    const maxRestarts = this.normalizeMaxRestarts(spec['maxRestarts']);
    const trustRequired =
      typeof spec['trustRequired'] === 'boolean' ? spec['trustRequired'] : true;
    const socket = this.normalizeSocketOptions(spec);

    if (transport === 'stdio' && !command) {
      debugLogger.warn(
        `LSP config error in ${origin}: ${name} missing command`,
      );
      return null;
    }

    if (transport !== 'stdio' && !socket) {
      debugLogger.warn(
        `LSP config error in ${origin}: ${name} missing socket info`,
      );
      return null;
    }

    return {
      name,
      languages,
      command,
      args,
      transport,
      env,
      initializationOptions,
      settings,
      extensionToLanguage,
      rootUri,
      workspaceFolder,
      startupTimeout,
      shutdownTimeout,
      restartOnCrash,
      maxRestarts,
      trustRequired,
      socket,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private normalizeEnv(value: unknown): Record<string, string> | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }
    const env: Record<string, string> = {};
    for (const [key, val] of Object.entries(value)) {
      if (
        typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean'
      ) {
        env[key] = String(val);
      }
    }
    return Object.keys(env).length > 0 ? env : undefined;
  }

  private normalizeExtensionToLanguage(
    value: unknown,
  ): Record<string, string> | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }
    const mapping: Record<string, string> = {};
    for (const [key, lang] of Object.entries(value)) {
      if (typeof lang !== 'string') {
        continue;
      }
      const normalized = key.startsWith('.') ? key.slice(1) : key;
      if (!normalized) {
        continue;
      }
      mapping[normalized.toLowerCase()] = lang;
    }
    return Object.keys(mapping).length > 0 ? mapping : undefined;
  }

  private normalizeTransport(value: unknown): 'stdio' | 'tcp' | 'socket' {
    if (typeof value !== 'string') {
      return 'stdio';
    }
    const normalized = value.toLowerCase();
    if (normalized === 'tcp' || normalized === 'socket') {
      return normalized;
    }
    return 'stdio';
  }

  private normalizeTimeout(value: unknown): number | undefined {
    if (typeof value !== 'number') {
      return undefined;
    }
    if (!Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return value;
  }

  private normalizeMaxRestarts(value: unknown): number | undefined {
    if (typeof value !== 'number') {
      return undefined;
    }
    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return value;
  }

  private normalizeSocketOptions(
    value: Record<string, unknown>,
  ): LspSocketOptions | undefined {
    const socketValue = value['socket'];
    if (typeof socketValue === 'string') {
      return { path: socketValue };
    }

    const source = this.isRecord(socketValue) ? socketValue : value;
    const host =
      typeof source['host'] === 'string' ? source['host'] : undefined;
    const pathValue =
      typeof source['path'] === 'string'
        ? source['path']
        : typeof source['socketPath'] === 'string'
          ? source['socketPath']
          : undefined;
    const portValue = source['port'];
    const port =
      typeof portValue === 'number'
        ? portValue
        : typeof portValue === 'string'
          ? Number(portValue)
          : undefined;

    const socket: LspSocketOptions = {};
    if (host) {
      socket.host = host;
    }
    if (Number.isFinite(port) && (port as number) > 0) {
      socket.port = port as number;
    }
    if (pathValue) {
      socket.path = pathValue;
    }

    if (!socket.path && !socket.port) {
      return undefined;
    }
    return socket;
  }

  private resolveWorkspaceFolder(value: unknown): string {
    if (typeof value !== 'string' || value.trim() === '') {
      return this.workspaceRoot;
    }

    const resolved = path.isAbsolute(value)
      ? path.resolve(value)
      : path.resolve(this.workspaceRoot, value);
    const root = path.resolve(this.workspaceRoot);

    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return resolved;
    }

    debugLogger.warn(
      `LSP workspaceFolder must be within ${this.workspaceRoot}; using workspace root instead.`,
    );
    return this.workspaceRoot;
  }
}
