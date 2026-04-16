/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import OpenAI from 'openai';
import type { GenerateContentConfig } from '@google/genai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import type { OpenAIContentGeneratorConfig } from '../types.js';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../constants.js';
import type { OpenAICompatibleProvider } from './types.js';
import { buildRuntimeFetchOptions } from '../../../utils/runtimeFetchOptions.js';

/**
 * Default provider for standard OpenAI-compatible APIs
 */
export class DefaultOpenAICompatibleProvider
  implements OpenAICompatibleProvider
{
  protected contentGeneratorConfig: OpenAIContentGeneratorConfig;
  protected cliConfig: Config;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    this.cliConfig = cliConfig;
    this.contentGeneratorConfig =
      contentGeneratorConfig as OpenAIContentGeneratorConfig;
  }

  buildHeaders(): Record<string, string | undefined> {
    const version = 'unknown';
    const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
    const { customHeaders } = this.contentGeneratorConfig;
    const defaultHeaders = {
      'User-Agent': userAgent,
    };

    return customHeaders
      ? { ...defaultHeaders, ...customHeaders }
      : defaultHeaders;
  }

  buildClient(): OpenAI {
    const {
      apiKey,
      baseUrl,
      timeout = DEFAULT_TIMEOUT,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = this.contentGeneratorConfig;
    const defaultHeaders = this.buildHeaders();
    // Configure fetch options to ensure user-configured timeout works as expected
    // bodyTimeout is always disabled (0) to let OpenAI SDK timeout control the request
    // Note: We set the global proxy via buildRuntimeFetchOptions
    buildRuntimeFetchOptions('openai', this.cliConfig.getProxy());
    return new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout,
      maxRetries,
      defaultHeaders,
    });
  }

  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    const extraBody = this.contentGeneratorConfig.extra_body;
    // Default provider doesn't need special enhancements, just pass through all parameters
    return {
      ...request, // Preserve all original parameters including sampling params
      ...(extraBody ? extraBody : {}),
    };
  }

  getDefaultGenerationConfig(): GenerateContentConfig {
    return {};
  }
}
