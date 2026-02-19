/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthType } from '../contentGenerator.js';

/**
 * Extended ContentGeneratorConfig for OpenAI-compatible providers
 * This extends the base config with additional properties needed for OpenAI API compatibility
 */
export interface OpenAIContentGeneratorConfig {
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
  baseUrl?: string;
  model: string;
  timeout?: number;
  maxRetries?: number;
  customHeaders?: Record<string, string>;
  extra_body?: Record<string, unknown>;
  samplingParams?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    repetitionPenalty?: number;
  };
  reasoning?: Record<string, unknown> | boolean;
  schemaCompliance?: 'auto' | 'strict' | 'relaxed';
  enableCacheControl?: boolean;
}

/**
 * Extended Config interface for OpenAI-compatible providers
 */
export interface OpenAIConfigExtensions {
  getCliVersion(): string | undefined;
  getSessionId(): string | undefined;
  getChannel(): string | undefined;
  getContentGeneratorConfig(): OpenAIContentGeneratorConfig | undefined;
}
