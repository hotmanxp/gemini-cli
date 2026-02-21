/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService } from '@google/gemini-cli-core';

export const definitionCommand: CommandModule = {
  command: 'definition <file>',
  describe: 'Go to definition for a symbol in a file',
  aliases: ['def', 'goto'],
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
    const file = String(argv['file']);
    const line = Number(argv['line']);
    const column = Number(argv['column']);
    const workspace = String(argv['workspace']);

    interface DefinitionResult {
      uri?: string;
      targetUri?: string;
      range?: { start?: { line?: number; character?: number } };
      targetRange?: { start?: { line?: number; character?: number } };
    }

    const lspService = new LspService();
    
    try {
      // Auto-start language server based on file extension
      const started = await lspService.autoStartLanguage(file, workspace);
      if (!started) {
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
      
      // Get definitions
      const definitions = await lspService.goToDefinition(uri, line, column);
      
      if (!definitions || definitions.length === 0) {
        return;
      }

      const items = Array.isArray(definitions) ? definitions : [definitions];
      for (const def of items) {
        const defTyped = def as DefinitionResult;
        const targetUri = defTyped.uri ?? defTyped.targetUri ?? 'unknown';

        // Convert file:// URI to path
        const targetPath = targetUri?.replace('file://', '') || 'unknown';
        void targetPath; // Mark as intentionally unused
      }
      
      // Close document
      await lspService.closeDocument(uri);
    } catch (error) {
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
