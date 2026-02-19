/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService } from '@google/gemini-cli-core';
import * as path from 'node:path';

export const referencesCommand: CommandModule = {
  command: 'references <file>',
  describe: 'Find all references to a symbol in a file',
  aliases: ['refs'],
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
      })
      .option('include-declaration', {
        alias: 'd',
        desc: 'Include declarations in results',
        type: 'boolean',
        default: true,
      });
  },
  handler: async (argv) => {
    const file = argv['file'] as string;
    const line = argv['line'] as number;
    const column = argv['column'] as number;
    const workspace = argv['workspace'] as string;
    // const includeDeclaration = argv['include-declaration'] as boolean;

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
      
      // Get references
      const references = await lspService.findReferences(uri, line, column);
      
      if (!references || references.length === 0) {
        console.log('No references found');
        return;
      }

      console.log(`References at line ${line}, column ${column}:`);
      console.log('─'.repeat(50));
      
      const items = Array.isArray(references) ? references : [references];
      
      // Group by file
      const byFile = new Map<string, any[]>();
      for (const ref of items as any[]) {
        const refUri = (ref as any).uri;
        if (!byFile.has(refUri)) {
          byFile.set(refUri, []);
        }
        byFile.get(refUri)!.push(ref);
      }
      
      for (const [refUri, refs] of byFile) {
        const refPath = refUri.replace('file://', '');
        const relativePath = path.relative(workspace, refPath);
        console.log(`\n  📄 ${relativePath || refPath}:`);
        
        for (const ref of refs as any[]) {
          const startLine = (ref as any).range?.start?.line ?? 'unknown';
          const startChar = (ref as any).range?.start?.character ?? 'unknown';
          console.log(`     Line ${startLine}, Column ${startChar}`);
        }
      }
      
      console.log(`\nTotal: ${items.length} reference(s)`);
      
      // Close document
      await lspService.closeDocument(uri);
    } catch (error) {
      console.error('Failed to find references:', error);
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
