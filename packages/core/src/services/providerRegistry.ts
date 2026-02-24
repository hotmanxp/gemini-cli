/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Model limit configuration
 */
export interface ModelLimit {
  context: number;
  output: number;
}

/**
 * Model variant configuration
 */
export interface ModelVariant {
  disabled?: boolean;
  [key: string]: unknown;
}

/**
 * Model configuration within a provider
 */
export interface ProviderModel {
  name?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  attachment?: boolean;
  temperature?: boolean;
  interleaved?: boolean;
  limit?: ModelLimit;
  description?: string;
  variants?: Record<string, ModelVariant>;
}

/**
 * Provider configuration matching opencode schema
 */
export interface Provider {
  name?: string;
  npm?: string;
  api?: string;
  env: string[];
  whitelist?: string[];
  blacklist?: string[];
  models?: Record<string, ProviderModel>;
  options?: {
    apiKey?: string;
    baseURL?: string;
    enterpriseUrl?: string;
    setCacheKey?: boolean;
    timeout?: number | false;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
}

/**
 * All providers configuration
 */
export interface ProvidersConfig {
  [providerId: string]: Provider;
}

import { debugLogger } from '../utils/debugLogger.js';
import * as fs from 'node:fs';

/**
 * ProviderRegistry manages provider configurations from settings
 */
export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  /**
   * Load providers from configuration file
   */
  async loadFromConfig(configPath?: string): Promise<void> {
    this.providers.clear();

    if (!configPath) {
      debugLogger.debug('[ProviderRegistry] No config path provided');
      return;
    }

    try {
      if (!fs.existsSync(configPath)) {
        debugLogger.debug(
          `[ProviderRegistry] Config file not found: ${configPath}`,
        );
        return;
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      if (config.provider) {
        // Single provider format (opencode compatible)
        for (const [providerId, providerConfig] of Object.entries(
          config.provider,
        )) {
          this.providers.set(providerId, providerConfig as Provider);
          debugLogger.debug(
            `[ProviderRegistry] Loaded provider: ${providerId}`,
          );
        }
      } else if (config.providers) {
        // Providers object format
        for (const [providerId, providerConfig] of Object.entries(
          config.providers,
        )) {
          this.providers.set(providerId, providerConfig as Provider);
          debugLogger.debug(
            `[ProviderRegistry] Loaded provider: ${providerId}`,
          );
        }
      }

      debugLogger.debug(
        `[ProviderRegistry] Loaded ${this.providers.size} provider(s)`,
      );
    } catch (error) {
      debugLogger.error(
        '[ProviderRegistry] Failed to load providers:',
        error,
      );
      throw new Error(
        `Failed to load provider configuration: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get all registered providers
   */
  getProviders(): Map<string, Provider> {
    return new Map(this.providers);
  }

  /**
   * Get a specific provider by ID
   */
  getProvider(providerId: string): Provider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all models from all providers
   * Returns map of modelId -> { provider, model }
   */
  getAllModels(): Map<
    string,
    { provider: string; model: ProviderModel; providerConfig: Provider }
  > {
    const models = new Map<
      string,
      { provider: string; model: ProviderModel; providerConfig: Provider }
    >();

    for (const [providerId, provider] of this.providers.entries()) {
      if (provider.models) {
        for (const [modelId, modelConfig] of Object.entries(provider.models)) {
          const fullModelId = `${providerId}/${modelId}`;
          models.set(fullModelId, {
            provider: providerId,
            model: modelConfig,
            providerConfig: provider,
          });
        }
      }
    }

    return models;
  }

  /**
   * Get a specific model from a provider
   */
  getModel(
    providerId: string,
    modelId: string,
  ): { model: ProviderModel; provider: Provider } | undefined {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.models) {
      return undefined;
    }

    const model = provider.models[modelId];
    if (!model) {
      return undefined;
    }

    return { model, provider };
  }

  /**
   * Parse provider/model format
   */
  parseModelIdentifier(
    identifier: string,
  ): { provider: string; model: string } | { model: string } {
    const parts = identifier.split('/');
    if (parts.length >= 2) {
      return {
        provider: parts[0],
        model: parts.slice(1).join('/'),
      };
    }
    return { model: identifier };
  }

  /**
   * Check if a model identifier is in provider/model format
   */
  isProviderModelFormat(identifier: string): boolean {
    return identifier.includes('/');
  }

  /**
   * Validate if a model exists in provider configuration
   */
  validateModel(identifier: string): boolean {
    const parsed = this.parseModelIdentifier(identifier);
    if ('provider' in parsed) {
      const result = this.getModel(parsed.provider, parsed.model);
      return !!result;
    }
    return false;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

// Export singleton instance for convenience
export const providerRegistry = new ProviderRegistry();
