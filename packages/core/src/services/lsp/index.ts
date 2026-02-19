/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// 核心服务
export { LspService } from "./LspService.js";
export { LspClient } from "./LspClient.js";
export { LspServerManager } from "./LspServerManager.js";

// 语言配置
export {
  typescriptConfig,
  pythonConfig,
  pythonPylspConfig,
  javaConfig,
  goConfig,
  rustConfig,
  supportedLanguages,
  getLanguageConfig,
  getLanguageConfigById,
} from "./languages.js";

// 类型定义
export type {
  // 基础类型
  Position,
  Range,
  DocumentUri,
  TextDocumentIdentifier,
  VersionedTextDocumentIdentifier,
  Location,
  TextDocumentItem,
  
  // 文档同步
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  TextDocumentContentChangeEvent,
  
  // 代码补全
  CompletionParams,
  CompletionItem,
  CompletionList,
  CompletionContext,
  
  // 文本编辑
  TextEdit,
  
  // 诊断信息
  Diagnostic,
  DiagnosticRelatedInformation,
  PublishDiagnosticsParams,
  
  // 跳转定义
  DefinitionParams,
  
  // 引用查找
  ReferenceParams,
  ReferenceContext,
  
  // 悬停信息
  HoverParams,
  Hover,
  MarkupContent,
  
  // 符号搜索
  SymbolInformation,
  WorkspaceSymbolParams,
  
  // LSP 能力
  ServerCapabilities,
  CompletionOptions,
  DefinitionOptions,
  HoverOptions,
  WorkspaceSymbolOptions,
  TextDocumentClientCapabilities,
  
  // LSP 初始化
  InitializeParams,
  InitializeResult,
  
  // JSON-RPC
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  
  // 语言配置
  LspServerConfig,
  
  // 枚举类型
  CompletionItemKind,
  DiagnosticSeverity,
} from "./types.js";

export { ErrorCodes } from "./types.js";
