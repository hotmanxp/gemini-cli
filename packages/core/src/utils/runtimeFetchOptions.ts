/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { setGlobalProxy } from './fetch.js';
import type { Agent } from 'undici';

/**
 * Runtime fetch options for configuring HTTP requests
 */
export interface RuntimeFetchOptions {
  httpAgent?: Agent;
  httpsAgent?: Agent;
}

/**
 * Build runtime fetch options based on proxy configuration
 * @param clientType - The type of client (e.g., 'openai', 'gemini')
 * @param proxy - Optional proxy URL
 * @returns Runtime fetch options or undefined if no configuration needed
 */
export function buildRuntimeFetchOptions(
  clientType: string,
  proxy?: string,
): Partial<RuntimeFetchOptions> | undefined {
  if (proxy) {
    setGlobalProxy(proxy);
  }

  // For now, we just set the global proxy and return undefined
  // The OpenAI SDK will use the global proxy setting
  return undefined;
}
