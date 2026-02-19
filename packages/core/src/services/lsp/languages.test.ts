/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  typescriptConfig,
  pythonConfig,
  javaConfig,
  goConfig,
  rustConfig,
  supportedLanguages,
  getLanguageConfig,
  getLanguageConfigById,
} from './languages.js';

describe('languages', () => {
  describe('language configurations', () => {
    it('should have typescript config', () => {
      expect(typescriptConfig.languageId).toBe('typescript');
      expect(typescriptConfig.command).toBe('typescript-language-server');
      expect(typescriptConfig.args).toContain('--stdio');
    });

    it('should have python config', () => {
      expect(pythonConfig.languageId).toBe('python');
      expect(pythonConfig.command).toBe('pyright');
      expect(pythonConfig.args).toContain('--stdio');
    });

    it('should have java config', () => {
      expect(javaConfig.languageId).toBe('java');
      expect(javaConfig.command).toBe('jdtls');
    });

    it('should have go config', () => {
      expect(goConfig.languageId).toBe('go');
      expect(goConfig.command).toBe('gopls');
    });

    it('should have rust config', () => {
      expect(rustConfig.languageId).toBe('rust');
      expect(rustConfig.command).toBe('rust-analyzer');
    });
  });

  describe('supportedLanguages', () => {
    it('should have at least 5 supported languages', () => {
      expect(supportedLanguages.length).toBeGreaterThanOrEqual(5);
    });

    it('should contain all expected languages', () => {
      const languageIds = supportedLanguages.map(l => l.languageId);
      expect(languageIds).toContain('typescript');
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('java');
      expect(languageIds).toContain('go');
      expect(languageIds).toContain('rust');
    });
  });

  describe('getLanguageConfig', () => {
    it('should return typescript config for .ts file', () => {
      const config = getLanguageConfig('/path/to/file.ts');
      expect(config?.languageId).toBe('typescript');
    });

    it('should return typescript config for .tsx file', () => {
      const config = getLanguageConfig('/path/to/file.tsx');
      expect(config?.languageId).toBe('typescript');
    });

    it('should return python config for .py file', () => {
      const config = getLanguageConfig('/path/to/file.py');
      expect(config?.languageId).toBe('python');
    });

    it('should return java config for .java file', () => {
      const config = getLanguageConfig('/path/to/file.java');
      expect(config?.languageId).toBe('java');
    });

    it('should return go config for .go file', () => {
      const config = getLanguageConfig('/path/to/file.go');
      expect(config?.languageId).toBe('go');
    });

    it('should return rust config for .rs file', () => {
      const config = getLanguageConfig('/path/to/file.rs');
      expect(config?.languageId).toBe('rust');
    });

    it('should return null for unsupported extension', () => {
      const config = getLanguageConfig('/path/to/file.xyz');
      expect(config).toBeNull();
    });

    it('should handle file paths without extension', () => {
      const config = getLanguageConfig('/path/to/file');
      expect(config).toBeNull();
    });
  });

  describe('getLanguageConfigById', () => {
    it('should return config for typescript', () => {
      const config = getLanguageConfigById('typescript');
      expect(config?.languageId).toBe('typescript');
    });

    it('should return config for python', () => {
      const config = getLanguageConfigById('python');
      expect(config?.languageId).toBe('python');
    });

    it('should return config for java', () => {
      const config = getLanguageConfigById('java');
      expect(config?.languageId).toBe('java');
    });

    it('should return config for go', () => {
      const config = getLanguageConfigById('go');
      expect(config?.languageId).toBe('go');
    });

    it('should return config for rust', () => {
      const config = getLanguageConfigById('rust');
      expect(config?.languageId).toBe('rust');
    });

    it('should return null for unknown language ID', () => {
      const config = getLanguageConfigById('unknown');
      expect(config).toBeNull();
    });
  });
});
