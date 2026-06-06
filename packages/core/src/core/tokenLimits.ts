/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import {
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_MODEL,
  GEMMA_4_31B_IT_MODEL,
  GEMMA_4_26B_A4B_IT_MODEL,
} from '../config/models.js';

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;
export const GEMMA_4_TOKEN_LIMIT = 256_000;

export function tokenLimit(model: Model): TokenCount {
  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/gemini-api/docs/models
  switch (model) {
    case GEMMA_4_31B_IT_MODEL:
    case GEMMA_4_26B_A4B_IT_MODEL:
      return GEMMA_4_TOKEN_LIMIT;
    case PREVIEW_GEMINI_MODEL:
    case PREVIEW_GEMINI_FLASH_MODEL:
    case DEFAULT_GEMINI_MODEL:
    case DEFAULT_GEMINI_FLASH_MODEL:
    case DEFAULT_GEMINI_FLASH_LITE_MODEL:
      return 1_048_576;
    case 'MiniMax-M2.7-highspeed':
      return 204_800;
    case 'MiniMax-M3':
      return 1_048_576; // 1M context, multimodal
    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}

/**
 * Resolves the input context window for `model`. When a `Config` is provided
 * and the dynamic model configuration experiment is enabled, the registry
 * (`ModelConfigService.modelDefinitions[model].contextWindow`) is consulted
 * first; this is the canonical, model-self-described source of truth.
 *
 * Falls back to the legacy hard-coded lookup for the legacy path or models
 * without a `contextWindow` registered.
 */
export function getTokenLimitFromConfig(
  model: Model,
  config?: Config,
): TokenCount {
  if (config?.getExperimentalDynamicModelConfiguration?.() === true) {
    const definition = config.modelConfigService?.getModelDefinition(model);
    if (definition?.contextWindow && definition.contextWindow > 0) {
      return definition.contextWindow;
    }
  }
  return tokenLimit(model);
}
