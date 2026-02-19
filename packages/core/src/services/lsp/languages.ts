/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LspServerConfig } from "./types.js";

/**
 * TypeScript/JavaScript LSP 配置
 */
export const typescriptConfig: LspServerConfig = {
  languageId: "typescript",
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"],
  command: "typescript-language-server",
  args: ["--stdio"],
};

/**
 * Python LSP 配置 (使用 pyright)
 */
export const pythonConfig: LspServerConfig = {
  languageId: "python",
  extensions: [".py", ".pyw"],
  command: "pyright",
  args: ["--stdio"],
};

/**
 * Python LSP 配置 (备选：pylsp)
 */
export const pythonPylspConfig: LspServerConfig = {
  languageId: "python",
  extensions: [".py", ".pyw"],
  command: "pylsp",
  args: [],
};

/**
 * Java LSP 配置 (使用 jdtls)
 * 注意：jdtls 需要单独下载，这里使用常见的安装路径
 */
export const javaConfig: LspServerConfig = {
  languageId: "java",
  extensions: [".java"],
  command: "jdtls",
  args: [],
  env: {
    // jdtls 需要设置工作目录和数据目录
    JDTLS_WORKSPACE: "${workspaceFolder}",
  },
};

/**
 * Go LSP 配置 (使用 gopls)
 */
export const goConfig: LspServerConfig = {
  languageId: "go",
  extensions: [".go"],
  command: "gopls",
  args: [],
};

/**
 * Rust LSP 配置 (使用 rust-analyzer)
 */
export const rustConfig: LspServerConfig = {
  languageId: "rust",
  extensions: [".rs"],
  command: "rust-analyzer",
  args: [],
};

/**
 * 所有支持的语言配置列表
 */
export const supportedLanguages: LspServerConfig[] = [
  typescriptConfig,
  pythonConfig,
  pythonPylspConfig,
  javaConfig,
  goConfig,
  rustConfig,
];

/**
 * 根据文件扩展名获取语言配置
 * @param filePath 文件路径
 * @returns 匹配的语言配置，如果没有匹配则返回 null
 */
export function getLanguageConfig(filePath: string): LspServerConfig | null {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  for (const config of supportedLanguages) {
    if (config.extensions.includes(ext)) {
      return config;
    }
  }
  return null;
}

/**
 * 根据语言 ID 获取语言配置
 * @param languageId 语言 ID
 * @returns 匹配的语言配置，如果没有匹配则返回 null
 */
export function getLanguageConfigById(
  languageId: string
): LspServerConfig | null {
  for (const config of supportedLanguages) {
    if (config.languageId === languageId) {
      return config;
    }
  }
  return null;
}
