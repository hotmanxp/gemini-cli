/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService } from '@google/gemini-cli-core';

export const completionCommand: CommandModule = {
  command: 'completion <file>',
  describe: 'Get code completions for a file',
  builder: (yargs: Argv) =>
    yargs
      .positional('file', {
        desc: 'File path',
        type: 'string',
        demandOption: true,
      })
      .option('line', {
        alias: 'l',
        desc: 'Line number (0-based)',
        type: 'number',
        default: 0,
      })
      .option('column', {
        alias: 'c',
        desc: 'Column number (0-based)',
        type: 'number',
        default: 0,
      })
      .option('workspace', {
        alias: 'w',
        desc: 'Workspace root directory',
        type: 'string',
        default: process.cwd(),
      }),
  handler: async (argv) => {
    const file = String(argv['file']);
    const line = Number(argv['line']);
    const column = Number(argv['column']);
    const workspace = String(argv['workspace']);

    const lspService = new LspService();

    try {
      // Auto-start language server based on file extension
      const started = await lspService.autoStartLanguage(file, workspace);
      if (!started) {
        return;
      }

      // Read file content
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(file, 'utf-8');
      const uri = `file://${file}`;

      // Determine language ID from file extension
      const ext = file.split('.').pop()?.toLowerCase() ?? '';
      const languageId = getLanguageIdFromExtension(ext);

      // Open document
      await lspService.openDocument(uri, languageId, content);

      // Get completions
      const completions = await lspService.getCompletion(uri, line, column);

      if (!completions || completions.length === 0) {
        return;
      }

      // Process completions (silently)
      const items = Array.isArray(completions)
        ? completions
        : ((completions as { items: unknown[] }).items ?? []);
      void items.slice(0, 10);

      // Close document
      await lspService.closeDocument(uri);
    } catch (_error) {
      process.exit(1);
    }
  },
};

function getLanguageIdFromExtension(ext: string): string {
  const map: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
  };
  return map[ext] || 'plaintext';
}
