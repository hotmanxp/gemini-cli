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
import { CHECK_LOOP_TOOL_NAME } from './tool-names.js';
import {
  readLoopState,
  getLoopStatusSummary,
  getLoopStateFilePath,
} from './loop-state.js';

export interface CheckLoopToolParams {
  /** Optional: Show detailed state information */
  detailed?: boolean;
}

class CheckLoopToolInvocation extends BaseToolInvocation<
  CheckLoopToolParams,
  ToolResult
> {
  constructor(
    params: CheckLoopToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    return 'Checking current loop status';
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    try {
      const projectDir = process.env['GEMINI_PROJECT_DIR'] || process.cwd();
      const state = await readLoopState(projectDir);

      if (!state) {
        const noLoopMessage =
          'No active loop found. Use /loop or /ulw-loop to start a new loop.';
        return {
          llmContent: noLoopMessage,
          returnDisplay: `ℹ️ ${noLoopMessage}`,
        };
      }

      const summary = getLoopStatusSummary(state);
      const detailedInfo = this.params.detailed
        ? `\n\n**State File:** ${getLoopStateFilePath(projectDir)}\n\n**Full State:**\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``
        : '';

      const displayMessage = `${summary}${detailedInfo}`;

      return {
        llmContent: displayMessage,
        returnDisplay: displayMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to check loop status: ${errorMessage}`,
        returnDisplay: `❌ Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: undefined,
        },
      };
    }
  }
}

export class CheckLoopTool extends BaseDeclarativeTool<
  CheckLoopToolParams,
  ToolResult
> {
  static readonly Name = CHECK_LOOP_TOOL_NAME;

  constructor(messageBus: MessageBus) {
    super(
      CheckLoopTool.Name,
      'CheckLoop',
      'Checks the current status of the active Gemini Loop session, including mode, iteration, and task details.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          detailed: {
            type: 'boolean',
            description:
              'Show detailed state information including full JSON state (default: false)',
          },
        },
      },
      messageBus,
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected createInvocation(
    params: CheckLoopToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ): ToolInvocation<CheckLoopToolParams, ToolResult> {
    return new CheckLoopToolInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }
}
