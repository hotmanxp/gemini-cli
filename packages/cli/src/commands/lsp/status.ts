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

    if (activeLanguages.length === 0) {
      // No active languages
    } else {
      for (const lang of activeLanguages) {
        const isRunning = lspService.isLanguageRunning(lang);
        void isRunning; // Mark as intentionally unused
      }
    }

    for (const lang of supportedLanguages) {
      void lang; // Mark as intentionally unused
    }
  },
};
