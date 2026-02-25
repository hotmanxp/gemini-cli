/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ToolInvocation, ToolResult } from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
// Tool names defined inline
import type { Config } from '../config/config.js';
import { debugLogger } from '../utils/debugLogger.js';
import type {
  LspCallHierarchyIncomingCall,
  LspCallHierarchyItem,
  LspCallHierarchyOutgoingCall,
  LspClient,
  LspCodeAction,
  LspCodeActionContext,
  LspCodeActionKind,
  LspDefinition,
  LspDiagnostic,
  LspFileDiagnostics,
  LspLocation,
  LspRange,
  LspReference,
  LspSymbolInformation,
  LspTextEdit,
  LspTextDocumentEdit,
  LspWorkspaceEdit,
} from '../lsp/types.js';

/**
 * Supported LSP operations.
 */
export type LspOperation =
  | 'goToDefinition'
  | 'findReferences'
  | 'hover'
  | 'documentSymbol'
  | 'workspaceSymbol'
  | 'goToImplementation'
  | 'prepareCallHierarchy'
  | 'incomingCalls'
  | 'outgoingCalls'
  | 'diagnostics'
  | 'workspaceDiagnostics'
  | 'codeActions'
  | 'warmup'
  | 'prepareRename'
  | 'rename';

/**
 * Parameters for the unified LSP tool.
 */
export interface LspToolParams {
  /** Operation to perform. */
  operation: LspOperation;
  /** File path (absolute or workspace-relative). */
  filePath?: string;
  /** 1-based line number when targeting a specific file location. */
  line?: number;
  /** 1-based character/column number when targeting a specific file location. */
  character?: number;
  /** End line for range-based operations (1-based). */
  endLine?: number;
  /** End character for range-based operations (1-based). */
  endCharacter?: number;
  /** Whether to include the declaration in reference results. */
  includeDeclaration?: boolean;
  /** Query string for workspace symbol search. */
  query?: string;
  /** Call hierarchy item from a previous call hierarchy operation. */
  callHierarchyItem?: LspCallHierarchyItem;
  /** Optional server name override. */
  serverName?: string;
  /** Optional maximum number of results. */
  limit?: number;
  /** Diagnostics for code action context. */
  diagnostics?: LspDiagnostic[];
  /** Code action kinds to filter by. */
  codeActionKinds?: LspCodeActionKind[];
}

type ResolvedTarget =
  | {
      location: LspLocation;
      description: string;
    }
  | { error: string };

/** Operations that require filePath and line. */
const LOCATION_REQUIRED_OPERATIONS = new Set<LspOperation>([
  'goToDefinition',
  'findReferences',
  'hover',
  'goToImplementation',
  'prepareCallHierarchy',
  'prepareRename',
  'rename',
]);

/** Operations that only require filePath. */
const FILE_REQUIRED_OPERATIONS = new Set<LspOperation>([
  'documentSymbol',
  'diagnostics',
]);

/** Operations that require query. */
const QUERY_REQUIRED_OPERATIONS = new Set<LspOperation>(['workspaceSymbol']);

/** Operations that require callHierarchyItem. */
const ITEM_REQUIRED_OPERATIONS = new Set<LspOperation>([
  'incomingCalls',
  'outgoingCalls',
]);

/** Operations that require filePath and range for code actions. */
const RANGE_REQUIRED_OPERATIONS = new Set<LspOperation>(['codeActions']);

class LspToolInvocation extends BaseToolInvocation<LspToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    params: LspToolParams,
    messageBus: MessageBus,
  ) {
    super(params, messageBus);
  }

  getDescription(): string {
    const operationLabel = this.getOperationLabel();
    if (this.params.operation === 'workspaceSymbol') {
      return `LSP ${operationLabel} for "${this.params.query ?? ''}"`;
    }
    if (this.params.operation === 'documentSymbol') {
      return this.params.filePath
        ? `LSP ${operationLabel} for ${this.params.filePath}`
        : `LSP ${operationLabel}`;
    }
    if (
      this.params.operation === 'incomingCalls' ||
      this.params.operation === 'outgoingCalls'
    ) {
      return `LSP ${operationLabel} for ${this.describeCallHierarchyItemShort()}`;
    }
    if (this.params.filePath && this.params.line !== undefined) {
      return `LSP ${operationLabel} at ${this.params.filePath}:${this.params.line}:${this.params.character ?? 1}`;
    }
    if (this.params.filePath) {
      return `LSP ${operationLabel} for ${this.params.filePath}`;
    }
    return `LSP ${operationLabel}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    if (!this.config.isLspEnabled()) {
      const message = `LSP ${this.getOperationLabel()} is unavailable (LSP disabled).`;
      return { llmContent: message, returnDisplay: message };
    }

    const client = this.config.getLspClient();
    if (!client) {
      const message = `LSP ${this.getOperationLabel()} is unavailable (LSP server not initialized).`;
      return { llmContent: message, returnDisplay: message };
    }

    // Ensure server is running for the requested operation (lazy loading)
    const language = this.inferLanguageFromOperation();
    if (language) {
      debugLogger.log(
        `Ensuring LSP server for ${language} is running before operation ${this.params.operation}...`,
      );
      try {
        await client.ensureServerRunning(language);
      } catch (error) {
        const message = `Failed to start LSP server for ${language}: ${
          (error as Error)?.message || String(error)
        }`;
        return { llmContent: message, returnDisplay: message };
      }
    }

    try {
      switch (this.params.operation) {
        case 'goToDefinition':
          return await this.executeDefinitions(client);
        case 'findReferences':
          return await this.executeReferences(client);
        case 'hover':
          return await this.executeHover(client);
        case 'documentSymbol':
          return await this.executeDocumentSymbols(client);
        case 'workspaceSymbol':
          return await this.executeWorkspaceSymbols(client);
        case 'goToImplementation':
          return await this.executeImplementations(client);
        case 'prepareCallHierarchy':
          return await this.executePrepareCallHierarchy(client);
        case 'incomingCalls':
          return await this.executeIncomingCalls(client);
        case 'outgoingCalls':
          return await this.executeOutgoingCalls(client);
        case 'diagnostics':
          return await this.executeDiagnostics(client);
        case 'workspaceDiagnostics':
          return await this.executeWorkspaceDiagnostics(client);
        case 'codeActions':
          return await this.executeCodeActions(client);
        case 'warmup':
          return await this.executeWarmup();
        case 'prepareRename':
          return await this.executePrepareRename(client);
        case 'rename':
          return await this.executeRename(client);
        default: {
          const message = `Unsupported LSP operation: ${this.params.operation}`;
          return { llmContent: message, returnDisplay: message };
        }
      }
    } finally {
      // Release server reference when operation is complete
      if (language) {
        try {
          await client.releaseServer(language);
        } catch (error) {
          debugLogger.warn(`Failed to release LSP server ${language}:`, error);
        }
      }
    }
  }

  private async executeDefinitions(client: LspClient): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const limit = this.params.limit ?? 20;
    let definitions: LspDefinition[] = [];
    try {
      definitions = await client.definitions(
        target.location,
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP go-to-definition failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!definitions.length) {
      const message = `No definitions found for ${target.description}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const lines = definitions
      .slice(0, limit)
      .map(
        (definition, index) =>
          `${index + 1}. ${this.formatLocationWithServer(definition, workspaceRoot)}`,
      );

    const heading = `Definitions for ${target.description}:`;
    return {
      llmContent: [heading, ...lines].join('\n'),
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeImplementations(client: LspClient): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const limit = this.params.limit ?? 20;
    let implementations: LspDefinition[] = [];
    try {
      implementations = await client.implementations(
        target.location,
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP go-to-implementation failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!implementations.length) {
      const message = `No implementations found for ${target.description}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const lines = implementations
      .slice(0, limit)
      .map(
        (implementation, index) =>
          `${index + 1}. ${this.formatLocationWithServer(implementation, workspaceRoot)}`,
      );

    const heading = `Implementations for ${target.description}:`;
    return {
      llmContent: [heading, ...lines].join('\n'),
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeReferences(client: LspClient): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const limit = this.params.limit ?? 50;
    let references: LspReference[] = [];
    try {
      references = await client.references(
        target.location,
        this.params.serverName,
        this.params.includeDeclaration ?? false,
        limit,
      );
    } catch (error) {
      const message = `LSP find-references failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!references.length) {
      const message = `No references found for ${target.description}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const lines = references
      .slice(0, limit)
      .map(
        (reference, index) =>
          `${index + 1}. ${this.formatLocationWithServer(reference, workspaceRoot)}`,
      );

    const heading = `References for ${target.description}:`;
    return {
      llmContent: [heading, ...lines].join('\n'),
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeHover(client: LspClient): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    let hoverText = '';
    try {
      const result = await client.hover(
        target.location,
        this.params.serverName,
      );
      if (result) {
        hoverText = result.contents ?? '';
      }
    } catch (error) {
      const message = `LSP hover failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!hoverText || hoverText.trim().length === 0) {
      const message = `No hover information found for ${target.description}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const heading = `Hover for ${target.description}:`;
    const content = hoverText.trim();
    return {
      llmContent: `${heading}\n${content}`,
      returnDisplay: content,
    };
  }

  private async executeDocumentSymbols(client: LspClient): Promise<ToolResult> {
    const workspaceRoot = this.config.getProjectRoot();
    const filePath = this.params.filePath ?? '';
    const uri = this.resolveUri(filePath, workspaceRoot);
    if (!uri) {
      const message = 'A valid filePath is required for document symbols.';
      return { llmContent: message, returnDisplay: message };
    }

    const limit = this.params.limit ?? 50;
    let symbols: LspSymbolInformation[] = [];
    try {
      symbols = await client.documentSymbols(
        uri,
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP document symbols failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!symbols.length) {
      const fileLabel = this.formatUriForDisplay(uri, workspaceRoot);
      const message = `No document symbols found for ${fileLabel}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const lines = symbols.slice(0, limit).map((symbol, index) => {
      const location = this.formatLocationWithoutServer(
        symbol.location,
        workspaceRoot,
      );
      const serverSuffix = symbol.serverName ? ` [${symbol.serverName}]` : '';
      const kind = symbol.kind ? ` (${symbol.kind})` : '';
      const container = symbol.containerName
        ? ` in ${symbol.containerName}`
        : '';
      return `${index + 1}. ${symbol.name}${kind}${container} - ${location}${serverSuffix}`;
    });

    const fileLabel = this.formatUriForDisplay(uri, workspaceRoot);
    const heading = `Document symbols for ${fileLabel}:`;
    return {
      llmContent: [heading, ...lines].join('\n'),
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeWorkspaceSymbols(
    client: LspClient,
  ): Promise<ToolResult> {
    const limit = this.params.limit ?? 20;
    const query = this.params.query ?? '';
    let symbols: LspSymbolInformation[] = [];
    try {
      symbols = await client.workspaceSymbols(query, limit);
    } catch (error) {
      const message = `LSP workspace symbol search failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!symbols.length) {
      const message = `No symbols found for query "${query}".`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const lines = symbols.slice(0, limit).map((symbol, index) => {
      const location = this.formatLocationWithoutServer(
        symbol.location,
        workspaceRoot,
      );
      const serverSuffix = symbol.serverName ? ` [${symbol.serverName}]` : '';
      const kind = symbol.kind ? ` (${symbol.kind})` : '';
      const container = symbol.containerName
        ? ` in ${symbol.containerName}`
        : '';
      return `${index + 1}. ${symbol.name}${kind}${container} - ${location}${serverSuffix}`;
    });

    const heading = `Found ${Math.min(symbols.length, limit)} of ${
      symbols.length
    } symbols for query "${query}":`;

    // Also fetch references for the top match to provide additional context.
    let referenceSection = '';
    const topSymbol = symbols[0];
    if (topSymbol) {
      try {
        const referenceLimit = Math.min(20, Math.max(limit, 5));
        const references = await client.references(
          topSymbol.location,
          topSymbol.serverName,
          false,
          referenceLimit,
        );
        if (references.length > 0) {
          const refLines = references.map((ref, index) => {
            const location = this.formatLocationWithoutServer(
              ref,
              workspaceRoot,
            );
            const serverSuffix = ref.serverName ? ` [${ref.serverName}]` : '';
            return `${index + 1}. ${location}${serverSuffix}`;
          });
          referenceSection = [
            '',
            `References for top match (${topSymbol.name}):`,
            ...refLines,
          ].join('\n');
        }
      } catch (error) {
        referenceSection = `\nReferences lookup failed: ${
          (error as Error)?.message || String(error)
        }`;
      }
    }

    const llmParts = referenceSection
      ? [heading, ...lines, referenceSection]
      : [heading, ...lines];
    const displayParts = referenceSection
      ? [...lines, referenceSection]
      : [...lines];

    return {
      llmContent: llmParts.join('\n'),
      returnDisplay: displayParts.join('\n'),
    };
  }

  private async executePrepareCallHierarchy(
    client: LspClient,
  ): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const limit = this.params.limit ?? 20;
    let items: LspCallHierarchyItem[] = [];
    try {
      items = await client.prepareCallHierarchy(
        target.location,
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP call hierarchy prepare failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!items.length) {
      const message = `No call hierarchy items found for ${target.description}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const slicedItems = items.slice(0, limit);
    const lines = slicedItems.map((item, index) =>
      this.formatCallHierarchyItemLine(item, index, workspaceRoot),
    );

    const heading = `Call hierarchy items for ${target.description}:`;
    const jsonSection = this.formatJsonSection(
      'Call hierarchy items (JSON)',
      slicedItems,
    );
    return {
      llmContent: [heading, ...lines].join('\n') + jsonSection,
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeIncomingCalls(client: LspClient): Promise<ToolResult> {
    const item = this.params.callHierarchyItem;
    if (!item) {
      const message = 'callHierarchyItem is required for incomingCalls.';
      return { llmContent: message, returnDisplay: message };
    }

    const limit = this.params.limit ?? 20;
    const serverName = this.params.serverName ?? item.serverName;
    let calls: LspCallHierarchyIncomingCall[] = [];
    try {
      calls = await client.incomingCalls(item, serverName, limit);
    } catch (error) {
      const message = `LSP incoming calls failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!calls.length) {
      const message = `No incoming calls found for ${this.describeCallHierarchyItemFull(
        item,
      )}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const slicedCalls = calls.slice(0, limit);
    const lines = slicedCalls.map((call, index) => {
      const targetItem = call.from;
      const location = this.formatLocationWithServer(
        {
          uri: targetItem.uri,
          range: targetItem.selectionRange,
          serverName: targetItem.serverName,
        },
        workspaceRoot,
      );
      const kind = targetItem.kind ? ` (${targetItem.kind})` : '';
      const detail = targetItem.detail ? ` ${targetItem.detail}` : '';
      const rangeSuffix = this.formatCallRanges(call.fromRanges);
      return `${index + 1}. ${targetItem.name}${kind}${detail} - ${location}${rangeSuffix}`;
    });

    const heading = `Incoming calls for ${this.describeCallHierarchyItemFull(
      item,
    )}:`;
    const jsonSection = this.formatJsonSection(
      'Incoming calls (JSON)',
      slicedCalls,
    );
    return {
      llmContent: [heading, ...lines].join('\n') + jsonSection,
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeOutgoingCalls(client: LspClient): Promise<ToolResult> {
    const item = this.params.callHierarchyItem;
    if (!item) {
      const message = 'callHierarchyItem is required for outgoingCalls.';
      return { llmContent: message, returnDisplay: message };
    }

    const limit = this.params.limit ?? 20;
    const serverName = this.params.serverName ?? item.serverName;
    let calls: LspCallHierarchyOutgoingCall[] = [];
    try {
      calls = await client.outgoingCalls(item, serverName, limit);
    } catch (error) {
      const message = `LSP outgoing calls failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!calls.length) {
      const message = `No outgoing calls found for ${this.describeCallHierarchyItemFull(
        item,
      )}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const slicedCalls = calls.slice(0, limit);
    const lines = slicedCalls.map((call, index) => {
      const targetItem = call.to;
      const location = this.formatLocationWithServer(
        {
          uri: targetItem.uri,
          range: targetItem.selectionRange,
          serverName: targetItem.serverName,
        },
        workspaceRoot,
      );
      const kind = targetItem.kind ? ` (${targetItem.kind})` : '';
      const detail = targetItem.detail ? ` ${targetItem.detail}` : '';
      const rangeSuffix = this.formatCallRanges(call.fromRanges);
      return `${index + 1}. ${targetItem.name}${kind}${detail} - ${location}${rangeSuffix}`;
    });

    const heading = `Outgoing calls for ${this.describeCallHierarchyItemFull(
      item,
    )}:`;
    const jsonSection = this.formatJsonSection(
      'Outgoing calls (JSON)',
      slicedCalls,
    );
    return {
      llmContent: [heading, ...lines].join('\n') + jsonSection,
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeDiagnostics(client: LspClient): Promise<ToolResult> {
    const workspaceRoot = this.config.getProjectRoot();
    const filePath = this.params.filePath ?? '';
    const uri = this.resolveUri(filePath, workspaceRoot);
    if (!uri) {
      const message = 'A valid filePath is required for diagnostics.';
      return { llmContent: message, returnDisplay: message };
    }

    let diagnostics: LspDiagnostic[] = [];
    try {
      diagnostics = await client.diagnostics(uri, this.params.serverName);
    } catch (error) {
      const message = `LSP diagnostics failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!diagnostics.length) {
      const fileLabel = this.formatUriForDisplay(uri, workspaceRoot);
      const message = `No diagnostics found for ${fileLabel}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const lines = diagnostics.map((diag, index) => {
      const severity = diag.severity ? `[${diag.severity.toUpperCase()}]` : '';
      const position = `${diag.range.start.line + 1}:${diag.range.start.character + 1}`;
      const code = diag.code ? ` (${diag.code})` : '';
      const source = diag.source ? ` [${diag.source}]` : '';
      return `${index + 1}. ${severity} ${position}${code}${source}: ${diag.message}`;
    });

    const fileLabel = this.formatUriForDisplay(uri, workspaceRoot);
    const heading = `Diagnostics for ${fileLabel} (${diagnostics.length} issues):`;
    return {
      llmContent: [heading, ...lines].join('\n'),
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeWorkspaceDiagnostics(
    client: LspClient,
  ): Promise<ToolResult> {
    const limit = this.params.limit ?? 50;
    let fileDiagnostics: LspFileDiagnostics[] = [];
    try {
      fileDiagnostics = await client.workspaceDiagnostics(
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP workspace diagnostics failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!fileDiagnostics.length) {
      const message = 'No diagnostics found in the workspace.';
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const lines: string[] = [];
    let totalIssues = 0;

    for (const fileDiag of fileDiagnostics) {
      const fileLabel = this.formatUriForDisplay(fileDiag.uri, workspaceRoot);
      const serverSuffix = fileDiag.serverName
        ? ` [${fileDiag.serverName}]`
        : '';
      lines.push(`\n${fileLabel}${serverSuffix}:`);

      for (const diag of fileDiag.diagnostics) {
        const severity = diag.severity
          ? `[${diag.severity.toUpperCase()}]`
          : '';
        const position = `${diag.range.start.line + 1}:${diag.range.start.character + 1}`;
        const code = diag.code ? ` (${diag.code})` : '';
        lines.push(`  ${severity} ${position}${code}: ${diag.message}`);
        totalIssues++;
      }
    }

    const heading = `Workspace diagnostics (${totalIssues} issues in ${fileDiagnostics.length} files):`;
    return {
      llmContent: [heading, ...lines].join('\n'),
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeCodeActions(client: LspClient): Promise<ToolResult> {
    const workspaceRoot = this.config.getProjectRoot();
    const filePath = this.params.filePath ?? '';
    const uri = this.resolveUri(filePath, workspaceRoot);
    if (!uri) {
      const message = 'A valid filePath is required for code actions.';
      return { llmContent: message, returnDisplay: message };
    }

    // Build range from params
    const startLine = Math.max(0, (this.params.line ?? 1) - 1);
    const startChar = Math.max(0, (this.params.character ?? 1) - 1);
    const endLine = Math.max(
      0,
      (this.params.endLine ?? this.params.line ?? 1) - 1,
    );
    const endChar = Math.max(
      0,
      (this.params.endCharacter ?? this.params.character ?? 1) - 1,
    );

    const range: LspRange = {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    };

    // Build context
    const context: LspCodeActionContext = {
      diagnostics: this.params.diagnostics ?? [],
      only: this.params.codeActionKinds,
      triggerKind: 'invoked',
    };

    const limit = this.params.limit ?? 20;
    let actions: LspCodeAction[] = [];
    try {
      actions = await client.codeActions(
        uri,
        range,
        context,
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP code actions failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!actions.length) {
      const fileLabel = this.formatUriForDisplay(uri, workspaceRoot);
      const message = `No code actions available at ${fileLabel}:${startLine + 1}:${startChar + 1}.`;
      return { llmContent: message, returnDisplay: message };
    }

    const lines = actions.slice(0, limit).map((action, index) => {
      const kind = action.kind ? ` [${action.kind}]` : '';
      const preferred = action.isPreferred ? ' ★' : '';
      const hasEdit = action.edit ? ' (has edit)' : '';
      const hasCommand = action.command ? ' (has command)' : '';
      const serverSuffix = action.serverName ? ` [${action.serverName}]` : '';
      return `${index + 1}. ${action.title}${kind}${preferred}${hasEdit}${hasCommand}${serverSuffix}`;
    });

    const fileLabel = this.formatUriForDisplay(uri, workspaceRoot);
    const heading = `Code actions at ${fileLabel}:${startLine + 1}:${startChar + 1}:`;
    const jsonSection = this.formatJsonSection(
      'Code actions (JSON)',
      actions.slice(0, limit),
    );
    return {
      llmContent: [heading, ...lines].join('\n') + jsonSection,
      returnDisplay: lines.join('\n'),
    };
  }

  private async executeWarmup(): Promise<ToolResult> {
    const client = this.config.getLspClient();
    if (!client || typeof client.warmup !== 'function') {
      const message =
        'LSP warmup is unavailable (LSP client not initialized or does not support warmup).';
      return { llmContent: message, returnDisplay: message };
    }

    try {
      await client.warmup(this.params.serverName);
      const serverLabel = this.params.serverName
        ? ` "${this.params.serverName}"`
        : 'all servers';
      const message = `LSP warmup completed for${serverLabel}.`;
      return { llmContent: message, returnDisplay: message };
    } catch (error) {
      const message = `LSP warmup failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }
  }

  private async executePrepareRename(client: LspClient): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    let result: { range: LspRange; placeholder: string } | null = null;
    try {
      result = await client.prepareRename(
        target.location,
        this.params.serverName,
      );
    } catch (error) {
      const message = `LSP prepare rename failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!result) {
      const message = `Cannot rename at ${target.description}. The LSP server does not support renaming at this location.`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const rangeText = `${result.range.start.line + 1}:${result.range.start.character + 1}-${result.range.end.line + 1}:${result.range.end.character + 1}`;
    const content = `Prepare rename successful.\nSymbol: "${result.placeholder}"\nRange: ${rangeText}`;

    return {
      llmContent: content,
      returnDisplay: `Rename symbol "${result.placeholder}" at ${this.formatLocationWithServer({ ...target.location, serverName: this.params.serverName }, workspaceRoot)}`,
    };
  }

  private async executeRename(client: LspClient): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const newName = this.params.query;
    if (!newName) {
      return {
        llmContent:
          'The "query" parameter (new name) is required for rename operation.',
        returnDisplay:
          'The "query" parameter (new name) is required for rename operation.',
      };
    }

    let edit: LspWorkspaceEdit | null = null;
    try {
      edit = await client.rename(
        target.location,
        newName,
        this.params.serverName,
      );
    } catch (error) {
      const message = `LSP rename failed: ${
        (error as Error)?.message || String(error)
      }`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!edit || (!edit.changes && !edit.documentChanges)) {
      const message = `Rename operation returned no edits for ${target.description}.`;
      return { llmContent: message, returnDisplay: message };
    }

    // Apply the workspace edit
    const success = await client.applyWorkspaceEdit(
      edit,
      this.params.serverName,
    );

    if (!success) {
      const message = `Failed to apply workspace edit for rename operation.`;
      return { llmContent: message, returnDisplay: message };
    }

    const changeCount = edit.changes
      ? Object.values(edit.changes).reduce(
          (sum: number, edits: LspTextEdit[]) => sum + edits.length,
          0,
        )
      : (edit.documentChanges?.reduce(
          (sum: number, change: LspTextDocumentEdit) =>
            sum + (change.edits?.length ?? 0),
          0,
        ) ?? 0);

    const content = `Rename successful.\nNew name: "${newName}"\nChanges applied: ${changeCount} edits`;

    return {
      llmContent: content,
      returnDisplay: `Renamed to "${newName}" (${changeCount} changes)`,
    };
  }

  private resolveLocationTarget(): ResolvedTarget {
    const filePath = this.params.filePath;
    if (!filePath) {
      return {
        error: 'filePath is required for this operation.',
      };
    }
    if (typeof this.params.line !== 'number') {
      return {
        error: 'line is required for this operation.',
      };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const uri = this.resolveUri(filePath, workspaceRoot);
    if (!uri) {
      return {
        error: 'A valid filePath is required when specifying a line/character.',
      };
    }

    const position = {
      line: Math.max(0, Math.floor(this.params.line - 1)),
      character: Math.max(0, Math.floor((this.params.character ?? 1) - 1)),
    };
    const location: LspLocation = {
      uri,
      range: { start: position, end: position },
    };
    const description = this.formatLocationWithServer(
      { ...location, serverName: this.params.serverName },
      workspaceRoot,
    );
    return {
      location,
      description,
    };
  }

  private resolveUri(filePath: string, workspaceRoot: string): string | null {
    if (!filePath) {
      return null;
    }
    if (filePath.startsWith('file://') || filePath.includes('://')) {
      return filePath;
    }
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(workspaceRoot, filePath);
    return pathToFileURL(absolutePath).toString();
  }

  private formatLocationWithServer(
    location: LspLocation & { serverName?: string },
    workspaceRoot: string,
  ): string {
    const start = location.range.start;
    let filePath = location.uri;

    if (filePath.startsWith('file://')) {
      filePath = fileURLToPath(filePath);
      filePath = path.relative(workspaceRoot, filePath) || '.';
    }

    const serverSuffix =
      location.serverName && location.serverName !== ''
        ? ` [${location.serverName}]`
        : '';

    return `${filePath}:${(start.line ?? 0) + 1}:${(start.character ?? 0) + 1}${serverSuffix}`;
  }

  private formatLocationWithoutServer(
    location: LspLocation,
    workspaceRoot: string,
  ): string {
    const { uri, range } = location;
    let filePath = uri;
    if (uri.startsWith('file://')) {
      filePath = fileURLToPath(uri);
      filePath = path.relative(workspaceRoot, filePath) || '.';
    }
    const line = (range.start.line ?? 0) + 1;
    const character = (range.start.character ?? 0) + 1;
    return `${filePath}:${line}:${character}`;
  }

  private formatCallHierarchyItemLine(
    item: LspCallHierarchyItem,
    index: number,
    workspaceRoot: string,
  ): string {
    const location = this.formatLocationWithServer(
      {
        uri: item.uri,
        range: item.selectionRange,
        serverName: item.serverName,
      },
      workspaceRoot,
    );
    const kind = item.kind ? ` (${item.kind})` : '';
    const detail = item.detail ? ` ${item.detail}` : '';
    return `${index + 1}. ${item.name}${kind}${detail} - ${location}`;
  }

  private formatCallRanges(ranges: LspRange[]): string {
    if (!ranges.length) {
      return '';
    }
    const formatted = ranges.map((range) => this.formatPosition(range.start));
    const maxShown = 3;
    const shown = formatted.slice(0, maxShown);
    const extra =
      formatted.length > maxShown
        ? `, +${formatted.length - maxShown} more`
        : '';
    return ` (calls at ${shown.join(', ')}${extra})`;
  }

  private formatPosition(position: LspRange['start']): string {
    return `${(position.line ?? 0) + 1}:${(position.character ?? 0) + 1}`;
  }

  private formatUriForDisplay(uri: string, workspaceRoot: string): string {
    let filePath = uri;
    if (uri.startsWith('file://')) {
      filePath = fileURLToPath(uri);
    }
    if (path.isAbsolute(filePath)) {
      return path.relative(workspaceRoot, filePath) || '.';
    }
    return filePath;
  }

  private formatJsonSection(label: string, data: unknown): string {
    return `\n\n${label}:\n${JSON.stringify(data, null, 2)}`;
  }

  private describeCallHierarchyItemShort(): string {
    const item = this.params.callHierarchyItem;
    if (!item) {
      return 'call hierarchy item';
    }
    return item.name || 'call hierarchy item';
  }

  private describeCallHierarchyItemFull(item: LspCallHierarchyItem): string {
    const workspaceRoot = this.config.getProjectRoot();
    const location = this.formatLocationWithServer(
      {
        uri: item.uri,
        range: item.selectionRange,
        serverName: item.serverName,
      },
      workspaceRoot,
    );
    return `${item.name} at ${location}`;
  }

  private getOperationLabel(): string {
    switch (this.params.operation) {
      case 'goToDefinition':
        return 'go-to-definition';
      case 'findReferences':
        return 'find-references';
      case 'hover':
        return 'hover';
      case 'documentSymbol':
        return 'document symbols';
      case 'workspaceSymbol':
        return 'workspace symbol search';
      case 'goToImplementation':
        return 'go-to-implementation';
      case 'prepareCallHierarchy':
        return 'prepare call hierarchy';
      case 'incomingCalls':
        return 'incoming calls';
      case 'outgoingCalls':
        return 'outgoing calls';
      case 'diagnostics':
        return 'diagnostics';
      case 'workspaceDiagnostics':
        return 'workspace diagnostics';
      case 'codeActions':
        return 'code actions';
      case 'prepareRename':
        return 'prepare rename';
      case 'rename':
        return 'rename';
      default:
        return this.params.operation;
    }
  }

  /**
   * Infer the programming language from the operation parameters.
   * This is used for lazy loading - starting servers only when needed.
   */
  private inferLanguageFromOperation(): string | null {
    // If filePath is provided, infer from extension
    if (this.params.filePath) {
      const ext = path.extname(this.params.filePath).toLowerCase().slice(1);
      if (ext === 'ts' || ext === 'tsx') return 'typescript';
      if (ext === 'js' || ext === 'jsx') return 'javascript';
      if (ext === 'json') return 'json';
      if (ext === 'yml' || ext === 'yaml') return 'yaml';
      if (ext === 'html' || ext === 'htm') return 'html';
      if (ext === 'vue') return 'vue';
      if (ext === 'svelte') return 'svelte';
      if (ext === 'css' || ext === 'scss' || ext === 'less') return 'css';
      if (ext === 'sh' || ext === 'bash') return 'bash';
      if (ext === 'sql') return 'sql';
      if (ext === 'md' || ext === 'markdown') return 'markdown';
      if (ext === 'php') return 'php';
      if (ext === 'py') return 'python';
      if (ext === 'go') return 'go';
      if (ext === 'rs') return 'rust';
      if (ext === 'java') return 'java';
      if (ext === 'dockerfile') return 'dockerfile';
    }

    // If operation is warmup with serverName, use that
    if (this.params.operation === 'warmup' && this.params.serverName) {
      return this.params.serverName;
    }

    return null;
  }
}

/**
 * Unified LSP tool for code intelligence.
 *
 * Supports: goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol,
 * goToImplementation, call hierarchy, diagnostics, codeActions, rename, and warmup.
 */
export class LspTool extends BaseDeclarativeTool<LspToolParams, ToolResult> {
  static readonly Name = 'lsp';

  constructor(
    private readonly config: Config,
    messageBus: MessageBus,
  ) {
    super(
      LspTool.Name,
      'LSP',
      'Interact with Language Server Protocol (LSP) servers for code intelligence. Supports: goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation, call hierarchy (prepare/incoming/outgoing), diagnostics, codeActions, prepareRename, rename, and warmup.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description:
              'LSP operation to execute: goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, goToImplementation, prepareCallHierarchy, incomingCalls, outgoingCalls, diagnostics, workspaceDiagnostics, codeActions, warmup, prepareRename, or rename.',
            enum: [
              'goToDefinition',
              'findReferences',
              'hover',
              'documentSymbol',
              'workspaceSymbol',
              'goToImplementation',
              'prepareCallHierarchy',
              'incomingCalls',
              'outgoingCalls',
              'diagnostics',
              'workspaceDiagnostics',
              'codeActions',
              'warmup',
              'prepareRename',
              'rename',
            ],
          },
          filePath: {
            type: 'string',
            description: 'File path (absolute or workspace-relative).',
          },
          line: {
            type: 'number',
            description: 'Line number (1-based, as shown in editors).',
          },
          character: {
            type: 'number',
            description: 'Character offset (1-based, as shown in editors).',
          },
          endLine: {
            type: 'number',
            description:
              'End line number for range-based operations (1-based).',
          },
          endCharacter: {
            type: 'number',
            description:
              'End character offset for range-based operations (1-based).',
          },
          includeDeclaration: {
            type: 'boolean',
            description: 'Include the declaration when finding references.',
          },
          query: {
            type: 'string',
            description:
              'Symbol query for workspace search, or new name for rename.',
          },
          callHierarchyItem: {
            $ref: '#/definitions/LspCallHierarchyItem',
            description: 'Call hierarchy item for incoming/outgoing calls.',
          },
          serverName: {
            type: 'string',
            description: 'Optional LSP server name to target.',
          },
          limit: {
            type: 'number',
            description: 'Optional maximum number of results to return.',
          },
          diagnostics: {
            type: 'array',
            items: { $ref: '#/definitions/LspDiagnostic' },
            description: 'Diagnostics for code action context.',
          },
          codeActionKinds: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Filter code actions by kind (quickfix, refactor, etc.).',
          },
        },
        required: ['operation'],
        definitions: {
          LspPosition: {
            type: 'object',
            properties: {
              line: { type: 'number' },
              character: { type: 'number' },
            },
            required: ['line', 'character'],
          },
          LspRange: {
            type: 'object',
            properties: {
              start: { $ref: '#/definitions/LspPosition' },
              end: { $ref: '#/definitions/LspPosition' },
            },
            required: ['start', 'end'],
          },
          LspCallHierarchyItem: {
            type: 'object',
            description:
              'Call hierarchy item from prepareCallHierarchy. Obtain from prepareCallHierarchy operation before using with incomingCalls/outgoingCalls.',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the function/method.',
              },
              kind: {
                type: 'string',
                description: 'Symbol kind (e.g., "Function", "Method").',
              },
              rawKind: {
                type: 'number',
                description: 'Raw LSP symbol kind number.',
              },
              detail: {
                type: 'string',
                description: 'Additional details (e.g., signature).',
              },
              uri: {
                type: 'string',
                description: 'File URI (file://...).',
              },
              range: {
                $ref: '#/definitions/LspRange',
                description: 'Full range of the symbol.',
              },
              selectionRange: {
                $ref: '#/definitions/LspRange',
                description: 'Range to select when navigating.',
              },
              data: {
                description: 'Opaque data for server use.',
              },
              serverName: {
                type: 'string',
                description: 'LSP server name.',
              },
            },
            required: ['name', 'uri', 'range', 'selectionRange'],
          },
          LspDiagnostic: {
            type: 'object',
            properties: {
              range: { $ref: '#/definitions/LspRange' },
              severity: {
                type: 'string',
                enum: ['error', 'warning', 'information', 'hint'],
              },
              code: { type: ['string', 'number'] },
              source: { type: 'string' },
              message: { type: 'string' },
              serverName: { type: 'string' },
            },
            required: ['range', 'message'],
          },
        },
      },
      messageBus,
      true,
    );
  }

  protected override validateToolParamValues(
    params: LspToolParams,
  ): string | null {
    if (!params.operation) {
      params.operation = 'diagnostics';
    }

    const operation = params.operation;

    if (LOCATION_REQUIRED_OPERATIONS.has(operation)) {
      if (!params.filePath || params.filePath.trim() === '') {
        return `filePath is required for ${operation}.`;
      }
      if (typeof params.line !== 'number') {
        return `line is required for ${operation}.`;
      }
    }

    if (FILE_REQUIRED_OPERATIONS.has(operation)) {
      if (!params.filePath || params.filePath.trim() === '') {
        return `filePath is required for ${operation}.`;
      }
    }

    if (QUERY_REQUIRED_OPERATIONS.has(operation)) {
      if (!params.query || params.query.trim() === '') {
        return `query is required for ${operation}.`;
      }
    }

    if (ITEM_REQUIRED_OPERATIONS.has(operation)) {
      if (!params.callHierarchyItem) {
        return `callHierarchyItem is required for ${operation}.`;
      }
    }

    if (RANGE_REQUIRED_OPERATIONS.has(operation)) {
      if (!params.filePath || params.filePath.trim() === '') {
        return `filePath is required for ${operation}.`;
      }
      if (typeof params.line !== 'number') {
        return `line is required for ${operation}.`;
      }
    }

    if (params.line !== undefined && params.line < 1) {
      return 'line must be a positive number.';
    }
    if (params.character !== undefined && params.character < 1) {
      return 'character must be a positive number.';
    }
    if (params.endLine !== undefined && params.endLine < 1) {
      return 'endLine must be a positive number.';
    }
    if (params.endCharacter !== undefined && params.endCharacter < 1) {
      return 'endCharacter must be a positive number.';
    }
    if (params.limit !== undefined && params.limit <= 0) {
      return 'limit must be a positive number.';
    }

    return null;
  }

  protected createInvocation(
    params: LspToolParams,
  ): ToolInvocation<LspToolParams, ToolResult> {
    return new LspToolInvocation(this.config, params, this.messageBus);
  }
}
