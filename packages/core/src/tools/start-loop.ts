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
import { START_LOOP_TOOL_NAME } from './tool-names.js';
import { startLoop } from './loop-state.js';

export interface StartLoopToolParams {
  /** The task description to work on */
  task: string;
  /** Whether to enable ultrawork mode with Oracle verification */
  ultrawork?: boolean;
  /** Maximum iterations (0 for unbounded, default: 100 for standard, 0 for ultrawork) */
  maxIterations?: number;
  /** Completion promise signal (default: '<promise>DONE</promise>') */
  completionPromise?: string;
  /** Strategy: 'continue' or 'reset' (default: 'continue') */
  strategy?: 'continue' | 'reset';
}

class StartLoopToolInvocation extends BaseToolInvocation<
  StartLoopToolParams,
  ToolResult
> {
  constructor(
    params: StartLoopToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  getDescription(): string {
    const mode = this.params.ultrawork ? 'Ultrawork' : 'Standard';
    return `Starting ${mode} loop for task: "${this.params.task.slice(0, 50)}..."`;
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    try {
      // Get project directory from environment or config
      const projectDir = process.env['GEMINI_PROJECT_DIR'] || process.cwd();

      // Start the loop
      const state = await startLoop(projectDir, {
        task: this.params.task,
        ultrawork: this.params.ultrawork ?? false,
        maxIterations:
          this.params.maxIterations ?? (this.params.ultrawork ? 0 : 100),
        completionPromise: this.params.completionPromise,
        strategy: this.params.strategy ?? 'continue',
        sessionId: process.env['GEMINI_SESSION_ID'] || 'unknown',
      });

      // Format the start message
      const modeDisplay = state.ultrawork
        ? 'Ultrawork ⚡ (with Oracle verification)'
        : 'Standard';

      const maxIterDisplay =
        state.max_iterations === 0
          ? 'unbounded'
          : state.max_iterations.toString();

      const startMessage = `
╔══════════════════════════════════════════════════════════╗
║                 ${state.ultrawork ? 'Ultrawork' : 'Standard'} Loop${' '.repeat(state.ultrawork ? 49 : 54)}║
╠══════════════════════════════════════════════════════════╣
║  Task: ${this.params.task.slice(0, 52).padEnd(52)}║
║  Mode: ${modeDisplay.padEnd(48)}║
║  Max Iterations: ${maxIterDisplay.padEnd(38)}║
╚══════════════════════════════════════════════════════════╝

🔄 Starting ${state.ultrawork ? 'ultrawork' : ''} loop...
${state.ultrawork ? 'This mode includes Oracle verification before completion.\n' : ''}The agent will not stop until the task is ${state.ultrawork ? 'verified complete' : 'complete'}.

Commands:
  /loop-status  - Check current loop status
  /cancel-loop  - Cancel the active loop
`.trim();

      return {
        llmContent: `Loop started successfully. ${startMessage}`,
        returnDisplay: startMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to start loop: ${errorMessage}`,
        returnDisplay: `❌ Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: undefined,
        },
      };
    }
  }
}

export class StartLoopTool extends BaseDeclarativeTool<
  StartLoopToolParams,
  ToolResult
> {
  static readonly Name = START_LOOP_TOOL_NAME;

  constructor(messageBus: MessageBus) {
    super(
      StartLoopTool.Name,
      'StartLoop',
      'Starts a development loop that continues working iteratively until the task is complete. Supports standard and ultrawork (with Oracle verification) modes.',
      Kind.Other,
      {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'The task description to work on iteratively',
          },
          ultrawork: {
            type: 'boolean',
            description:
              'Enable ultrawork mode with Oracle verification (default: false)',
          },
          maxIterations: {
            type: 'number',
            description:
              'Maximum iterations (0 for unbounded, default: 100 for standard, 0 for ultrawork)',
          },
          completionPromise: {
            type: 'string',
            description:
              "Completion signal to look for (default: '<promise>DONE</promise>')",
          },
          strategy: {
            type: 'string',
            enum: ['continue', 'reset'],
            description:
              "Strategy: 'continue' maintains history, 'reset' starts fresh (default: 'continue')",
          },
        },
        required: ['task'],
      },
      messageBus,
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected override validateToolParamValues(
    params: StartLoopToolParams,
  ): string | null {
    if (!params || typeof params !== 'object') {
      return 'Parameters must be an object';
    }

    if (
      !params.task ||
      typeof params.task !== 'string' ||
      !params.task.trim()
    ) {
      return 'Task must be a non-empty string';
    }

    if (
      params.maxIterations !== undefined &&
      (typeof params.maxIterations !== 'number' || params.maxIterations < 0)
    ) {
      return 'maxIterations must be a non-negative number';
    }

    if (
      params.strategy !== undefined &&
      params.strategy !== 'continue' &&
      params.strategy !== 'reset'
    ) {
      return "strategy must be either 'continue' or 'reset'";
    }

    return null;
  }

  protected createInvocation(
    params: StartLoopToolParams,
    messageBus: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ): ToolInvocation<StartLoopToolParams, ToolResult> {
    return new StartLoopToolInvocation(
      params,
      messageBus,
      toolName,
      toolDisplayName,
    );
  }
}
