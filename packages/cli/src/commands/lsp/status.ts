/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService, supportedLanguages } from '@google/gemini-cli-core';

export const statusCommand: CommandModule = {
  command: 'status',
  describe: 'Show LSP server status',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const lspService = new LspService();
    const activeLanguages = lspService.getActiveLanguages();
    
    console.log('LSP Server Status');
    console.log('--------------------');
    
    if (activeLanguages.length === 0) {
      console.log('No LSP servers currently running');
    } else {
      console.log('Active LSP servers:');
      for (const lang of activeLanguages) {
        const isRunning = lspService.isLanguageRunning(lang);
        console.log(`  - ${lang}: ${isRunning ? 'Running' : 'Stopped'}`);
      }
    }
    
    console.log('');
    console.log('Supported languages:');
    for (const lang of supportedLanguages) {
      console.log(`  - ${lang.languageId}: ${lang.command}`);
    }
  },
};
