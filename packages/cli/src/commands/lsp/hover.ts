/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService } from '@google/gemini-cli-core';

export const hoverCommand: CommandModule = {
  command: 'hover <file>',
  describe: 'Get hover information for a symbol in a file',
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
      
      // Get hover information
      const hover = await lspService.getHover(uri, line, column);
      
      if (!hover) {
        console.log('No hover information available');
        return;
      }

      console.log(`Hover information at line ${line}, column ${column}:`);
      console.log('─'.repeat(50));
      console.log(hover);
      
      // Close document
      await lspService.closeDocument(uri);
    } catch (error) {
      console.error('Failed to get hover information:', error);
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
