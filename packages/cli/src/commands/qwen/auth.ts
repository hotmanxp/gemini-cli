/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @license
 */

import type { CommandModule, Argv } from 'yargs';
import type { Config } from '@google/gemini-cli-core';
import {
  getQwenOAuthClient,
  qwenOAuth2Events,
  QwenOAuth2Event,
  clearQwenCredentials,
} from '@google/gemini-cli-core';

export const qwenAuthCommand: CommandModule = {
  command: 'qwen-auth',
  describe: 'Authenticate with Qwen OAuth',
  builder: (yargs: Argv) =>
    yargs
      .option('model', {
        alias: 'm',
        desc: 'Qwen model to use',
        type: 'string',
        default: 'qwen-plus',
      })
      .option('clear', {
        alias: 'c',
        desc: 'Clear stored credentials',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv) => {
    const clear = Boolean(argv['clear']);
    const model = String(argv['model']);

    if (clear) {
      await clearCredentials();
      return;
    }

    try {
      // Try to get existing credentials first
      const { readQwenCredentials, areCredentialsExpired } = await import(
        '@google/gemini-cli-core'
      );
      const existingCreds = await readQwenCredentials();

      if (
        existingCreds?.access_token &&
        !areCredentialsExpired(existingCreds)
      ) {
        return;
      }

      // Set up event listeners for auth progress
      qwenOAuth2Events.on(QwenOAuth2Event.AuthProgress, (status: string) => {
        if (status === 'polling') {
          process.stdout.write('.');
        }
      });

      qwenOAuth2Events.on(
        QwenOAuth2Event.AuthUri,
        (_data: { user_code: string; verification_uri_complete: string }) => {},
      );

      // Get OAuth client (this will trigger device flow if needed)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const config = (await createMinimalConfig(model)) as unknown as Config;
      const client = await getQwenOAuthClient(config);

      // Verify we got a token
      const { token } = await client.getAccessToken();

      if (!token) {
        process.exit(1);
      }
    } catch (_error) {
      process.exit(1);
    }
  },
};

/**
 * Clear Qwen credentials
 */
async function clearCredentials() {
  await clearQwenCredentials();
}

/**
 * Create minimal config for OAuth
 */
async function createMinimalConfig(model: string) {
  interface MinimalConfig {
    getModel: () => string;
    getProxy: () => undefined;
    isBrowserLaunchSuppressed: () => boolean;
    isInteractive: () => boolean;
    getSessionId: () => string;
    getDebugMode: () => boolean;
    storage: {
      initialize: () => Promise<void>;
      getProjectId: () => string;
    };
  }

  // Create a minimal config object that satisfies the interface
  return {
    getModel: () => model,
    getProxy: () => undefined,
    isBrowserLaunchSuppressed: () => false,
    isInteractive: () => process.stdin.isTTY === true,
    getSessionId: () => 'qwen-auth',
    getDebugMode: () => !!process.env['DEBUG'],
    storage: {
      initialize: async () => {},
      getProjectId: () => 'default',
    },
  } as MinimalConfig;
}
