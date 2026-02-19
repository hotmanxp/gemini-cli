/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService, supportedLanguages } from '@google/gemini-cli-core';

export const stopCommand: CommandModule = {
  command: 'stop [language]',
  describe: 'Stop an LSP server for a specific language or all servers',
  builder: (yargs: Argv) => {
    return yargs
      .positional('language', {
        desc: 'Language ID (typescript, python, java, go, rust). If omitted, stops all servers.',
        type: 'string',
      })
      .option('all', {
        alias: 'a',
        desc: 'Stop all LSP servers',
        type: 'boolean',
        default: false,
      });
  },
  handler: async (argv) => {
    const language = argv['language'] as string | undefined;
    const stopAll = argv['all'] as boolean;

    const lspService = new LspService();
    
    try {
      if (stopAll || !language) {
        // Stop all servers
        console.log('Stopping all LSP servers...');
        await lspService.shutdown();
        console.log('All LSP servers stopped');
      } else {
        // Stop specific language server
        const validLangs = supportedLanguages.map(l => l.languageId);
        if (!validLangs.includes(language)) {
          console.error(`Invalid language: ${language}. Valid options: ${validLangs.join(', ')}`);
          process.exit(1);
        }

        const isRunning = lspService.isLanguageRunning(language);
        if (!isRunning) {
          console.log(`LSP server for ${language} is not running`);
          return;
        }

        console.log(`Stopping LSP server for ${language}...`);
        await lspService.stopLanguage(language);
        console.log(`LSP server for ${language} stopped`);
      }
    } catch (error) {
      console.error('Failed to stop LSP server:', error);
      process.exit(1);
    }
  },
};
