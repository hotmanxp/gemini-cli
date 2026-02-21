/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 跟踪 mock 调用
const mockCalls: Array<{ method: string; args?: unknown[] }> = [];

const createMockManager = () => ({
  startServer: vi.fn().mockImplementation(() => {
    mockCalls.push({ method: 'startServer' });
    return Promise.resolve();
  }),
  stopServer: vi.fn().mockImplementation(() => {
    mockCalls.push({ method: 'stopServer' });
    return Promise.resolve();
  }),
  shutdown: vi.fn().mockImplementation(() => {
    mockCalls.push({ method: 'shutdown' });
    return Promise.resolve();
  }),
  getClient: vi.fn().mockImplementation((languageId: string) => {
    mockCalls.push({ method: 'getClient', args: [languageId] });
    return {
      didOpen: vi.fn(),
      didChange: vi.fn(),
      didClose: vi.fn(),
      completion: vi.fn().mockResolvedValue([{ label: 'test' }]),
      definition: vi.fn().mockResolvedValue([{ uri: 'file://test.ts' }]),
      references: vi.fn().mockResolvedValue([{ uri: 'file://test.ts' }]),
      hover: vi.fn().mockResolvedValue({ contents: { value: 'test hover' } }),
    };
  }),
  isServerRunning: vi.fn().mockImplementation((languageId: string) => {
    mockCalls.push({ method: 'isServerRunning', args: [languageId] });
    return false;
  }),
  getActiveLanguages: vi.fn().mockImplementation(() => {
    mockCalls.push({ method: 'getActiveLanguages' });
    return [];
  }),
});

let mockManager: ReturnType<typeof createMockManager>;

vi.mock('./LspServerManager.js', () => ({
  LspServerManager: vi.fn().mockImplementation(() => mockManager),
}));

vi.mock('./languages.js', () => ({
  getLanguageConfigById: vi.fn((id: string) => {
    if (['typescript', 'python', 'java', 'go', 'rust'].includes(id)) {
      return { languageId: id, command: `${id}-language-server` };
    }
    return null;
  }),
  getLanguageConfig: vi.fn((path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      return { languageId: 'typescript', command: 'typescript-language-server', extensions: ['.ts', '.tsx'] };
    }
    if (path.endsWith('.py')) {
      return { languageId: 'python', command: 'pyright', extensions: ['.py'] };
    }
    if (path.endsWith('.java')) {
      return { languageId: 'java', command: 'jdtls', extensions: ['.java'] };
    }
    if (path.endsWith('.go')) {
      return { languageId: 'go', command: 'gopls', extensions: ['.go'] };
    }
    if (path.endsWith('.rs')) {
      return { languageId: 'rust', command: 'rust-analyzer', extensions: ['.rs'] };
    }
    return null;
  }),
}));

describe('LspService', () => {
  let service: import('./LspService.js').LspService;

  beforeEach(async () => {
    mockCalls.length = 0;
    mockManager = createMockManager();
    
    const { LspService } = await import('./LspService.js');
    service = new LspService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('constructor', () => {
    it('should create a service instance', () => {
      expect(service).toBeDefined();
    });

    it('should have no active languages initially', () => {
      expect(service.getActiveLanguages()).toEqual([]);
    });
  });

  describe('startLanguage', () => {
    it('should start a language server for valid language ID', async () => {
      const result = await service.startLanguage('typescript', '/test/workspace');
      expect(result).toBe(true);
      expect(mockManager.startServer).toHaveBeenCalled();
    });

    it('should return false for invalid language ID', async () => {
      const result = await service.startLanguage('unknown', '/test/workspace');
      expect(result).toBe(false);
    });
  });

  describe('autoStartLanguage', () => {
    it('should start server for TypeScript file', async () => {
      const result = await service.autoStartLanguage('/test/file.ts', '/test/workspace');
      expect(result).toBe(true);
    });

    it('should start server for Python file', async () => {
      const result = await service.autoStartLanguage('/test/file.py', '/test/workspace');
      expect(result).toBe(true);
    });

    it('should return false for unsupported file type', async () => {
      const result = await service.autoStartLanguage('/test/file.xyz', '/test/workspace');
      expect(result).toBe(false);
    });

    it('should return true if server already running', async () => {
      mockManager.isServerRunning.mockReturnValueOnce(true);
      const result = await service.autoStartLanguage('/test/file.ts', '/test/workspace');
      expect(result).toBe(true);
    });
  });

  describe('openDocument', () => {
    it('should open a document', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      expect((service as any).documents.has('file://test.ts')).toBe(true);
    });
  });

  describe('closeDocument', () => {
    it('should close a document', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      await service.closeDocument('file://test.ts');
      expect((service as any).documents.has('file://test.ts')).toBe(false);
    });
  });

  describe('getCompletion', () => {
    it('should get completions for open document', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      const result = await service.getCompletion('file://test.ts', 0, 6);
      expect(result).toBeDefined();
    });

    it('should return null for closed document', async () => {
      const result = await service.getCompletion('file://test.ts', 0, 0);
      expect(result).toBe(null);
    });
  });

  describe('goToDefinition', () => {
    it('should get definitions for open document', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      const result = await service.goToDefinition('file://test.ts', 0, 6);
      expect(result).toBeDefined();
    });

    it('should return null for closed document', async () => {
      const result = await service.goToDefinition('file://test.ts', 0, 0);
      expect(result).toBe(null);
    });
  });

  describe('findReferences', () => {
    it('should find references for open document', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      const result = await service.findReferences('file://test.ts', 0, 6);
      expect(result).toBeDefined();
    });

    it('should return null for closed document', async () => {
      const result = await service.findReferences('file://test.ts', 0, 0);
      expect(result).toBe(null);
    });
  });

  describe('getHover', () => {
    it('should get hover information for open document', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      const result = await service.getHover('file://test.ts', 0, 6);
      expect(result).toBeDefined();
    });

    it('should return null for closed document', async () => {
      const result = await service.getHover('file://test.ts', 0, 0);
      expect(result).toBe(null);
    });
  });

  describe('getDiagnostics', () => {
    it('should return empty array when no diagnostics', () => {
      const result = service.getDiagnostics('file://test.ts');
      expect(result).toEqual([]);
    });
  });

  describe('stopLanguage', () => {
    it('should stop a language server', async () => {
      await service.stopLanguage('typescript');
      expect(mockManager.stopServer).toHaveBeenCalledWith('typescript');
    });
  });

  describe('shutdown', () => {
    it('should shutdown all servers and clear state', async () => {
      await service.openDocument('file://test.ts', 'typescript', 'const x = 1;');
      await service.shutdown();
      expect((service as any).documents.size).toBe(0);
      expect((service as any).diagnostics.size).toBe(0);
    });
  });

  describe('isLanguageRunning', () => {
    it('should check if language is running', () => {
      const result = service.isLanguageRunning('typescript');
      expect(result).toBe(false);
    });
  });
});
