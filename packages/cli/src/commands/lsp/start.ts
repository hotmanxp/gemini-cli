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
  builder: (yargs: Argv) =>
    yargs
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
      }),
  handler: async (argv) => {
    const language = String(argv['language']);
    const workspace = String(argv['workspace']);

    const validLangs = supportedLanguages.map((l) => l.languageId);
    if (!validLangs.includes(language)) {
      process.exit(1);
    }

    const lspService = new LspService();
    try {
      const success = await lspService.startLanguage(language, workspace);
      if (!success) {
        process.exit(1);
      }
    } catch (_error) {
      process.exit(1);
    }
  },
};
