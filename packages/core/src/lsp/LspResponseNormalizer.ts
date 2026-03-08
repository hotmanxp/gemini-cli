/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

/**
 * LSP Response Normalizer
 *
 * Converts raw LSP protocol responses to normalized internal types.
 * Handles various response formats from different language servers.
 */

import type {
  LspCallHierarchyIncomingCall,
  LspCallHierarchyItem,
  LspCallHierarchyOutgoingCall,
  LspCodeAction,
  LspDiagnostic,
  LspDiagnosticSeverity,
  LspFileDiagnostics,
  LspHoverResult,
  LspLocation,
  LspRange,
  LspReference,
  LspSymbolInformation,
  LspTextEdit,
  LspWorkspaceEdit,
} from './types.js';
import {
  CODE_ACTION_KIND_LABELS,
  DIAGNOSTIC_SEVERITY_LABELS,
  SYMBOL_KIND_LABELS,
} from './constants.js';

/**
 * Normalizes LSP protocol responses to internal types.
 */
export class LspResponseNormalizer {
  // ============================================================================
  // Type Guards
  // ============================================================================

  private isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  private isNumber(value: unknown): value is number {
    return typeof value === 'number';
  }

  private isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  // ============================================================================
  // Diagnostic Normalization
  // ============================================================================

  /**
   * Normalize diagnostic result from LSP response
   */
  normalizeDiagnostic(item: unknown, serverName: string): LspDiagnostic | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const range = this.normalizeRange(item['range']);
    if (!range) {
      return null;
    }

    const message = this.isString(item['message']) ? item['message'] : '';
    if (!message) {
      return null;
    }

    const severityNum = this.isNumber(item['severity'])
      ? item['severity']
      : undefined;
    const severity = severityNum
      ? DIAGNOSTIC_SEVERITY_LABELS[severityNum]
      : undefined;

    const code = item['code'];
    const codeValue =
      this.isString(code) || this.isNumber(code) ? code : undefined;

    const source = this.isString(item['source']) ? item['source'] : undefined;

    const tags = this.normalizeDiagnosticTags(item['tags']);
    const relatedInfo = this.normalizeDiagnosticRelatedInfo(
      item['relatedInformation'],
    );

    return {
      range,
      severity,
      code: codeValue,
      source,
      message,
      tags: tags.length > 0 ? tags : undefined,
      relatedInformation: relatedInfo.length > 0 ? relatedInfo : undefined,
      serverName,
    };
  }

  /**
   * Convert diagnostic back to LSP format for requests
   */
  denormalizeDiagnostic(diagnostic: LspDiagnostic): Record<string, unknown> {
    const severityMap: Record<LspDiagnosticSeverity, number> = {
      error: 1,
      warning: 2,
      information: 3,
      hint: 4,
    };

    return {
      range: diagnostic.range,
      message: diagnostic.message,
      severity: diagnostic.severity
        ? severityMap[diagnostic.severity]
        : undefined,
      code: diagnostic.code,
      source: diagnostic.source,
    };
  }

  /**
   * Normalize diagnostic tags
   */
  normalizeDiagnosticTags(tags: unknown): Array<'unnecessary' | 'deprecated'> {
    if (!Array.isArray(tags)) {
      return [];
    }

    const result: Array<'unnecessary' | 'deprecated'> = [];
    for (const tag of tags) {
      if (tag === 1) {
        result.push('unnecessary');
      } else if (tag === 2) {
        result.push('deprecated');
      }
    }
    return result;
  }

  /**
   * Normalize diagnostic related information
   */
  normalizeDiagnosticRelatedInfo(
    info: unknown,
  ): Array<{ location: LspLocation; message: string }> {
    if (!Array.isArray(info)) {
      return [];
    }

    const result: Array<{ location: LspLocation; message: string }> = [];
    for (const item of info) {
      if (!this.isRecord(item)) {
        continue;
      }
      const location = item['location'];
      if (!this.isRecord(location)) {
        continue;
      }
      const uri = location['uri'];
      const range = this.normalizeRange(location['range']);
      const message = item['message'];

      if (this.isString(uri) && range && this.isString(message)) {
        result.push({
          location: { uri, range },
          message,
        });
      }
    }
    return result;
  }

  /**
   * Normalize file diagnostics result
   */
  normalizeFileDiagnostics(
    item: unknown,
    serverName: string,
  ): LspFileDiagnostics | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const uri = this.isString(item['uri']) ? item['uri'] : '';
    if (!uri) {
      return null;
    }

    const items = item['items'];
    if (!Array.isArray(items)) {
      return null;
    }

    const diagnostics: LspDiagnostic[] = [];
    for (const diagItem of items) {
      const normalized = this.normalizeDiagnostic(diagItem, serverName);
      if (normalized) {
        diagnostics.push(normalized);
      }
    }

    return {
      uri,
      diagnostics,
      serverName,
    };
  }

  // ============================================================================
  // Code Action Normalization
  // ============================================================================

  /**
   * Normalize code action result
   */
  normalizeCodeAction(item: unknown, serverName: string): LspCodeAction | null {
    if (!this.isRecord(item)) {
      return null;
    }

    // Check if this is a Command instead of CodeAction
    if (item['command'] && this.isString(item['title']) && !item['kind']) {
      // This is a raw Command, wrap it
      return {
        title: item['title'],
        command: {
          title: item['title'],
          command: (item['command'] as string) ?? '',
          arguments: item['arguments'] as unknown[] | undefined,
        },
        serverName,
      };
    }

    const title = this.isString(item['title']) ? item['title'] : '';
    if (!title) {
      return null;
    }

    const kind = this.isString(item['kind'])
      ? (CODE_ACTION_KIND_LABELS[item['kind']] ?? item['kind'])
      : undefined;

    const isPreferred = this.isBoolean(item['isPreferred'])
      ? item['isPreferred']
      : undefined;

    const edit = this.normalizeWorkspaceEdit(item['edit']);
    const command = this.normalizeCommand(item['command']);

    const diagnostics: LspDiagnostic[] = [];
    if (Array.isArray(item['diagnostics'])) {
      for (const diag of item['diagnostics']) {
        const normalized = this.normalizeDiagnostic(diag, serverName);
        if (normalized) {
          diagnostics.push(normalized);
        }
      }
    }

    return {
      title,
      kind,
      diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
      isPreferred,
      edit: edit ?? undefined,
      command: command ?? undefined,
      data: item['data'],
      serverName,
    };
  }

  // ============================================================================
  // Workspace Edit Normalization
  // ============================================================================

  /**
   * Normalize workspace edit
   */
  normalizeWorkspaceEdit(edit: unknown): LspWorkspaceEdit | null {
    if (!this.isRecord(edit)) {
      return null;
    }

    const result: LspWorkspaceEdit = {};

    // Handle changes (map of URI to TextEdit[])
    if (edit['changes'] && this.isRecord(edit['changes'])) {
      const changes = edit['changes'];
      result.changes = {};
      for (const [uri, edits] of Object.entries(changes)) {
        if (Array.isArray(edits)) {
          const normalizedEdits: LspTextEdit[] = [];
          for (const e of edits) {
            const normalized = this.normalizeTextEdit(e);
            if (normalized) {
              normalizedEdits.push(normalized);
            }
          }
          if (normalizedEdits.length > 0) {
            result.changes[uri] = normalizedEdits;
          }
        }
      }
    }

    // Handle documentChanges
    if (Array.isArray(edit['documentChanges'])) {
      result.documentChanges = [];
      for (const docChange of edit['documentChanges']) {
        const normalized = this.normalizeTextDocumentEdit(docChange);
        if (normalized) {
          result.documentChanges.push(normalized);
        }
      }
    }

    if (
      (!result.changes || Object.keys(result.changes).length === 0) &&
      (!result.documentChanges || result.documentChanges.length === 0)
    ) {
      return null;
    }

    return result;
  }

  /**
   * Normalize text edit
   */
  normalizeTextEdit(edit: unknown): LspTextEdit | null {
    if (!this.isRecord(edit)) {
      return null;
    }

    const range = this.normalizeRange(edit['range']);
    if (!range) {
      return null;
    }

    const newText = this.isString(edit['newText']) ? edit['newText'] : '';

    return { range, newText };
  }

  /**
   * Normalize text document edit
   */
  normalizeTextDocumentEdit(docEdit: unknown): {
    textDocument: { uri: string; version?: number | null };
    edits: LspTextEdit[];
  } | null {
    if (!this.isRecord(docEdit)) {
      return null;
    }

    const textDocument = docEdit['textDocument'];
    if (!this.isRecord(textDocument)) {
      return null;
    }

    const uri = this.isString(textDocument['uri']) ? textDocument['uri'] : '';
    if (!uri) {
      return null;
    }

    const version = this.isNumber(textDocument['version'])
      ? textDocument['version']
      : null;

    const edits = docEdit['edits'];
    if (!Array.isArray(edits)) {
      return null;
    }

    const normalizedEdits: LspTextEdit[] = [];
    for (const e of edits) {
      const normalized = this.normalizeTextEdit(e);
      if (normalized) {
        normalizedEdits.push(normalized);
      }
    }

    if (normalizedEdits.length === 0) {
      return null;
    }

    return {
      textDocument: { uri, version },
      edits: normalizedEdits,
    };
  }

  /**
   * Normalize command
   */
  normalizeCommand(
    cmd: unknown,
  ): { title: string; command: string; arguments?: unknown[] } | null {
    if (!this.isRecord(cmd)) {
      return null;
    }

    const title = this.isString(cmd['title']) ? cmd['title'] : '';
    const command = this.isString(cmd['command']) ? cmd['command'] : '';

    if (!command) {
      return null;
    }

    const args = Array.isArray(cmd['arguments'])
      ? (cmd['arguments'] as unknown[])
      : undefined;

    return { title, command, arguments: args };
  }

  // ============================================================================
  // Location and Symbol Normalization
  // ============================================================================

  /**
   * Normalize location result (definitions, references, implementations)
   */
  normalizeLocationResult(
    item: unknown,
    serverName: string,
  ): LspReference | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const uri = (item['uri'] ??
      item['targetUri'] ??
      (item['target'] as Record<string, unknown>)?.['uri']) as
      | string
      | undefined;

    const range = (item['range'] ??
      item['targetSelectionRange'] ??
      item['targetRange'] ??
      (item['target'] as Record<string, unknown>)?.['range']) as
      | { start?: unknown; end?: unknown }
      | undefined;

    if (!uri || !range?.start || !range?.end) {
      return null;
    }

    const start = range.start as { line?: number; character?: number };
    const end = range.end as { line?: number; character?: number };

    return {
      uri,
      range: {
        start: {
          line: Number(start?.line ?? 0),
          character: Number(start?.character ?? 0),
        },
        end: {
          line: Number(end?.line ?? 0),
          character: Number(end?.character ?? 0),
        },
      },
      serverName,
    };
  }

  /**
   * Normalize symbol result (workspace symbols, document symbols)
   */
  normalizeSymbolResult(
    item: unknown,
    serverName: string,
  ): LspSymbolInformation | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const itemObj = item;
    const location = itemObj['location'] ?? itemObj['target'] ?? item;
    if (!this.isRecord(location)) {
      return null;
    }

    const locationObj = location;
    const range = (locationObj['range'] ??
      locationObj['targetRange'] ??
      itemObj['range'] ??
      undefined) as { start?: unknown; end?: unknown } | undefined;

    if (!locationObj['uri'] || !range?.start || !range?.end) {
      return null;
    }

    const start = range.start as { line?: number; character?: number };
    const end = range.end as { line?: number; character?: number };

    return {
      name: (itemObj['name'] ?? itemObj['label'] ?? 'symbol') as string,
      kind: this.normalizeSymbolKind(itemObj['kind']),
      containerName: (itemObj['containerName'] ?? itemObj['container']) as
        | string
        | undefined,
      location: {
        uri: locationObj['uri'] as string,
        range: {
          start: {
            line: Number(start?.line ?? 0),
            character: Number(start?.character ?? 0),
          },
          end: {
            line: Number(end?.line ?? 0),
            character: Number(end?.character ?? 0),
          },
        },
      },
      serverName,
    };
  }

  // ============================================================================
  // Range Normalization
  // ============================================================================

  /**
   * Normalize a single range
   */
  normalizeRange(range: unknown): LspRange | null {
    if (!this.isRecord(range)) {
      return null;
    }

    const start = range['start'];
    const end = range['end'];

    if (!this.isRecord(start) || !this.isRecord(end)) {
      return null;
    }

    const startObj = start;
    const endObj = end;

    return {
      start: {
        line: Number(startObj['line'] ?? 0),
        character: Number(startObj['character'] ?? 0),
      },
      end: {
        line: Number(endObj['line'] ?? 0),
        character: Number(endObj['character'] ?? 0),
      },
    };
  }

  /**
   * Normalize an array of ranges
   */
  normalizeRanges(ranges: unknown): LspRange[] {
    if (!Array.isArray(ranges)) {
      return [];
    }

    const results: LspRange[] = [];
    for (const range of ranges) {
      const normalized = this.normalizeRange(range);
      if (normalized) {
        results.push(normalized);
      }
    }

    return results;
  }

  /**
   * Normalize symbol kind from number to string label
   */
  normalizeSymbolKind(kind: unknown): string | undefined {
    if (typeof kind === 'number') {
      return SYMBOL_KIND_LABELS[kind] ?? String(kind);
    }
    if (typeof kind === 'string') {
      const trimmed = kind.trim();
      if (trimmed === '') {
        return undefined;
      }
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric) && SYMBOL_KIND_LABELS[numeric]) {
        return SYMBOL_KIND_LABELS[numeric];
      }
      return trimmed;
    }
    return undefined;
  }

  // ============================================================================
  // Hover Normalization
  // ============================================================================

  /**
   * Normalize hover contents to string
   */
  normalizeHoverContents(contents: unknown): string {
    if (!contents) {
      return '';
    }
    if (this.isString(contents)) {
      return contents;
    }
    if (Array.isArray(contents)) {
      const parts = contents
        .map((item) => this.normalizeHoverContents(item))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return parts.join('\n');
    }
    if (this.isRecord(contents)) {
      const value = contents['value'];
      if (this.isString(value)) {
        const language = contents['language'];
        if (this.isString(language) && language.trim() !== '') {
          return `\`\`\`${language}\n${value}\n\`\`\``;
        }
        return value;
      }
    }
    return '';
  }

  /**
   * Normalize hover result
   */
  normalizeHoverResult(
    response: unknown,
    serverName: string,
  ): LspHoverResult | null {
    if (!response) {
      return null;
    }
    if (!this.isRecord(response)) {
      const contents = this.normalizeHoverContents(response);
      if (!contents.trim()) {
        return null;
      }
      return {
        contents,
        serverName,
      };
    }

    const contents = this.normalizeHoverContents(response['contents']);
    if (!contents.trim()) {
      return null;
    }

    const range = this.normalizeRange(response['range']);
    return {
      contents,
      range: range ?? undefined,
      serverName,
    };
  }

  // ============================================================================
  // Call Hierarchy Normalization
  // ============================================================================

  /**
   * Normalize call hierarchy item
   */
  normalizeCallHierarchyItem(
    item: unknown,
    serverName: string,
  ): LspCallHierarchyItem | null {
    if (!this.isRecord(item)) {
      return null;
    }

    const nameValue = item['name'] ?? item['label'] ?? 'symbol';
    const name = this.isString(nameValue) ? nameValue : String(nameValue ?? '');
    const uri = item['uri'];

    if (!name || !this.isString(uri)) {
      return null;
    }

    const range = this.normalizeRange(item['range']);
    const selectionRange = this.normalizeRange(item['selectionRange']) ?? range;

    if (!range || !selectionRange) {
      return null;
    }

    const serverOverride = this.isString(item['serverName'])
      ? item['serverName']
      : undefined;

    // Preserve raw numeric kind for server communication
    let rawKind: number | undefined;
    if (this.isNumber(item['rawKind'])) {
      rawKind = item['rawKind'];
    } else if (this.isNumber(item['kind'])) {
      rawKind = item['kind'];
    } else if (this.isString(item['kind'])) {
      const parsed = Number(item['kind']);
      if (Number.isFinite(parsed)) {
        rawKind = parsed;
      }
    }

    return {
      name,
      kind: this.normalizeSymbolKind(item['kind']),
      rawKind,
      detail: this.isString(item['detail']) ? item['detail'] : undefined,
      uri,
      range,
      selectionRange,
      data: item['data'],
      serverName: serverOverride ?? serverName,
    };
  }

  /**
   * Normalize incoming call
   */
  normalizeIncomingCall(
    item: unknown,
    serverName: string,
  ): LspCallHierarchyIncomingCall | null {
    if (!this.isRecord(item)) {
      return null;
    }
    const from = this.normalizeCallHierarchyItem(item['from'], serverName);
    if (!from) {
      return null;
    }
    return {
      from,
      fromRanges: this.normalizeRanges(item['fromRanges']),
    };
  }

  /**
   * Normalize outgoing call
   */
  normalizeOutgoingCall(
    item: unknown,
    serverName: string,
  ): LspCallHierarchyOutgoingCall | null {
    if (!this.isRecord(item)) {
      return null;
    }
    const to = this.normalizeCallHierarchyItem(item['to'], serverName);
    if (!to) {
      return null;
    }
    return {
      to,
      fromRanges: this.normalizeRanges(item['fromRanges']),
    };
  }

  /**
   * Convert call hierarchy item back to LSP params format
   */
  toCallHierarchyItemParams(
    item: LspCallHierarchyItem,
  ): Record<string, unknown> {
    // Use rawKind (numeric) for server communication
    let numericKind: number | undefined = item.rawKind;
    if (numericKind === undefined && item.kind !== undefined) {
      const parsed = Number(item.kind);
      if (Number.isFinite(parsed)) {
        numericKind = parsed;
      }
    }

    return {
      name: item.name,
      kind: numericKind,
      detail: item.detail,
      uri: item.uri,
      range: item.range,
      selectionRange: item.selectionRange,
      data: item.data,
    };
  }

  // ============================================================================
  // Document Symbol Helpers
  // ============================================================================

  /**
   * Check if item is a DocumentSymbol (has range and selectionRange)
   */
  isDocumentSymbol(item: Record<string, unknown>): boolean {
    const range = item['range'];
    const selectionRange = item['selectionRange'];
    return this.isRecord(range) && this.isRecord(selectionRange);
  }

  /**
   * Recursively collect document symbols from a tree structure
   */
  collectDocumentSymbol(
    item: Record<string, unknown>,
    uri: string,
    serverName: string,
    results: LspSymbolInformation[],
    limit: number,
    containerName?: string,
  ): void {
    if (results.length >= limit) {
      return;
    }

    const nameValue = item['name'] ?? item['label'] ?? 'symbol';
    const name = this.isString(nameValue) ? nameValue : String(nameValue);
    const selectionRange =
      this.normalizeRange(item['selectionRange']) ??
      this.normalizeRange(item['range']);

    if (!selectionRange) {
      return;
    }

    results.push({
      name,
      kind: this.normalizeSymbolKind(item['kind']),
      containerName,
      location: {
        uri,
        range: selectionRange,
      },
      serverName,
    });

    if (results.length >= limit) {
      return;
    }

    const children = item['children'];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (results.length >= limit) {
          break;
        }
        if (this.isRecord(child)) {
          this.collectDocumentSymbol(
            child,
            uri,
            serverName,
            results,
            limit,
            name,
          );
        }
      }
    }
  }
}
