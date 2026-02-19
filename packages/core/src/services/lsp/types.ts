/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LSP (Language Server Protocol) 类型定义
 * 基于 LSP 3.17 规范：https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
 */

// ==================== 基础类型 ====================

/**
 * 位置信息
 */
export interface Position {
  /** 行号 (0-based) */
  line: number;
  /** 列号 (0-based) */
  character: number;
}

/**
 * 范围信息
 */
export interface Range {
  /** 起始位置 */
  start: Position;
  /** 结束位置 */
  end: Position;
}

/**
 * 文档 URI
 */
export type DocumentUri = string;

/**
 * 文档标识符
 */
export interface TextDocumentIdentifier {
  /** 文档 URI */
  uri: DocumentUri;
}

/**
 * 文档位置
 */
export interface Location {
  uri: DocumentUri;
  range: Range;
}

/**
 * 带版本的文档标识符
 */
export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  /** 文档版本号 */
  version: number;
}

// ==================== 文档同步 ====================

/**
 * 文本文档内容
 */
export interface TextDocumentItem {
  /** 文档 URI */
  uri: DocumentUri;
  /** 语言 ID (如：typescript, python, java) */
  languageId: string;
  /** 文档版本号 */
  version: number;
  /** 文档内容 */
  text: string;
}

/**
 * 文档打开参数
 */
export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

/**
 * 文本内容变更事件
 */
export interface TextDocumentContentChangeEvent {
  /** 变更范围 (可选，为空表示整个文档变更) */
  range?: Range;
  /** 变更后的文本 */
  text: string;
}

/**
 * 文档变更参数
 */
export interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  /** 变更内容列表 */
  contentChanges: TextDocumentContentChangeEvent[];
}

/**
 * 文档关闭参数
 */
export interface DidCloseTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

// ==================== 代码补全 ====================

/**
 * 补全触发字符
 */
export interface CompletionContext {
  /** 触发类型 */
  triggerKind: number;
  /** 触发字符 (可选) */
  triggerCharacter?: string;
}

/**
 * 补全参数
 */
export interface CompletionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
  context?: CompletionContext;
}

/**
 * 补全项类型
 */
export const CompletionItemKind = {
  Text: 1,
  Method: 2,
  Function: 3,
  Constructor: 4,
  Field: 5,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Module: 9,
  Property: 10,
  Unit: 11,
  Value: 12,
  Enum: 13,
  Keyword: 14,
  Snippet: 15,
  Color: 16,
  File: 17,
  Reference: 18,
  Folder: 19,
  EnumMember: 20,
  Constant: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25,
} as const;

export type CompletionItemKind = (typeof CompletionItemKind)[keyof typeof CompletionItemKind];

/**
 * 补全项
 */
export interface CompletionItem {
  /** 补全项标签 */
  label: string;
  /** 补全项类型 */
  kind?: CompletionItemKind;
  /** 详情 */
  detail?: string;
  /** 文档字符串 */
  documentation?: string | { kind: string; value: string };
  /** 插入文本 */
  textEdit?: TextEdit;
  /** 插入文本 (替代) */
  textEditText?: string;
  /** 排序文本 */
  sortText?: string;
  /** 过滤文本 */
  filterText?: string;
  /** 预选择标记 */
  preselect?: boolean;
}

/**
 * 补全列表
 */
export interface CompletionList {
  /** 是否不完整 */
  isIncomplete: boolean;
  /** 补全项列表 */
  items: CompletionItem[];
}

// ==================== 文本编辑 ====================

/**
 * 文本编辑
 */
export interface TextEdit {
  /** 编辑范围 */
  range: Range;
  /** 新文本 */
  newText: string;
}

// ==================== 诊断信息 ====================

/**
 * 诊断严重程度
 */
export const DiagnosticSeverity = {
  Error: 1,
  Warning: 2,
  Information: 3,
  Hint: 4,
} as const;

export type DiagnosticSeverity = (typeof DiagnosticSeverity)[keyof typeof DiagnosticSeverity];

/**
 * 诊断信息
 */
export interface Diagnostic {
  /** 诊断范围 */
  range: Range;
  /** 严重程度 */
  severity?: DiagnosticSeverity;
  /** 诊断代码 */
  code?: string | number;
  /** 诊断来源 */
  source?: string;
  /** 诊断消息 */
  message: string;
  /** 相关诊断信息 */
  relatedInformation?: DiagnosticRelatedInformation[];
}

/**
 * 诊断相关信息
 */
export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

/**
 * 发布诊断参数
 */
export interface PublishDiagnosticsParams {
  /** 文档 URI */
  uri: DocumentUri;
  /** 诊断列表 */
  diagnostics: Diagnostic[];
  /** 版本号 (可选) */
  version?: number;
}

// ==================== 跳转定义 ====================

/**
 * 定义参数
 */
export interface DefinitionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

// ==================== 引用查找 ====================

/**
 * 引用参数
 */
export interface ReferenceParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
  context?: ReferenceContext;
}

export interface ReferenceContext {
  /** 是否包含声明 */
  includeDeclaration: boolean;
}

// ==================== 悬停信息 ====================

/**
 * 悬停参数
 */
export interface HoverParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

/**
 * 标记内容
 */
export interface MarkupContent {
  kind: string;
  value: string;
}

/**
 * 悬停信息
 */
export interface Hover {
  /** 悬停内容 */
  contents: MarkupContent | { kind: string; value: string } | Array<{ kind: string; value: string }>;
  /** 悬停范围 (可选) */
  range?: Range;
}

// ==================== 符号搜索 ====================

/**
 * 符号信息
 */
export interface SymbolInformation {
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  kind: number;
  /** 符号位置 */
  location: Location;
  /** 容器名称 (如类名) */
  containerName?: string;
}

/**
 * 工作区符号参数
 */
export interface WorkspaceSymbolParams {
  /** 查询字符串 */
  query: string;
}

// ==================== LSP 能力 ====================

/**
 * 补全能力
 */
export interface CompletionOptions {
  /** 是否提供解析补全 */
  resolveProvider?: boolean;
  /** 触发补全的字符 */
  triggerCharacters?: string[];
}

/**
 * 定义能力
 */
export interface DefinitionOptions {
  workDoneProgress?: boolean;
}

/**
 * 悬停能力
 */
export interface HoverOptions {
  workDoneProgress?: boolean;
}

/**
 * 工作区符号能力
 */
export interface WorkspaceSymbolOptions {
  resolveProvider?: boolean;
}

/**
 * 文本文档能力
 */
export interface TextDocumentClientCapabilities {
  synchronization?: {
    dynamicRegistration?: boolean;
    didSave?: boolean;
    willSave?: boolean;
    willSaveWaitUntil?: boolean;
  };
  completion?: {
    dynamicRegistration?: boolean;
    completionItem?: {
      snippetSupport?: boolean;
      commitCharactersSupport?: boolean;
    };
  };
  hover?: {
    dynamicRegistration?: boolean;
  };
  definition?: {
    dynamicRegistration?: boolean;
  };
  references?: {
    dynamicRegistration?: boolean;
  };
}

/**
 * 服务器能力
 */
export interface ServerCapabilities {
  /** 补全能力 */
  completionProvider?: CompletionOptions;
  /** 定义能力 */
  definitionProvider?: boolean | DefinitionOptions;
  /** 引用能力 */
  referencesProvider?: boolean;
  /** 悬停能力 */
  hoverProvider?: boolean | HoverOptions;
  /** 工作区符号能力 */
  workspaceSymbolProvider?: boolean | WorkspaceSymbolOptions;
  /** 文档同步能力 */
  textDocumentSync?: {
    openClose?: boolean;
    change?: number;
    save?: boolean;
  };
}

// ==================== LSP 请求/通知/响应 ====================

/**
 * LSP 请求类型
 */
export type LspRequest =
  | "initialize"
  | "shutdown"
  | "textDocument/completion"
  | "textDocument/definition"
  | "textDocument/references"
  | "textDocument/hover"
  | "textDocument/diagnostic"
  | "workspace/symbol";

/**
 * LSP 通知类型
 */
export type LspNotification =
  | "initialized"
  | "exit"
  | "textDocument/didOpen"
  | "textDocument/didChange"
  | "textDocument/didClose"
  | "textDocument/didSave"
  | "$/cancelRequest"
  | "$/progress";

// ==================== JSON-RPC 类型 ====================

/**
 * JSON-RPC 请求消息
 */
export interface JsonRpcRequest<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: T;
}

/**
 * JSON-RPC 响应消息
 */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 通知消息
 */
export interface JsonRpcNotification<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
}

/**
 * JSON-RPC 错误
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// JSON-RPC 错误码
export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerNotInitialized: -32002,
  UnknownErrorCode: -32001,
} as const;

// ==================== LSP 初始化 ====================

/**
 * 初始化参数
 */
export interface InitializeParams {
  /** 进程 ID */
  processId: number | null;
  /** 客户端信息 */
  clientInfo?: {
    name: string;
    version?: string;
  };
  /** 根目录 URI */
  rootUri?: DocumentUri | null;
  /** 根路径 (已废弃) */
  rootPath?: string | null;
  /** 客户端能力 */
  capabilities: {
    textDocument?: TextDocumentClientCapabilities;
    workspace?: {
      workspaceFolders?: boolean;
    };
  };
  /** 工作区文件夹 */
  workspaceFolders?: Array<{
    uri: DocumentUri;
    name: string;
  }> | null;
}

/**
 * 初始化结果
 */
export interface InitializeResult {
  /** 服务器能力 */
  capabilities: ServerCapabilities;
  /** 服务器信息 */
  serverInfo?: {
    name: string;
    version?: string;
  };
}

// ==================== 语言配置 ====================

/**
 * LSP Server 配置
 */
export interface LspServerConfig {
  /** 语言 ID */
  languageId: string;
  /** 文件扩展名列表 */
  extensions: string[];
  /** LSP Server 命令 */
  command: string;
  /** 命令参数 */
  args: string[];
  /** 环境变量 (可选) */
  env?: Record<string, string>;
}
