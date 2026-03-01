/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import OpenAI from 'openai';
import { OpenAIContentGenerator } from './openaiContentGenerator/index.js';
import { type Config } from '../config/config.js';
import { AuthType } from './contentGenerator.js';
import type { OpenAIContentGeneratorConfig } from './openaiContentGenerator/types.js';
import { debugLogger } from '../utils/debugLogger.js';
import type { Provider, ProviderModel } from '../services/providerRegistry.js';

/**
 * Generic Provider Content Generator that works with any OpenAI-compatible provider
 * configured in settings.json
 */
export class ProviderContentGenerator extends OpenAIContentGenerator {
  private providerConfig: Provider;
  private providerId: string;
  private currentModelId: string;

  constructor(
    providerId: string,
    initialModelId: string,
    providerConfig: Provider,
    cliConfig: Config,
  ) {
    // Create OpenAI-compatible config from provider settings
    const contentGeneratorConfig: OpenAIContentGeneratorConfig = {
      authType: AuthType.PROVIDER,
      apiKey: extractApiKey(providerConfig, providerId),
      baseUrl: extractBaseUrl(providerConfig),
      model: initialModelId,
      proxy: cliConfig.getProxy?.(),
      timeout: extractTimeout(providerConfig),
      customHeaders: extractCustomHeaders(providerConfig),
    };

    // Create generic OpenAI-compatible provider
    const provider = new GenericOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );

    // Initialize with the provider - MUST call super() first
    super(contentGeneratorConfig, cliConfig, provider);
    this.providerId = providerId;
    this.currentModelId = initialModelId;
    this.providerConfig = providerConfig;
  }

  /**
   * Switch to a different model within the same provider
   * This reuses the existing SDK client without recreation
   */
  async switchModel(newModelId: string): Promise<void> {
    const modelConfig = this.providerConfig.models?.[newModelId];

    if (!modelConfig) {
      throw new Error(
        `Model '${newModelId}' not found in provider '${this.providerId}'`,
      );
    }

    this.currentModelId = newModelId;

    // Update the model in the pipeline's content generator config
    if (this.pipeline?.contentGeneratorConfig) {
      this.pipeline.contentGeneratorConfig.model = newModelId;
    }

    debugLogger.log(
      `[ProviderContentGenerator] Switched model: ${this.providerId}/${newModelId}`,
    );
  }

  /**
   * Get current model ID
   */
  getCurrentModelId(): string {
    return this.currentModelId;
  }

  /**
   * Get provider ID
   */
  getProviderId(): string {
    return this.providerId;
  }

  /**
   * Get current model configuration
   */
  getCurrentModelConfig(): ProviderModel | undefined {
    return this.providerConfig.models?.[this.currentModelId];
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(): Provider {
    return this.providerConfig;
  }
}

/**
 * Extract API key from provider options
 */
function extractApiKey(providerConfig: Provider, providerId: string): string {
  const options: Record<string, unknown> = providerConfig.options || {};
  const envValue = process.env[providerConfig.env?.[0] || ''];
  let apiKey = (options['apiKey'] as string) ?? (envValue as string) ?? '';

  if (!apiKey) {
    debugLogger.warn(
      `[ProviderContentGenerator] No API key found for provider ${providerId}`,
    );
    apiKey = 'DYNAMIC_API_KEY';
  }

  // Handle "Bearer " prefix
  if (typeof apiKey === 'string' && !apiKey.startsWith('Bearer ')) {
    // Check if the apiKey in config already has Bearer prefix
    if (
      providerConfig.options?.apiKey &&
      providerConfig.options.apiKey.startsWith('Bearer ')
    ) {
      return apiKey;
    }
    return apiKey;
  }

  return apiKey || '';
}

/**
 * Extract base URL from provider options
 */
function extractBaseUrl(providerConfig: Provider): string {
  const options: Record<string, unknown> = providerConfig.options || {};
  return (
    (options['baseURL'] as string) ||
    (options['enterpriseUrl'] as string) ||
    'https://api.openai.com/v1'
  );
}

/**
 * Extract timeout from provider options
 */
function extractTimeout(providerConfig: Provider): number | undefined {
  const options: Record<string, unknown> = providerConfig.options || {};
  const timeout = options['timeout'];
  // Convert false to undefined, return number or undefined
  if (timeout === false) {
    return undefined;
  }
  return (timeout as number) ?? 120000; // Default 2 minutes
}

/**
 * Extract custom headers from provider options
 */
function extractCustomHeaders(
  providerConfig: Provider,
): Record<string, string> {
  const options: Record<string, unknown> = providerConfig.options || {};
  return (options['headers'] as Record<string, string>) || {};
}

/**
 * Generic OpenAI-compatible provider for use with ProviderContentGenerator
 */
export class GenericOpenAICompatibleProvider {
  private contentGeneratorConfig: OpenAIContentGeneratorConfig;
  private cliConfig: Config;

  constructor(
    contentGeneratorConfig: OpenAIContentGeneratorConfig,
    cliConfig: Config,
  ) {
    this.cliConfig = cliConfig;
    this.contentGeneratorConfig = contentGeneratorConfig;
  }

  buildHeaders(): Record<string, string> {
    const version = 'unknown';
    const userAgent = `GeminiCLI/${version}/${this.contentGeneratorConfig.model} (${process.platform}; ${process.arch})`;

    const defaultHeaders: Record<string, string> = {
      'User-Agent': userAgent,
    };

    const customHeaders = this.contentGeneratorConfig.customHeaders || {};
    const apiKey = this.contentGeneratorConfig.apiKey;

    // Add authorization header if API key is provided
    if (apiKey && apiKey !== 'DYNAMIC_API_KEY') {
      // Check if already has Bearer prefix
      if (apiKey.startsWith('Bearer ')) {
        defaultHeaders['Authorization'] = apiKey;
      } else {
        defaultHeaders['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    return { ...defaultHeaders, ...customHeaders };
  }

  buildClient(): OpenAI {
    const {
      apiKey,
      baseUrl = 'https://api.openai.com/v1',
      timeout = 120000,
      maxRetries = 3,
    } = this.contentGeneratorConfig;

    const defaultHeaders = this.buildHeaders();

    debugLogger.log(apiKey);
    return new OpenAI({
      apiKey: apiKey === 'DYNAMIC_API_KEY' ? 'sk-dummy' : apiKey,
      baseURL: baseUrl,
      timeout,
      maxRetries,
      defaultHeaders,
    });
  }

  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    // Generic request builder - pass through most parameters
    const sessionId = this.cliConfig.getSessionId();

    return {
      ...request,
      metadata: {
        sessionId,
        promptId: userPromptId,
      },
    };
  }

  getDefaultGenerationConfig(): { temperature: number } {
    return {
      temperature: 0.3,
    };
  }
}

/**
 * Create a content generator for a provider/model pair
 */
export async function createProviderContentGenerator(
  providerId: string,
  initialModelId: string,
  providerConfig: Provider,
  cliConfig: Config,
): Promise<ProviderContentGenerator> {
  return new ProviderContentGenerator(
    providerId,
    initialModelId,
    providerConfig,
    cliConfig,
  );
}
