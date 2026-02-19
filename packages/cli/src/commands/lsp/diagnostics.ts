/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { LspService } from '@google/gemini-cli-core';

export const diagnosticsCommand: CommandModule = {
  command: 'diagnostics <file>',
  describe: 'Get diagnostic information (errors, warnings) for a file',
  aliases: ['diag', 'errors'],
  builder: (yargs: Argv) => {
    return yargs
      .positional('file', {
        desc: 'File path',
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
    const file = argv['file'] as string;
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
      
      // Wait a bit for diagnostics to be published
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get diagnostics
      const diagnostics = lspService.getDiagnostics(uri);
      
      if (!diagnostics || diagnostics.length === 0) {
        console.log('✅ No diagnostics issues found');
        return;
      }

      console.log(`Diagnostics for ${file}:`);
      console.log('─'.repeat(50));
      
      // Group by severity
      const errors = diagnostics.filter(d => d.severity === 1);
      const warnings = diagnostics.filter(d => d.severity === 2);
      const infos = diagnostics.filter(d => d.severity === 3);
      const hints = diagnostics.filter(d => d.severity === 4);
      
      if (errors.length > 0) {
        console.log(`\n❌ Errors (${errors.length}):`);
        for (const diag of errors) {
          const line = diag.range?.start?.line ?? '?';
          const char = diag.range?.start?.character ?? '?';
          console.log(`   ${line}:${char} - ${diag.message}`);
        }
      }
      
      if (warnings.length > 0) {
        console.log(`\n⚠️  Warnings (${warnings.length}):`);
        for (const diag of warnings) {
          const line = diag.range?.start?.line ?? '?';
          const char = diag.range?.start?.character ?? '?';
          console.log(`   ${line}:${char} - ${diag.message}`);
        }
      }
      
      if (infos.length > 0) {
        console.log(`\nℹ️  Info (${infos.length}):`);
        for (const diag of infos) {
          const line = diag.range?.start?.line ?? '?';
          const char = diag.range?.start?.character ?? '?';
          console.log(`   ${line}:${char} - ${diag.message}`);
        }
      }
      
      if (hints.length > 0) {
        console.log(`\n💡 Hints (${hints.length}):`);
        for (const diag of hints) {
          const line = diag.range?.start?.line ?? '?';
          const char = diag.range?.start?.character ?? '?';
          console.log(`   ${line}:${char} - ${diag.message}`);
        }
      }
      
      console.log(`\nTotal: ${diagnostics.length} issue(s)`);
      
      // Close document
      await lspService.closeDocument(uri);
    } catch (error) {
      console.error('Failed to get diagnostics:', error);
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
