/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from '../commands/types.js';
import { CommandKind } from '../commands/types.js';

type GeminiLoopHook = {
  startLoop: (
    sessionID: string,
    prompt: string,
    options?: Record<string, unknown>,
  ) => boolean;
  cancelLoop: (sessionID: string) => boolean;
  getState: () => Record<string, unknown> | null;
};

/**
 * Creates the /loop command to start a standard development loop.
 */
export async function loopCommandAction(
  context: CommandContext,
  args: string,
): Promise<SlashCommandActionReturn> {
  const config = context.services.config;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const task = args.trim();
  if (!task) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /loop <task description>',
    };
  }

  // Get the Gemini Loop hook from the hook system
  const hookSystem = config.getHookSystem() as unknown;
  const maybeHook =
    hookSystem &&
    typeof hookSystem === 'object' &&
    'geminiLoopHook' in hookSystem
      ? hookSystem.geminiLoopHook
      : undefined;

  const loopHook: GeminiLoopHook | undefined =
    maybeHook &&
    typeof maybeHook === 'object' &&
    maybeHook !== null &&
    'startLoop' in maybeHook &&
    typeof maybeHook.startLoop === 'function' &&
    'cancelLoop' in maybeHook &&
    typeof maybeHook.cancelLoop === 'function' &&
    'getState' in maybeHook &&
    typeof maybeHook.getState === 'function'
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (maybeHook as GeminiLoopHook)
      : undefined;

  if (!loopHook) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Loop functionality not initialized. Restart the CLI to enable.',
    };
  }

  const sessionID = config.getSessionId();
  const started = loopHook.startLoop(sessionID, task, {
    ultrawork: false,
    maxIterations: 100,
  });

  if (!started) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Failed to start loop. A loop may already be active.',
    };
  }

  const statusDisplay = `
╔══════════════════════════════════════════════════════════╗
║                 Standard Loop                            ║
╠══════════════════════════════════════════════════════════╣
║  Task: ${task.slice(0, 52).padEnd(52)}║
║  Mode: 📋 Standard                                        ║
║  Max Iterations: 100                                      ║
╚══════════════════════════════════════════════════════════╝

🔄 Starting loop...

**Instructions:**
- Work on the task iteratively
- When complete, output: <promise>DONE</promise>
- The loop will continue until completion or max iterations

**Commands:**
- \`/loop-status\` - Check current status
- \`/cancel-loop\` - Cancel the loop
`.trim();

  return {
    type: 'submit_prompt',
    content: [{ text: statusDisplay }],
  };
}

/**
 * Creates the /ulw-loop command to start an Ultrawork Loop with Oracle verification.
 */
export async function ulwLoopCommandAction(
  context: CommandContext,
  args: string,
): Promise<SlashCommandActionReturn> {
  const config = context.services.config;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const task = args.trim();
  if (!task) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /ulw-loop <task description>',
    };
  }

  const hookSystem = config.getHookSystem() as unknown;
  const maybeHook =
    hookSystem &&
    typeof hookSystem === 'object' &&
    'geminiLoopHook' in hookSystem
      ? hookSystem.geminiLoopHook
      : undefined;

  const loopHook: GeminiLoopHook | undefined =
    maybeHook &&
    typeof maybeHook === 'object' &&
    maybeHook !== null &&
    'startLoop' in maybeHook &&
    typeof maybeHook.startLoop === 'function' &&
    'cancelLoop' in maybeHook &&
    typeof maybeHook.cancelLoop === 'function' &&
    'getState' in maybeHook &&
    typeof maybeHook.getState === 'function'
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (maybeHook as GeminiLoopHook)
      : undefined;

  if (!loopHook) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Loop functionality not initialized. Restart the CLI to enable.',
    };
  }

  const sessionID = config.getSessionId();
  const started = loopHook.startLoop(sessionID, task, {
    ultrawork: true,
    maxIterations: 0, // Unbounded
  });

  if (!started) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Failed to start ultrawork loop. A loop may already be active.',
    };
  }

  const statusDisplay = `
╔══════════════════════════════════════════════════════════╗
║                 Ultrawork Loop ⚡                         ║
╠══════════════════════════════════════════════════════════╣
║  Task: ${task.slice(0, 52).padEnd(52)}║
║  Mode: ⚡ Ultrawork (with Oracle verification)            ║
║  Max Iterations: ∞ (unbounded)                            ║
╚══════════════════════════════════════════════════════════╝

🔄 Starting **Ultrawork Loop**...

**How it works:**
1. Work iteratively on the task
2. When complete, output: <promise>DONE</promise>
3. Oracle verification is triggered
4. Oracle reviews work and emits: <promise>VERIFIED</promise>
5. If verified: loop completes ✅
6. If failed: retry with feedback 🔄

**Commands:**
- \`/loop-status\` - Check current status
- \`/cancel-loop\` - Cancel the loop
`.trim();

  return {
    type: 'submit_prompt',
    content: [{ text: statusDisplay }],
  };
}

/**
 * Creates the /loop-status command to display current loop state.
 */
export async function loopStatusCommandAction(
  context: CommandContext,
  _args: string,
): Promise<SlashCommandActionReturn> {
  const config = context.services.config;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const hookSystem = config.getHookSystem() as unknown;
  const maybeHook =
    hookSystem &&
    typeof hookSystem === 'object' &&
    'geminiLoopHook' in hookSystem
      ? hookSystem.geminiLoopHook
      : undefined;

  const loopHook: GeminiLoopHook | undefined =
    maybeHook &&
    typeof maybeHook === 'object' &&
    maybeHook !== null &&
    'startLoop' in maybeHook &&
    typeof maybeHook.startLoop === 'function' &&
    'cancelLoop' in maybeHook &&
    typeof maybeHook.cancelLoop === 'function' &&
    'getState' in maybeHook &&
    typeof maybeHook.getState === 'function'
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (maybeHook as GeminiLoopHook)
      : undefined;

  if (!loopHook) {
    return {
      type: 'message',
      messageType: 'info',
      content: 'ℹ️  Loop functionality not initialized.',
    };
  }

  const state = loopHook.getState();
  if (!state || !state.active) {
    return {
      type: 'message',
      messageType: 'info',
      content:
        'ℹ️  No active loop.\nUse /loop or /ulw-loop to start a new loop.',
    };
  }

  const maxDisplay =
    typeof state.max_iterations === 'number' && state.max_iterations > 0
      ? state.max_iterations.toString()
      : '∞';

  const percent =
    typeof state.max_iterations === 'number' && state.max_iterations > 0
      ? Math.round((state.iteration / state.max_iterations) * 100)
      : 0;

  const mode = state.ultrawork ? '⚡ Ultrawork' : '📋 Standard';
  const status = state.active ? '✅ Yes' : '❌ No';
  const startedDate = new Date(state.started_at).toLocaleString();

  const statusDisplay = `
╔══════════════════════════════════════════════════════════╗
║                 Gemini Loop Status                       ║
╚══════════════════════════════════════════════════════════╝

📊 Loop State:
   Active: ${status}
   Iteration: ${state.iteration} / ${maxDisplay}
   Mode: ${mode}
   Strategy: ${state.strategy}
   Started: ${startedDate}

📝 Task:
   ${state.prompt}

📈 Progress: ${state.iteration}/${maxDisplay}${percent > 0 ? ` (${percent}%)` : ''}
${percent >= 80 ? '\n⚠️  Warning: Approaching max iterations!' : ''}`.trim();

  return {
    type: 'message',
    messageType: 'info',
    content: statusDisplay,
  };
}

/**
 * Creates the /cancel-loop command to cancel the active loop.
 */
export async function cancelLoopCommandAction(
  context: CommandContext,
  args: string,
): Promise<SlashCommandActionReturn> {
  const config = context.services.config;
  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  const hookSystem = config.getHookSystem() as unknown;
  const maybeHook =
    hookSystem &&
    typeof hookSystem === 'object' &&
    'geminiLoopHook' in hookSystem
      ? hookSystem.geminiLoopHook
      : undefined;

  const loopHook: GeminiLoopHook | undefined =
    maybeHook &&
    typeof maybeHook === 'object' &&
    maybeHook !== null &&
    'startLoop' in maybeHook &&
    typeof maybeHook.startLoop === 'function' &&
    'cancelLoop' in maybeHook &&
    typeof maybeHook.cancelLoop === 'function' &&
    'getState' in maybeHook &&
    typeof maybeHook.getState === 'function'
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (maybeHook as GeminiLoopHook)
      : undefined;

  if (!loopHook) {
    return {
      type: 'message',
      messageType: 'info',
      content: 'ℹ️  Loop functionality not initialized.',
    };
  }

  const state = loopHook.getState();
  if (!state || !state.active) {
    return {
      type: 'message',
      messageType: 'info',
      content: 'ℹ️  No active loop to cancel.',
    };
  }

  const sessionID = config.getSessionId();
  const cancelled = loopHook.cancelLoop(sessionID);

  if (!cancelled) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Failed to cancel loop.',
    };
  }

  const reason = args.trim() ? `\n\n**Reason:** ${args.trim()}` : '';

  const cancelDisplay = `
╔══════════════════════════════════════════════════════════╗
║                    Loop Cancelled                         ║
╚══════════════════════════════════════════════════════════╝

The active loop has been cancelled.${reason}

📝 Task: ${state.prompt}
📊 Final Iteration: ${state.iteration}
⏰ Cancelled: ${new Date().toLocaleString()}

You can start a new loop with /loop or /ulw-loop.`.trim();

  return {
    type: 'message',
    messageType: 'info',
    content: cancelDisplay,
  };
}

/**
 * Creates the loop command with sub-commands.
 */
export const loopCommand: SlashCommand = {
  name: 'loop',
  description: 'Start a standard development loop',
  kind: CommandKind.BUILT_IN,
  action: loopCommandAction,
};

export const ulwLoopCommand: SlashCommand = {
  name: 'ulw-loop',
  description: 'Start an Ultrawork Loop with Oracle verification',
  kind: CommandKind.BUILT_IN,
  action: ulwLoopCommandAction,
};

export const loopStatusCommand: SlashCommand = {
  name: 'loop-status',
  description: 'Display the current state of the active Gemini Loop',
  kind: CommandKind.BUILT_IN,
  action: loopStatusCommandAction,
};

export const cancelLoopCommand: SlashCommand = {
  name: 'cancel-loop',
  description: 'Cancel the active Gemini Loop',
  kind: CommandKind.BUILT_IN,
  action: cancelLoopCommandAction,
};
