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
  builder: (yargs: Argv) => {
    return yargs
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
      });
  },
  handler: async (argv) => {
    const file = argv['file'] as string;
    const line = argv['line'] as number;
    const column = argv['column'] as number;
    const workspace = argv['workspace'] as string;

    const lspService = new LspService();
    
    try {
      // Auto-start language server based on file extension
      const started = await lspService.autoStartLanguage(file, workspace);
      if (!started) {
        console.log(`No LSP server configured for this file type`);
        return;
      }

      // Read file content
      const fs = await import('fs/promises');
      const content = await fs.readFile(file, 'utf-8');
      const uri = `file://${file}`;
      
      // Determine language ID from file extension
      const ext = file.split('.').pop()?.toLowerCase() || '';
      const languageId = getLanguageIdFromExtension(ext);
      
      // Open document
      await lspService.openDocument(uri, languageId, content);
      
      // Get completions
      const completions = await lspService.getCompletion(uri, line, column);
      
      if (!completions || completions.length === 0) {
        console.log('No completions available');
        return;
      }

      console.log(`Completions at line ${line}, column ${column}:`);
      console.log('─'.repeat(50));
      
      const items = Array.isArray(completions) ? completions : (completions as any).items || [];
      for (const item of items.slice(0, 10)) { // Show top 10
        const label = typeof item.label === 'string' ? item.label : item.label?.label || 'unknown';
        const kind = item.kind ? `[${item.kind}]` : '';
        const detail = item.detail || '';
        console.log(`  ${kind} ${label}${detail ? ` - ${detail}` : ''}`);
      }
      
      if (items.length > 10) {
        console.log(`  ... and ${items.length - 10} more`);
      }
      
      // Close document
      await lspService.closeDocument(uri);
    } catch (error) {
      console.error('Failed to get completions:', error);
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
