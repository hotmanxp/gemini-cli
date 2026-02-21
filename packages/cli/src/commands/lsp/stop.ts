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
  builder: (yargs: Argv) =>
    yargs
      .positional('language', {
        desc: 'Language ID (typescript, python, java, go, rust). If omitted, stops all servers.',
        type: 'string',
      })
      .option('all', {
        alias: 'a',
        desc: 'Stop all LSP servers',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv) => {
    const language = argv['language'] as string | undefined;
    const stopAll = Boolean(argv['all']);

    const lspService = new LspService();

    try {
      if (stopAll || !language) {
        // Stop all servers
        await lspService.shutdown();
      } else {
        // Stop specific language server
        const validLangs = supportedLanguages.map((l) => l.languageId);
        if (!validLangs.includes(language)) {
          process.exit(1);
        }

        const isRunning = lspService.isLanguageRunning(language);
        if (!isRunning) {
          return;
        }

        await lspService.stopLanguage(language);
      }
    } catch (_error) {
      process.exit(1);
    }
  },
};
