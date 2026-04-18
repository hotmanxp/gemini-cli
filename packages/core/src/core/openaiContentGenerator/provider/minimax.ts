/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import type OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import type { OpenAIContentGeneratorConfig } from '../types.js';
import { DefaultOpenAICompatibleProvider } from './default.js';
import type { GenerateContentConfig } from '@google/genai';

/**
 * MiniMax OpenAI-compatible provider
 */
export class MiniMaxOpenAICompatibleProvider extends DefaultOpenAICompatibleProvider {
  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    super(contentGeneratorConfig, cliConfig);
  }

  static isMiniMaxProvider(
    contentGeneratorConfig: ContentGeneratorConfig,
  ): boolean {
    const config = contentGeneratorConfig as OpenAIContentGeneratorConfig;
    const authType = config.authType;
    const baseUrl = config.baseUrl ?? '';

    return (
      authType === 'minimax-api-key' ||
      baseUrl.toLowerCase().includes('minimaxi.com')
    );
  }

  override buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    return {
      ...request,
    };
  }

  override getDefaultGenerationConfig(): GenerateContentConfig {
    return {
      temperature: 0.7,
    };
  }
}
