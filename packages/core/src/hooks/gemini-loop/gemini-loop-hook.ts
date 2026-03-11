/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HookSystem } from '../hookSystem.js';
import type { Config } from '../../config/config.js';

export interface GeminiLoopState {
  active: boolean;
  iteration: number;
  max_iterations?: number;
  completion_promise: string;
  started_at: string;
  session_id: string;
  ultrawork: boolean;
  strategy: 'continue' | 'reset';
  prompt: string;
}

export interface GeminiLoopHook {
  startLoop: (
    sessionID: string,
    prompt: string,
    options?: {
      maxIterations?: number;
      completionPromise?: string;
      ultrawork?: boolean;
      strategy?: 'reset' | 'continue';
    },
  ) => boolean;
  cancelLoop: (sessionID: string) => boolean;
  getState: () => GeminiLoopState | null;
}

export function createGeminiLoopHook(
  _config: Config,
  _hookSystem: HookSystem,
): GeminiLoopHook {
  const loopState = createLoopStateController();

  return {
    startLoop: (sessionID, prompt, options) => loopState.startLoop(sessionID, prompt, options),
    cancelLoop: loopState.cancelLoop,
    getState: loopState.getState as () => GeminiLoopState | null,
  };
}

function createLoopStateController() {
  let state: GeminiLoopState | null = null;

  return {
    startLoop: (
      sessionID: string,
      prompt: string,
      options?: {
        maxIterations?: number;
        completionPromise?: string;
        ultrawork?: boolean;
        strategy?: 'reset' | 'continue';
      },
    ): boolean => {
      state = {
        active: true,
        iteration: 1,
        max_iterations:
          options?.maxIterations ?? (options?.ultrawork ? undefined : 100),
        completion_promise:
          options?.completionPromise ?? '<promise>DONE</promise>',
        started_at: new Date().toISOString(),
        session_id: sessionID,
        ultrawork: options?.ultrawork ?? false,
        strategy: options?.strategy ?? 'continue',
        prompt,
      };
      return true;
    },

    cancelLoop: (sessionID: string): boolean => {
      if (!state || state.session_id !== sessionID) {
        return false;
      }
      state = null;
      return true;
    },

    getState: (): GeminiLoopState | null => state,

    clear: (): boolean => {
      state = null;
      return true;
    },
  };
}
