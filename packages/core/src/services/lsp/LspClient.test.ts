/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the child_process module
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    stdin: {
      write: vi.fn(),
    },
    stdout: {
      on: vi.fn(),
    },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  })),
}));

describe('LspClient', () => {
  describe('module', () => {
    it('should export LspClient class', async () => {
      const { LspClient } = await import('./LspClient.js');
      expect(typeof LspClient).toBe('function');
    });
  });
});

describe('LspService', () => {
  describe('module', () => {
    it('should export LspService class', async () => {
      const { LspService } = await import('./LspService.js');
      expect(typeof LspService).toBe('function');
    });
  });
});

describe('LspServerManager', () => {
  describe('module', () => {
    it('should export LspServerManager class', async () => {
      const { LspServerManager } = await import('./LspServerManager.js');
      expect(typeof LspServerManager).toBe('function');
    });
  });
});
