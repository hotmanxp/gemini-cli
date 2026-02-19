/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import {
  getQwenOAuthClient,
  qwenOAuth2Events,
  QwenOAuth2Event,
  clearQwenCredentials,
} from '@google/gemini-cli-core';

export const qwenAuthCommand: CommandModule = {
  command: 'qwen-auth',
  describe: 'Authenticate with Qwen OAuth',
  builder: (yargs: Argv) => {
    return yargs
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
      });
  },
  handler: async (argv) => {
    const clear = argv['clear'] as boolean;
    const model = argv['model'] as string;

    if (clear) {
      await clearCredentials();
      console.log('Qwen credentials cleared.');
      return;
    }

    try {
      console.log('Checking for existing Qwen OAuth credentials...');

      // Try to get existing credentials first
      const { readQwenCredentials, areCredentialsExpired } = await import('@google/gemini-cli-core');
      const existingCreds = await readQwenCredentials();

      if (existingCreds?.access_token && !areCredentialsExpired(existingCreds)) {
        console.log('✅ Found valid credentials!');
        console.log('');
        console.log('Credentials location: ~/.qwen/oauth_creds.json');
        console.log(`Token expires: ${new Date(existingCreds.expiry_date!).toLocaleString()}`);
        console.log('');
        console.log('You can now use Qwen models with:');
        console.log('  gemini --auth-type qwen-oauth --model qwen-plus "Your prompt"');
        console.log('');
        console.log('If you want to re-authenticate, run: gemini qwen-auth --clear && gemini qwen-auth');
        return;
      }

      console.log('No valid credentials found. Starting OAuth authentication...');
      console.log(`Model: ${model}`);
      console.log('');

      // Set up event listeners for auth progress
      qwenOAuth2Events.on(QwenOAuth2Event.AuthProgress, (status: string, message: string) => {
        if (status === 'polling') {
          process.stdout.write('.');
        } else if (status === 'error') {
          console.error(`\nError: ${message}`);
        }
      });

      qwenOAuth2Events.on(QwenOAuth2Event.AuthUri, (data: any) => {
        console.log(`\nDevice code: ${data.user_code}`);
        console.log(`Authorization URL: ${data.verification_uri_complete}`);
        console.log('\nIf your browser did not open automatically, please visit the URL above.');
      });

      // Get OAuth client (this will trigger device flow if needed)
      const config = await createMinimalConfig(model);
      const client = await getQwenOAuthClient(config);

      // Verify we got a token
      const { token } = await client.getAccessToken();

      if (token) {
        console.log('\n\n✅ Authentication successful!');
        console.log('Your Qwen credentials have been saved to ~/.qwen/oauth_creds.json');
        console.log('');
        console.log('You can now use Qwen models with:');
        console.log('  gemini --auth-type qwen-oauth --model qwen-plus "Your prompt"');
      } else {
        console.error('\n\n❌ Authentication failed: No token received');
        process.exit(1);
      }
    } catch (error) {
      console.error(
        '\n\n❌ Authentication failed:',
        error instanceof Error ? error.message : String(error),
      );
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
  } as any;
}
