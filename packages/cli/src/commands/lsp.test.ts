/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import type { Argv } from 'yargs';
import yargs from 'yargs/yargs';
import { lspCommand } from './lsp.js';
import { startCommand } from './lsp/start.js';
import { statusCommand } from './lsp/status.js';

vi.mock('@google/gemini-cli-core', () => ({
  LspService: vi.fn(() => ({
    startLanguage: vi.fn().mockResolvedValue(true),
    getActiveLanguages: vi.fn().mockReturnValue([]),
    isLanguageRunning: vi.fn().mockReturnValue(false),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  supportedLanguages: [
    { languageId: 'typescript', command: 'typescript-language-server' },
    { languageId: 'python', command: 'pyright' },
    { languageId: 'java', command: 'jdtls' },
    { languageId: 'go', command: 'gopls' },
    { languageId: 'rust', command: 'rust-analyzer' },
  ],
}));

describe('lspCommand', () => {
  it('should have correct command name', () => {
    expect(lspCommand.command).toBe('lsp');
  });

  it('should have correct description', () => {
    expect(lspCommand.describe).toBe('Manage Language Server Protocol (LSP) servers');
  });

  it('should have a builder function', () => {
    expect(typeof lspCommand.builder).toBe('function');
  });

  it('should have a handler function', () => {
    expect(typeof lspCommand.handler).toBe('function');
  });

  it('should configure yargs with subcommands', () => {
    const yargsInstance = yargs([]);
    const result = (lspCommand.builder as (y: Argv) => Argv)(yargsInstance);
    expect(result).toBeDefined();
  });
});

describe('startCommand', () => {
  it('should have correct command name', () => {
    expect(startCommand.command).toBe('start <language>');
  });

  it('should have correct description', () => {
    expect(startCommand.describe).toBe('Start an LSP server for a specific language');
  });

  it('should have a builder function', () => {
    expect(typeof startCommand.builder).toBe('function');
  });

  it('should have a handler function', () => {
    expect(typeof startCommand.handler).toBe('function');
  });

  it('should configure language positional argument', () => {
    const yargsInstance = yargs([]);
    const result = (startCommand.builder as (y: Argv) => Argv)(yargsInstance);
    expect(result).toBeDefined();
  });
});

describe('statusCommand', () => {
  it('should have correct command name', () => {
    expect(statusCommand.command).toBe('status');
  });

  it('should have correct description', () => {
    expect(statusCommand.describe).toBe('Show LSP server status');
  });

  it('should have a builder function', () => {
    expect(typeof statusCommand.builder).toBe('function');
  });

  it('should have a handler function', () => {
    expect(typeof statusCommand.handler).toBe('function');
  });
});
