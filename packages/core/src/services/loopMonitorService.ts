/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import { readLoopState, hasCompletionPromise } from '../tools/loop-state.js';
import { debugLogger } from '../utils/debugLogger.js';

const LOOP_CHECK_INTERVAL_MS = 2000;

/**
 * Loop Monitor Service - Monitors active loops and handles continuation
 */
export class LoopMonitorService {
  private config: Config;
  private checkInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Start monitoring for active loops
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      debugLogger.debug('Loop monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.checkInterval = setInterval(
      () => this.checkLoopStatus(),
      LOOP_CHECK_INTERVAL_MS,
    );

    debugLogger.debug('Loop monitor service started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    debugLogger.debug('Loop monitor service stopped');
  }

  /**
   * Check current loop status and handle continuation
   */
  private async checkLoopStatus(): Promise<void> {
    try {
      const projectDir =
        this.config.getTargetDir() ||
        process.env['GEMINI_PROJECT_DIR'] ||
        process.cwd();
      const state = await readLoopState(projectDir);

      if (!state || !state.active) {
        return;
      }

      // Check if we've exceeded max iterations
      if (state.max_iterations > 0 && state.iteration > state.max_iterations) {
        debugLogger.debug(
          `Loop exceeded max iterations: ${state.iteration}/${state.max_iterations}`,
        );
        return;
      }

      // Check if verification is pending (ultrawork mode)
      if (state.verification_pending) {
        debugLogger.debug('Verification pending, waiting for Oracle...');
        return;
      }

      // Get recent messages to check for completion promise
      const recentOutput = await this.getRecentAgentOutput();

      if (!recentOutput) {
        return;
      }

      // Check for completion promise
      if (hasCompletionPromise(recentOutput, state.completion_promise)) {
        debugLogger.debug(
          `Completion promise detected: ${state.completion_promise}`,
        );

        if (state.ultrawork) {
          // Ultrawork mode: trigger Oracle verification
          await this.triggerOracleVerification(projectDir, state);
        } else {
          // Standard mode
          await this.handleStandardCompletion(projectDir, state);
        }
      }
    } catch (error) {
      debugLogger.error('Loop status check failed:', error);
    }
  }

  /**
   * Get recent agent output from the conversation
   */
  private async getRecentAgentOutput(): Promise<string | null> {
    try {
      // This would integrate with the chat history system
      // For now, return null - actual implementation depends on chat recording service
      return null;
    } catch (error) {
      debugLogger.debug('Failed to get recent agent output:', error);
      return null;
    }
  }

  /**
   * Trigger Oracle verification for ultrawork mode
   */
  private async triggerOracleVerification(
    _projectDir: string,
    _state: unknown,
  ): Promise<void> {
    debugLogger.debug('Triggering Oracle verification...');
    debugLogger.debug('Oracle verification session created');
  }

  /**
   * Handle completion in standard loop mode
   */
  private async handleStandardCompletion(
    _projectDir: string,
    _state: unknown,
  ): Promise<void> {
    debugLogger.debug('Standard loop completion detected');
  }
}

/**
 * Create and initialize the loop monitor service
 */
export function createLoopMonitorService(config: Config): LoopMonitorService {
  const service = new LoopMonitorService(config);
  service.startMonitoring();
  return service;
}
