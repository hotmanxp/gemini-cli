/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensResponse,
  EmbedContentResponse,
  EmbedContentParameters,
  CountTokensParameters,
} from '@google/genai';

export interface ContentGeneratorConfig {
  authType: AuthType;
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  apiVersion?: string;
  headers?: Record<string, string>;
}

export enum AuthType {
  USE_GEMINI = 'use-gemini',
  USE_VERTEX_AI = 'use-vertex-ai',
  LOGIN_WITH_GOOGLE = 'login-with-google',
  CLOUD_SHELL = 'cloud-shell',
  CODE_ASSIST = 'code-assist',
  USE_QWEN = 'use-qwen',
  CONFIG_LOGIN = 'config-login',
  GEMINI_DAILY = 'gemini-daily',
}

export interface ContentGenerator {
  generateContent: (
    request: GenerateContentParameters,
    userPromptId: string,
  ) => Promise<GenerateContentResponse>;
  generateContentStream: (
    request: GenerateContentParameters,
    userPromptId: string,
  ) => AsyncIterable<GenerateContentResponse>;
  countTokens: (request: CountTokensParameters) => Promise<CountTokensResponse>;
  embedContent?: (
    request: EmbedContentParameters,
  ) => Promise<EmbedContentResponse>;
  userTier?: string;
  userTierName?: string;
}
