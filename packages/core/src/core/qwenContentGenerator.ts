/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @license
 */

import { OpenAIContentGenerator } from './openaiContentGenerator/index.js';
import { DashScopeOpenAICompatibleProvider } from './openaiContentGenerator/provider/dashscope.js';
import type { IQwenOAuth2Client } from '../qwen/qwenOAuth2.js';
import { SharedTokenManager } from '../qwen/sharedTokenManager.js';
import type { Config } from '../config/config.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  EmbedContentParameters,
  EmbedContentResponse,
} from '@google/genai';
import type { OpenAIContentGeneratorConfig } from './openaiContentGenerator/types.js';
import { debugLogger } from '../utils/debugLogger.js';

/**
 * Qwen Content Generator that uses Qwen OAuth tokens with automatic refresh
 * Extends OpenAIContentGenerator with DashScope provider
 */
export class QwenContentGenerator extends OpenAIContentGenerator {
  private qwenClient: IQwenOAuth2Client;
  private sharedManager: SharedTokenManager;

  constructor(
    qwenClient: IQwenOAuth2Client,
    contentGeneratorConfig: OpenAIContentGeneratorConfig,
    cliConfig: Config,
  ) {
    // Create DashScope provider for Qwen
    const dashscopeProvider = new DashScopeOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );

    // Initialize with DashScope provider
    super(contentGeneratorConfig, cliConfig, dashscopeProvider);
    this.qwenClient = qwenClient;
    this.sharedManager = SharedTokenManager.getInstance();
  }

  /**
   * Get valid token and endpoint using the shared token manager
   */
  private async getValidToken(): Promise<{ token: string; endpoint: string }> {
    try {
      const credentials = await this.sharedManager.getValidCredentials(
        this.qwenClient,
      );

      if (!credentials.access_token) {
        throw new Error('No access token available');
      }

      const endpoint = this.getEndpoint(credentials.resource_url);

      return {
        token: credentials.access_token,
        endpoint,
      };
    } catch (error) {
      debugLogger.warn('Failed to get token from shared manager:', error);
      throw new Error(
        'Failed to obtain valid Qwen access token. Please re-authenticate.',
      );
    }
  }

  /**
   * Get endpoint URL with proper formatting
   */
  private getEndpoint(resourceUrl?: string): string {
    // Qwen OAuth uses portal.qwen.ai endpoint
    // resource_url from OAuth creds is typically 'portal.qwen.ai'
    const portalEndpoint = 'https://portal.qwen.ai/v1';

    if (resourceUrl && resourceUrl !== 'portal.qwen.ai') {
      const suffix = '/v1';
      const normalizedUrl = resourceUrl.startsWith('http')
        ? resourceUrl
        : `https://${resourceUrl}`;
      return normalizedUrl.endsWith(suffix)
        ? normalizedUrl
        : `${normalizedUrl}${suffix}`;
    }

    return portalEndpoint;
  }

  /**
   * Execute an operation with automatic credential management and retry logic
   */
  private async executeWithCredentialManagement<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const attemptOperation = async (): Promise<T> => {
      const { token, endpoint } = await this.getValidToken();

      // Apply dynamic configuration - update the OpenAI client and model
      if (this.pipeline?.client) {
        this.pipeline.client.apiKey = token;
        this.pipeline.client.baseURL = endpoint;
      }
      // Also update the model in contentGeneratorConfig
      if (this.pipeline?.contentGeneratorConfig) {
        this.pipeline.contentGeneratorConfig.model = 'coder-model';
      }

      return operation();
    };

    try {
      return await attemptOperation();
    } catch (error) {
      if (this.isAuthError(error)) {
        debugLogger.debug('Auth error detected, refreshing token...');
        await this.sharedManager.getValidCredentials(this.qwenClient, true);
        return attemptOperation();
      }
      throw error;
    }
  }

  /**
   * Override generateContent to use dynamic token
   */
  override async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    return this.executeWithCredentialManagement(() =>
      super.generateContent(request, userPromptId),
    );
  }

  /**
   * Override generateContentStream to use dynamic token
   */
  override async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.executeWithCredentialManagement(() =>
      super.generateContentStream(request, userPromptId),
    );
  }

  /**
   * Override embedContent to use dynamic token
   */
  override async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    return this.executeWithCredentialManagement(() =>
      super.embedContent(request),
    );
  }

  /**
   * Check if an error is related to authentication/authorization
   */
  private isAuthError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    const errorWithCode = error as { status?: number | string; code?: number | string };
    const errorCode = errorWithCode?.status || errorWithCode?.code;

    return (
      errorCode === 401 ||
      errorCode === 403 ||
      errorCode === '401' ||
      errorCode === '403' ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('invalid api key') ||
      errorMessage.includes('invalid access token') ||
      errorMessage.includes('token expired')
    );
  }
}

/**
 * Create Qwen Content Generator
 */
export async function createQwenContentGenerator(
  config: Config,
  model: string,
): Promise<QwenContentGenerator> {
  const { getQwenOAuthClient } = await import('../qwen/qwenOAuth2.js');
  const qwenClient = await getQwenOAuthClient(config);
  
  const contentGeneratorConfig: OpenAIContentGeneratorConfig = {
    authType: 'qwen-oauth' as any,
    apiKey: 'QWEN_OAUTH_DYNAMIC_TOKEN', // Placeholder, will be replaced dynamically
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model,
    proxy: config.getProxy?.(),
  };

  return new QwenContentGenerator(qwenClient, contentGeneratorConfig, config);
}
