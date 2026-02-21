#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, writeFileSync } from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node add-lsp-support.js <config.ts path>');
  process.exit(1);
}

let content = readFileSync(filePath, 'utf-8');

// 1. Add import for LspClient after FileSystemService import
const importPattern =
  "import type { FileSystemService } from '../services/fileSystemService.js';";
const importAddition = "import type { LspClient } from '../lsp/types.js';";
if (content.includes(importPattern) && !content.includes(importAddition)) {
  content = content.replace(
    importPattern,
    `${importPattern}
${importAddition}`,
  );
  console.log('✓ Added LspClient import');
}

// 2. Add private fields after gitService field
const fieldPattern = 'private gitService: GitService | undefined = undefined;';
const fieldAddition = `
  // LSP-related fields
  private lspClient: LspClient | null = null;
  private lspEnabled: boolean = false;
`;
if (content.includes(fieldPattern) && !content.includes('private lspClient')) {
  content = content.replace(fieldPattern, `${fieldPattern}${fieldAddition}`);
  console.log('✓ Added LSP private fields');
}

// 3. Add LSP methods before dispose method
const disposePattern = `  /**
   * Disposes of resources and removes event listeners.
   */
  async dispose(): Promise<void> {`;

const lspMethods = `  // ============================================================================
  // LSP Methods
  // ============================================================================

  /**
   * Check if LSP is enabled
   */
  isLspEnabled(): boolean {
    return this.lspEnabled;
  }

  /**
   * Get the LSP client
   */
  getLspClient(): LspClient | null {
    return this.lspClient;
  }

  /**
   * Set the LSP client and enable LSP
   */
  setLspClient(client: LspClient): void {
    this.lspClient = client;
    this.lspEnabled = true;
  }

  /**
   * Disable LSP
   */
  disableLsp(): void {
    this.lspEnabled = false;
    this.lspClient = null;
  }

`;

if (content.includes(disposePattern) && !content.includes('isLspEnabled')) {
  content = content.replace(disposePattern, `${lspMethods}${disposePattern}`);
  console.log('✓ Added LSP methods');
}

writeFileSync(filePath, content, 'utf-8');
console.log('✓ Config.ts updated successfully');
