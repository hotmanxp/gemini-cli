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
import { CANCEL_LOOP_TOOL_NAME } from './tool-names.js';
import {
  cancelLoop,
  readLoopState,
  getLoopStatusSummary,
} from './loop-state.js';

export interface CancelLoopToolParams {
  /** Optional: Reason for cancellation */
  reason?: string;
}

class CancelLoopToolInvocation extends BaseToolInvocation<
  CancelLoopToolParams,
  ToolResult
> {
  constructor(
    params: CancelLoopToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return 'Cancelling the active loop session';
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    try {
      const projectDir = process.env['GEMINI_PROJECT_DIR'] || process.cwd();

      // First check if there's an active loop
      const currentState = await readLoopState(projectDir);
      if (!currentState || !currentState.active) {
        const noLoopMessage =
          'No active loop found to cancel. Use /loop or /ulw-loop to start a new loop.';
        return {
          llmContent: noLoopMessage,
          returnDisplay: `ℹ️ ${noLoopMessage}`,
        };
      }

      // Cancel the loop
      const newState = await cancelLoop(projectDir);
      if (!newState) {
        throw new Error('Failed to cancel loop - state update failed');
      }

      const reasonDisplay = this.params.reason
        ? `\n\n**Reason:** ${this.params.reason}`
        : '';

      const summary = getLoopStatusSummary(newState);

      const cancelMessage = `
╔══════════════════════════════════════════════════════════╗
║                    Loop Cancelled                         ║
╠══════════════════════════════════════════════════════════╣
║  The active loop has been cancelled by user request.${reasonDisplay ? ' '.repeat(50 - reasonDisplay.length) : ' '.repeat(50)}║
╚══════════════════════════════════════════════════════════╝

${summary}${reasonDisplay}
`.trim();

      return {
        llmContent: cancelMessage,
        returnDisplay: cancelMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to cancel loop: ${errorMessage}`,
        returnDisplay: `❌ Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: undefined,
        },
      };
    }
  }
}

export class CancelLoopTool extends BaseDeclarativeTool<
  CancelLoopToolParams,
  ToolResult
> {
  static readonly Name = CANCEL_LOOP_TOOL_NAME;

  constructor(messageBus: MessageBus) {
    super(
      CancelLoopTool.Name,
      'CancelLoop',
      'Cancels the active Gemini Loop session, stopping further iterations.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Optional reason for cancelling the loop',
          },
        },
      },
      messageBus,
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected createInvocation(
    params: CancelLoopToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ): ToolInvocation<CancelLoopToolParams, ToolResult> {
    return new CancelLoopToolInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }
}
