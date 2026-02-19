/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService, supportedLanguages } from '@google/gemini-cli-core';

export const startCommand: CommandModule = {
  command: 'start <language>',
  describe: 'Start an LSP server for a specific language',
  builder: (yargs: Argv) => {
    return yargs
      .positional('language', {
        desc: 'Language ID (typescript, python, java, go, rust)',
        type: 'string',
        demandOption: true,
      })
      .option('workspace', {
        alias: 'w',
        desc: 'Workspace root directory',
        type: 'string',
        default: process.cwd(),
      });
  },
  handler: async (argv) => {
    const language = argv['language'] as string;
    const workspace = argv['workspace'] as string;

    const validLangs = supportedLanguages.map(l => l.languageId);
    if (!validLangs.includes(language)) {
      console.error(`Invalid language: ${language}. Valid options: ${validLangs.join(', ')}`);
      process.exit(1);
    }

    const lspService = new LspService();
    try {
      console.log(`Starting LSP server for ${language} in ${workspace}`);
      const success = await lspService.startLanguage(language, workspace);
      if (success) {
        console.log(`LSP server for ${language} started successfully`);
        console.log('The server will run in the background. Use "gemini lsp status" to check status.');
      } else {
        console.error(`Failed to start LSP server for ${language}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to start LSP server:', error);
      process.exit(1);
    }
  },
};
