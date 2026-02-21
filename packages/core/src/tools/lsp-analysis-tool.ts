/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, no-console */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ToolInvocation, ToolResult } from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { Config } from '../config/config.js';
import type {
  LspClient,
  LspDefinition,
  LspDiagnostic,
  LspLocation,
  LspSymbolInformation,
  LspCallHierarchyItem,
} from '../lsp/types.js';

/**
 * LSP 分析操作类型
 */
export type LspAnalysisOperation =
  | 'analyzeSymbol' // 分析符号（定义 + 引用）
  | 'findImplementations' // 查找实现
  | 'getCodeDiagnostics' // 获取代码诊断
  | 'searchSymbols' // 搜索符号
  | 'analyzeCallHierarchy' // 分析调用层次
  | 'getHoverInfo' // 获取悬停信息
  | 'getDocumentSymbols'; // 获取文档符号

/**
 * LSP 分析工具参数
 */
export interface LspAnalysisToolParams {
  /** 操作类型 */
  operation: LspAnalysisOperation;
  /** 文件路径（绝对路径或相对于工作区） */
  filePath: string;
  /** 符号名称（用于符号搜索和分析） */
  symbolName?: string;
  /** 1-based 行号 */
  line?: number;
  /** 1-based 列号 */
  character?: number;
  /** 搜索查询（用于工作区符号搜索） */
  query?: string;
  /** 最大结果数量 */
  limit?: number;
  /** LSP 服务器名称 */
  serverName?: string;
}

/**
 * LSP 分析工具调用实现
 */
class LspAnalysisToolInvocation extends BaseToolInvocation<
  LspAnalysisToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: LspAnalysisToolParams,
    messageBus: MessageBus,
  ) {
    super(params, messageBus);
  }

  getDescription(): string {
    const operationLabels: Record<LspAnalysisOperation, string> = {
      analyzeSymbol: '符号分析',
      findImplementations: '查找实现',
      getCodeDiagnostics: '代码诊断',
      searchSymbols: '符号搜索',
      analyzeCallHierarchy: '调用层次分析',
      getHoverInfo: '悬停信息',
      getDocumentSymbols: '文档符号',
    };

    const label = operationLabels[this.params.operation];

    if (this.params.operation === 'searchSymbols') {
      return `LSP ${label}: "${this.params.query ?? ''}"`;
    }

    if (this.params.line !== undefined) {
      return `LSP ${label} ${this.params.filePath}:${this.params.line}:${this.params.character ?? 1}`;
    }

    return `LSP ${label} ${this.params.filePath}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const client = this.config.getLspClient();
    if (!client || !this.config.isLspEnabled()) {
      const message = 'LSP 分析工具不可用（LSP 未启用或未初始化）';
      return { llmContent: message, returnDisplay: message };
    }

    try {
      switch (this.params.operation) {
        case 'analyzeSymbol':
          return await this.executeAnalyzeSymbol(client, _signal);
        case 'findImplementations':
          return await this.executeFindImplementations(client, _signal);
        case 'getCodeDiagnostics':
          return await this.executeGetCodeDiagnostics(client, _signal);
        case 'searchSymbols':
          return await this.executeSearchSymbols(client, _signal);
        case 'analyzeCallHierarchy':
          return await this.executeAnalyzeCallHierarchy(client, _signal);
        case 'getHoverInfo':
          return await this.executeGetHoverInfo(client, _signal);
        case 'getDocumentSymbols':
          return await this.executeGetDocumentSymbols(client, _signal);
        default: {
          const message = `不支持的 LSP 操作：${this.params.operation}`;
          return { llmContent: message, returnDisplay: message };
        }
      }
    } catch (error) {
      const errorMessage = (error as Error)?.message || String(error);
      const message = `LSP 分析失败：${errorMessage}`;
      return { llmContent: message, returnDisplay: message };
    }
  }

  /**
   * 分析符号：查找定义和引用
   */
  private async executeAnalyzeSymbol(
    client: LspClient,
    __signal: AbortSignal,
  ): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const limit = this.params.limit ?? 20;

    // 并行获取定义和引用
    const [definitions, references] = await Promise.all([
      client
        .definitions(target.location, this.params.serverName, limit)
        .catch((error) => {
          console.error('LSP definition error:', error);
          return [];
        }),
      client
        .references(target.location, this.params.serverName, false, limit)
        .catch((error) => {
          console.error('LSP references error:', error);
          return [];
        }),
    ]);

    const workspaceRoot = this.config.getProjectRoot();
    const content: string[] = [
      `符号分析：${target.description}`,
      '',
      '## 定义',
      definitions.length > 0
        ? definitions
            .slice(0, limit)
            .map(
              (def, i) =>
                `${i + 1}. ${this.formatLocation(def, workspaceRoot)}`,
            )
            .join('\n')
        : '未找到定义',
      '',
      '## 引用',
      references.length > 0
        ? references
            .slice(0, limit)
            .map(
              (ref, i) =>
                `${i + 1}. ${this.formatLocation(ref, workspaceRoot)}`,
            )
            .join('\n')
        : '未找到引用',
    ];

    const llmContent = content.join('\n');
    return {
      llmContent,
      returnDisplay: `找到 ${definitions.length} 个定义，${references.length} 个引用`,
    };
  }

  /**
   * 查找实现
   */
  private async executeFindImplementations(
    client: LspClient,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
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
      const message = `LSP 查找实现失败：${(error as Error)?.message || String(error)}`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const content: string[] = [
      `实现 for ${target.description}:`,
      '',
      implementations.length > 0
        ? implementations
            .slice(0, limit)
            .map(
              (impl, i) =>
                `${i + 1}. ${this.formatLocation(impl, workspaceRoot)}`,
            )
            .join('\n')
        : '未找到实现',
    ];

    return {
      llmContent: content.join('\n'),
      returnDisplay: `找到 ${implementations.length} 个实现`,
    };
  }

  /**
   * 获取代码诊断
   */
  private async executeGetCodeDiagnostics(
    client: LspClient,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    if (!this.params.filePath) {
      return {
        llmContent: '错误：需要提供文件路径',
        returnDisplay: '错误：需要提供文件路径',
      };
    }

    const filePath = path.resolve(
      this.config.getProjectRoot(),
      this.params.filePath,
    );
    const fileUri = pathToFileURL(filePath).toString();

    let diagnostics: LspDiagnostic[] = [];

    try {
      diagnostics = await client.diagnostics(fileUri, this.params.serverName);
    } catch (error) {
      const message = `LSP 获取诊断失败：${(error as Error)?.message || String(error)}`;
      return { llmContent: message, returnDisplay: message };
    }

    const content: string[] = [
      `代码诊断：${this.params.filePath}`,
      '',
      diagnostics.length > 0
        ? diagnostics
            .map((diag, _i) => {
              const severity = diag.severity || 'error';
              const line = diag.range?.start?.line ?? 0;
              const char = diag.range?.start?.character ?? 0;
              return `[${severity.toUpperCase()}] ${line + 1}:${char + 1} - ${diag.message}`;
            })
            .join('\n')
        : '✓ 没有发现诊断问题',
    ];

    return {
      llmContent: content.join('\n'),
      returnDisplay:
        diagnostics.length > 0
          ? `发现 ${diagnostics.length} 个问题`
          : '✓ 没有发现诊断问题',
    };
  }

  /**
   * 搜索符号
   */
  private async executeSearchSymbols(
    client: LspClient,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    if (!this.params.query) {
      return {
        llmContent: '错误：需要提供搜索查询',
        returnDisplay: '错误：需要提供搜索查询',
      };
    }

    const limit = this.params.limit ?? 50;
    let symbols: LspSymbolInformation[] = [];

    try {
      symbols = await client.workspaceSymbols(this.params.query, limit);
    } catch (error) {
      const message = `LSP 符号搜索失败：${(error as Error)?.message || String(error)}`;
      return { llmContent: message, returnDisplay: message };
    }

    const workspaceRoot = this.config.getProjectRoot();
    const content: string[] = [
      `符号搜索："${this.params.query}"`,
      '',
      symbols.length > 0
        ? symbols
            .slice(0, limit)
            .map((sym, i) => {
              const location = this.formatLocation(sym.location, workspaceRoot);
              const container = sym.containerName
                ? ` (${sym.containerName})`
                : '';
              return `${i + 1}. ${sym.name}${container} - ${location}`;
            })
            .join('\n')
        : '未找到匹配的符号',
    ];

    return {
      llmContent: content.join('\n'),
      returnDisplay: `找到 ${symbols.length} 个符号`,
    };
  }

  /**
   * 分析调用层次
   */
  private async executeAnalyzeCallHierarchy(
    client: LspClient,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    const limit = this.params.limit ?? 20;

    // 准备调用层次
    let items: LspCallHierarchyItem[] = [];
    try {
      items = await client.prepareCallHierarchy(
        target.location,
        this.params.serverName,
        limit,
      );
    } catch (error) {
      const message = `LSP 准备调用层次失败：${(error as Error)?.message || String(error)}`;
      return { llmContent: message, returnDisplay: message };
    }

    if (items.length === 0) {
      return {
        llmContent: '未找到调用层次信息',
        returnDisplay: '未找到调用层次信息',
      };
    }

    const item = items[0];

    // 声明变量以便在 return 中使用
    let incomingCallsLength = 0;
    let outgoingCallsLength = 0;

    const content: string[] = [
      `调用层次分析：${target.description}`,
      '',
      `## ${item.name}`,
      `类型：${item.kind || 'unknown'}`,
      `文件：${this.formatUri(item.uri, this.config.getProjectRoot())}`,
      '',
    ];

    // 获取入向调用
    try {
      const incomingCalls = await client.incomingCalls(
        item,
        this.params.serverName,
        limit,
      );
      incomingCallsLength = incomingCalls.length;
      if (incomingCalls.length > 0) {
        content.push('## 入向调用（谁调用了这个函数）');
        content.push(
          incomingCalls
            .slice(0, limit)
            .map((call, i) => `${i + 1}. ${call.from.name}`)
            .join('\n'),
        );
        content.push('');
      }
    } catch (error) {
      console.error('LSP incoming calls error:', error);
    }

    // 获取出向调用
    try {
      const outgoingCalls = await client.outgoingCalls(
        item,
        this.params.serverName,
        limit,
      );
      outgoingCallsLength = outgoingCalls.length;
      if (outgoingCalls.length > 0) {
        content.push('## 出向调用（这个函数调用了谁）');
        content.push(
          outgoingCalls
            .slice(0, limit)
            .map((call, i) => `${i + 1}. ${call.to.name}`)
            .join('\n'),
        );
        content.push('');
      }
    } catch (error) {
      console.error('LSP outgoing calls error:', error);
    }

    return {
      llmContent: content.join('\n'),
      returnDisplay: `找到 ${incomingCallsLength} 个入向调用，${outgoingCallsLength} 个出向调用`,
    };
  }

  /**
   * 获取悬停信息
   */
  private async executeGetHoverInfo(
    client: LspClient,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    const target = this.resolveLocationTarget();
    if ('error' in target) {
      return { llmContent: target.error, returnDisplay: target.error };
    }

    let hoverResult;
    try {
      hoverResult = await client.hover(target.location, this.params.serverName);
    } catch (error) {
      const message = `LSP 获取悬停信息失败：${(error as Error)?.message || String(error)}`;
      return { llmContent: message, returnDisplay: message };
    }

    if (!hoverResult || !hoverResult.contents) {
      return {
        llmContent: '没有可用的悬停信息',
        returnDisplay: '没有可用的悬停信息',
      };
    }

    return {
      llmContent: `悬停信息：\n\n${hoverResult.contents}`,
      returnDisplay: '获取到悬停信息',
    };
  }

  /**
   * 获取文档符号
   */
  private async executeGetDocumentSymbols(
    client: LspClient,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    if (!this.params.filePath) {
      return {
        llmContent: '错误：需要提供文件路径',
        returnDisplay: '错误：需要提供文件路径',
      };
    }

    const filePath = path.resolve(
      this.config.getProjectRoot(),
      this.params.filePath,
    );
    const fileUri = pathToFileURL(filePath).toString();

    let symbols: LspSymbolInformation[] = [];
    try {
      symbols = await client.documentSymbols(
        fileUri,
        this.params.serverName,
        this.params.limit ?? 50,
      );
    } catch (error) {
      const message = `LSP 获取文档符号失败：${(error as Error)?.message || String(error)}`;
      return { llmContent: message, returnDisplay: message };
    }

    const content: string[] = [
      `文档符号：${this.params.filePath}`,
      '',
      symbols.length > 0
        ? symbols
            .map((sym, i) => {
              const container = sym.containerName
                ? ` (${sym.containerName})`
                : '';
              return `${i + 1}. ${sym.name}${container} - ${sym.kind || 'unknown'}`;
            })
            .join('\n')
        : '未找到符号',
    ];

    return {
      llmContent: content.join('\n'),
      returnDisplay: `找到 ${symbols.length} 个符号`,
    };
  }

  /**
   * 解析位置目标
   */
  private resolveLocationTarget():
    | { location: LspLocation; description: string }
    | { error: string } {
    if (!this.params.filePath) {
      return { error: '错误：需要提供文件路径' };
    }

    if (this.params.line === undefined) {
      return { error: '错误：需要提供行号' };
    }

    const filePath = path.resolve(
      this.config.getProjectRoot(),
      this.params.filePath,
    );
    const uri = pathToFileURL(filePath).toString();
    const line = this.params.line - 1; // Convert to 0-based
    const character = (this.params.character ?? 1) - 1; // Convert to 0-based

    const description = `${this.params.filePath}:${this.params.line}:${this.params.character ?? 1}`;

    return {
      location: {
        uri,
        range: {
          start: { line, character },
          end: { line, character },
        },
      },
      description,
    };
  }

  /**
   * 格式化位置信息
   */
  private formatLocation(location: LspLocation, workspaceRoot: string): string {
    const filePath = this.formatUri(location.uri, workspaceRoot);
    const line = location.range.start.line + 1;
    const char = location.range.start.character + 1;
    return `${filePath}:${line}:${char}`;
  }

  /**
   * 格式化 URI 为文件路径
   */
  private formatUri(uri: string, workspaceRoot: string): string {
    if (uri.startsWith('file://')) {
      const filePath = uri.slice(7);
      if (filePath.startsWith(workspaceRoot)) {
        return path.relative(workspaceRoot, filePath);
      }
      return filePath;
    }
    return uri;
  }
}

/**
 * LSP 分析工具
 *
 * 提供简化的 LSP 操作接口，用于代码分析场景
 */
export class LspAnalysisTool extends BaseDeclarativeTool<
  LspAnalysisToolParams,
  ToolResult
> {
  static readonly Name = 'lsp_analysis';

  constructor(
    private readonly config: Config,
    messageBus: MessageBus,
  ) {
    super(
      LspAnalysisTool.Name,
      'LSP 代码分析',
      '使用 Language Server Protocol 进行代码分析，支持符号查找、引用分析、诊断检查等功能',
      Kind.Other,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'analyzeSymbol',
              'findImplementations',
              'getCodeDiagnostics',
              'searchSymbols',
              'analyzeCallHierarchy',
              'getHoverInfo',
              'getDocumentSymbols',
            ],
            description: 'LSP 分析操作类型',
          },
          filePath: {
            type: 'string',
            description: '文件路径（绝对路径或相对于工作区）',
          },
          symbolName: {
            type: 'string',
            description: '符号名称（用于符号搜索和分析）',
          },
          line: {
            type: 'number',
            description: '1-based 行号',
          },
          character: {
            type: 'number',
            description: '1-based 列号',
          },
          query: {
            type: 'string',
            description: '搜索查询（用于工作区符号搜索）',
          },
          limit: {
            type: 'number',
            description: '最大结果数量',
            default: 20,
          },
          serverName: {
            type: 'string',
            description: 'LSP 服务器名称',
          },
        },
        required: ['operation', 'filePath'],
      },
      messageBus,
    );
  }

  protected createInvocation(
    params: LspAnalysisToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<LspAnalysisToolParams, ToolResult> {
    return new LspAnalysisToolInvocation(this.config, params, messageBus);
  }

  /**
   * 获取工具的使用示例
   */
  getExamples(): Array<Record<string, unknown>> {
    return [
      {
        operation: 'analyzeSymbol',
        filePath: 'src/index.ts',
        line: 10,
        character: 5,
        description: '分析 src/index.ts 第 10 行第 5 列的符号',
      },
      {
        operation: 'getCodeDiagnostics',
        filePath: 'src/utils.ts',
        description: '获取 src/utils.ts 的诊断信息',
      },
      {
        operation: 'searchSymbols',
        filePath: '.',
        query: 'UserService',
        description: '搜索工作区中的 UserService 符号',
      },
      {
        operation: 'findImplementations',
        filePath: 'src/interfaces.ts',
        line: 20,
        character: 10,
        description: '查找接口的实现',
      },
    ];
  }
}
