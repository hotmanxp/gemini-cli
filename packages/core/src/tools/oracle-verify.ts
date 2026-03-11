/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { ORACLE_VERIFY_TOOL_NAME } from './tool-names.js';
import {
  readLoopState,
  updateLoopState,
  completeLoop,
  incrementLoopIteration,
} from './loop-state.js';

export interface OracleVerifyToolParams {
  /** The verification result: 'verified', 'failed', or 'incomplete' */
  result: 'verified' | 'failed' | 'incomplete';
  /** Explanation of the verification outcome */
  explanation: string;
  /** List of missing requirements (if failed/incomplete) */
  missingItems?: string[];
  /** Suggested next steps (if failed/incomplete) */
  suggestions?: string[];
}

class OracleVerifyToolInvocation extends BaseToolInvocation<
  OracleVerifyToolParams,
  ToolResult
> {
  constructor(
    params: OracleVerifyToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return `Oracle verification: ${this.params.result.toUpperCase()} - ${this.params.explanation.slice(0, 50)}...`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    try {
      const projectDir = process.env['GEMINI_PROJECT_DIR'] || process.cwd();
      const state = await readLoopState(projectDir);

      if (!state || !state.ultrawork || !state.verification_pending) {
        return {
          llmContent:
            'Oracle verification not required or not in ultrawork mode.',
          returnDisplay: 'ℹ️ Oracle verification not required',
        };
      }

      let resultMessage = '';
      let displayMessage = '';

      if (this.params.result === 'verified') {
        // Verification passed - complete the loop
        await completeLoop(projectDir, true);

        resultMessage = `
╔══════════════════════════════════════════════════════════╗
║              Oracle Verification: ✅ PASSED              ║
╠══════════════════════════════════════════════════════════╣
║  ${this.params.explanation.slice(0, 57).padEnd(57)}║
╚══════════════════════════════════════════════════════════╝

✅ Task has been verified complete by Oracle.
🎉 Loop completed successfully after ${state.iteration} iteration(s).

${this.params.explanation}
`.trim();

        displayMessage = resultMessage;
      } else {
        // Verification failed - increment iteration and continue
        const newState = await incrementLoopIteration(projectDir);
        await updateLoopState(projectDir, (s) => ({
          ...s,
          verification_pending: false,
          verification_session_id: undefined,
        }));

        const missingItemsList = this.params.missingItems
          ? this.params.missingItems.map((item) => `   - ${item}`).join('\n')
          : '   None specified';

        const suggestionsList = this.params.suggestions
          ? this.params.suggestions.map((s) => `   - ${s}`).join('\n')
          : '   None specified';

        resultMessage = `
╔══════════════════════════════════════════════════════════╗
║            Oracle Verification: ❌ FAILED                ║
╠══════════════════════════════════════════════════════════╣
║  ${this.params.explanation.slice(0, 57).padEnd(57)}║
╚══════════════════════════════════════════════════════════╝

❌ Task verification failed. Loop will continue.
📊 Current iteration: ${newState?.iteration || state.iteration}

**Explanation:**
${this.params.explanation}

**Missing Requirements:**
${missingItemsList}

**Suggested Next Steps:**
${suggestionsList}

🔄 Continuing loop to address missing requirements...
`.trim();

        displayMessage = resultMessage;
      }

      return {
        llmContent: resultMessage,
        returnDisplay: displayMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Oracle verification failed: ${errorMessage}`,
        returnDisplay: `❌ Oracle Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: undefined,
        },
      };
    }
  }
}

export class OracleVerifyTool extends BaseDeclarativeTool<
  OracleVerifyToolParams,
  ToolResult
> {
  static readonly Name = ORACLE_VERIFY_TOOL_NAME;

  constructor(messageBus: MessageBus) {
    super(
      OracleVerifyTool.Name,
      'OracleVerify',
      'Performs Oracle verification for ultrawork loop. Reviews completed work against requirements and emits verification result.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          result: {
            type: 'string',
            enum: ['verified', 'failed', 'incomplete'],
            description:
              'Verification result: verified (pass), failed (missing requirements), or incomplete (partial work)',
          },
          explanation: {
            type: 'string',
            description: 'Detailed explanation of the verification outcome',
          },
          missingItems: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of missing requirements or incomplete items',
          },
          suggestions: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Suggested next steps to complete the task',
          },
        },
        required: ['result', 'explanation'],
      },
      messageBus,
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected override validateToolParamValues(
    params: OracleVerifyToolParams,
  ): string | null {
    if (!params || typeof params !== 'object') {
      return 'Parameters must be an object';
    }

    if (
      !params.result ||
      !['verified', 'failed', 'incomplete'].includes(params.result)
    ) {
      return 'Result must be one of: verified, failed, incomplete';
    }

    if (
      !params.explanation ||
      typeof params.explanation !== 'string' ||
      !params.explanation.trim()
    ) {
      return 'Explanation must be a non-empty string';
    }

    if (
      params.missingItems !== undefined &&
      !Array.isArray(params.missingItems)
    ) {
      return 'Missing items must be an array';
    }

    if (
      params.suggestions !== undefined &&
      !Array.isArray(params.suggestions)
    ) {
      return 'Suggestions must be an array';
    }

    return null;
  }

  protected createInvocation(
    params: OracleVerifyToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ): ToolInvocation<OracleVerifyToolParams, ToolResult> {
    return new OracleVerifyToolInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }
}
