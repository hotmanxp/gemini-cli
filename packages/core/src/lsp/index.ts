/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Core LSP Service
export { NativeLspService } from './NativeLspService.js';
export { NativeLspClient } from './NativeLspClient.js';
export { LspServerManager } from './LspServerManager.js';
export { LspConnectionFactory } from './LspConnectionFactory.js';
export { LspConfigLoader } from './LspConfigLoader.js';
export { LspLanguageDetector } from './LspLanguageDetector.js';
export { LspResponseNormalizer } from './LspResponseNormalizer.js';

// Types
export type {
  // Basic Types
  LspPosition,
  LspRange,
  LspLocation,
  LspLocationWithServer,
  LspSymbolInformation,
  LspReference,
  LspDefinition,
  LspHoverResult,
  LspCallHierarchyItem,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyOutgoingCall,
  
  // Diagnostic Types
  LspDiagnosticSeverity,
  LspDiagnostic,
  LspDiagnosticTag,
  LspDiagnosticRelatedInformation,
  LspFileDiagnostics,
  
  // Code Action Types
  LspCodeAction,
  LspCodeActionKind,
  LspCodeActionContext,
  
  // Workspace Edit Types
  LspWorkspaceEdit,
  LspTextEdit,
  LspTextDocumentEdit,
  LspCommand,
  
  // Client Interface
  LspClient,
  
  // Service Types
  LspInitializationOptions,
  LspSocketOptions,
  LspServerConfig,
  JsonRpcMessage,
  LspConnectionInterface,
  LspServerStatus,
  LspServerHandle,
  NativeLspServiceOptions,
  LspConnectionResult,
} from './types.js';

// Constants
export {
  DEFAULT_LSP_STARTUP_TIMEOUT_MS,
  DEFAULT_LSP_REQUEST_TIMEOUT_MS,
  DEFAULT_LSP_WARMUP_DELAY_MS,
  DEFAULT_LSP_COMMAND_CHECK_TIMEOUT_MS,
  DEFAULT_LSP_MAX_RESTARTS,
  DEFAULT_LSP_SOCKET_RETRY_DELAY_MS,
  DEFAULT_LSP_SOCKET_MAX_RETRY_DELAY_MS,
  SYMBOL_KIND_LABELS,
  DIAGNOSTIC_SEVERITY_LABELS,
  CODE_ACTION_KIND_LABELS,
} from './constants.js';
