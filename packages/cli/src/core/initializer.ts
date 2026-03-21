/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IdeClient,
  IdeConnectionEvent,
  IdeConnectionType,
  logIdeConnection,
  type Config,
  StartSessionEvent,
  logCliConfiguration,
  startupProfiler,
  debugLogger,
} from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import { performInitialAuth } from './auth.js';
import { validateTheme } from './theme.js';
import type { AccountSuspensionInfo } from '../ui/contexts/UIStateContext.js';

export interface InitializationResult {
  authError: string | null;
  accountSuspensionInfo: AccountSuspensionInfo | null;
  themeError: string | null;
  shouldOpenAuthDialog: boolean;
  geminiMdFileCount: number;
}

export interface InitializationStepResult {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  error?: string;
}

export type InitializationProgressCallback = (
  steps: InitializationStepResult[],
) => void;

/**
 * Performs authentication initialization.
 */
async function initializeAuth(
  config: Config,
  settings: LoadedSettings,
): Promise<{
  step: InitializationStepResult;
  result: { authError: string | null; accountSuspensionInfo: AccountSuspensionInfo | null };
}> {
  const step: InitializationStepResult = {
    id: 'auth',
    label: 'Authenticating',
    status: 'loading',
  };

  try {
    const authHandle = startupProfiler.start('authenticate');
    const { authError, accountSuspensionInfo } = await performInitialAuth(
      config,
      settings.merged.security.auth.selectedType,
    );
    authHandle?.end();

    step.status = 'completed';
    return { step, result: { authError, accountSuspensionInfo } };
  } catch (error) {
    step.status = 'error';
    step.error = error instanceof Error ? error.message : 'Authentication failed';
    debugLogger.error('Auth initialization error:', error);
    return {
      step,
      result: {
        authError: step.error,
        accountSuspensionInfo: null,
      },
    };
  }
}

/**
 * Performs theme validation.
 */
async function initializeTheme(
  settings: LoadedSettings,
): Promise<{ step: InitializationStepResult; result: { themeError: string | null } }> {
  const step: InitializationStepResult = {
    id: 'theme',
    label: 'Validating theme',
    status: 'loading',
  };

  try {
    const themeError = validateTheme(settings);
    step.status = themeError ? 'error' : 'completed';
    step.error = themeError ?? undefined;
    return { step, result: { themeError } };
  } catch (error) {
    step.status = 'error';
    step.error = error instanceof Error ? error.message : 'Theme validation failed';
    debugLogger.error('Theme initialization error:', error);
    return {
      step,
      result: { themeError: step.error },
    };
  }
}

/**
 * Logs CLI configuration.
 */
async function initializeSessionLogging(
  config: Config,
): Promise<{ step: InitializationStepResult; result: { geminiMdFileCount: number } }> {
  const step: InitializationStepResult = {
    id: 'session',
    label: 'Initializing session',
    status: 'loading',
  };

  try {
    logCliConfiguration(config, new StartSessionEvent(config, config.getToolRegistry()));
    step.status = 'completed';
    return {
      step,
      result: { geminiMdFileCount: config.getGeminiMdFileCount() },
    };
  } catch (error) {
    step.status = 'error';
    step.error = error instanceof Error ? error.message : 'Session initialization failed';
    debugLogger.error('Session logging error:', error);
    return {
      step,
      result: { geminiMdFileCount: 0 },
    };
  }
}

/**
 * Connects to IDE if IDE mode is enabled.
 */
async function initializeIde(
  config: Config,
): Promise<{ step: InitializationStepResult; result: void }> {
  const step: InitializationStepResult = {
    id: 'ide',
    label: 'Connecting to IDE',
    status: 'loading',
  };

  try {
    if (config.getIdeMode()) {
      const ideClient = await IdeClient.getInstance();
      await ideClient.connect();
      logIdeConnection(config, new IdeConnectionEvent(IdeConnectionType.START));
    }
    step.status = 'completed';
    return { step, result: undefined };
  } catch (error) {
    step.status = 'error';
    step.error = error instanceof Error ? error.message : 'IDE connection failed';
    debugLogger.error('IDE initialization error:', error);
    return { step, result: undefined };
  }
}

/**
 * Orchestrates the application's startup initialization with progressive steps.
 * This runs BEFORE the React UI is rendered.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @param onProgress Optional callback to report initialization progress.
 * @returns The results of the initialization.
 */
export async function initializeApp(
  config: Config,
  settings: LoadedSettings,
  onProgress?: InitializationProgressCallback,
): Promise<InitializationResult> {
  const steps: InitializationStepResult[] = [
    { id: 'auth', label: 'Authenticating', status: 'pending' },
    { id: 'theme', label: 'Validating theme', status: 'pending' },
    { id: 'session', label: 'Initializing session', status: 'pending' },
    { id: 'ide', label: 'Connecting to IDE', status: 'pending' },
  ];

  const reportProgress = () => {
    if (onProgress) {
      onProgress([...steps]);
    }
  };

  // Report initial state
  reportProgress();

  // Run auth and theme in parallel first (critical path)
  const criticalInitPromise = Promise.all([
    initializeAuth(config, settings),
    initializeTheme(settings),
  ]);

  const [{ step: authStep, result: authResult }, { step: themeStep, result: themeResult }] =
    await criticalInitPromise;

  // Update steps
  const authStepIdx = steps.findIndex((s) => s.id === 'auth');
  const themeStepIdx = steps.findIndex((s) => s.id === 'theme');
  steps[authStepIdx] = authStep;
  steps[themeStepIdx] = themeStep;
  reportProgress();

  const shouldOpenAuthDialog =
    settings.merged.security.auth.selectedType === undefined || !!authResult.authError;

  // Run session logging and IDE connection in parallel (non-blocking)
  const backgroundInitPromise = Promise.all([
    initializeSessionLogging(config),
    initializeIde(config),
  ]);

  const [{ step: sessionStep }, { step: ideStep }] = await backgroundInitPromise;

  // Update steps
  const sessionStepIdx = steps.findIndex((s) => s.id === 'session');
  const ideStepIdx = steps.findIndex((s) => s.id === 'ide');
  steps[sessionStepIdx] = sessionStep;
  steps[ideStepIdx] = ideStep;
  reportProgress();

  return {
    authError: authResult.authError,
    accountSuspensionInfo: authResult.accountSuspensionInfo,
    themeError: themeResult.themeError,
    shouldOpenAuthDialog,
    geminiMdFileCount: sessionStep.status === 'completed' ? config.getGeminiMdFileCount() : 0,
  };
}

/**
 * Lightweight initialization that only performs essential auth check.
 * Used for fast UI rendering with background initialization.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @returns Minimal initialization result.
 */
export async function initializeAppMinimal(
  config: Config,
  settings: LoadedSettings,
): Promise<{
  authError: string | null;
  accountSuspensionInfo: AccountSuspensionInfo | null;
  themeError: string | null;
  shouldOpenAuthDialog: boolean;
}> {
  try {
    const { authError, accountSuspensionInfo } = await performInitialAuth(
      config,
      settings.merged.security.auth.selectedType,
    );

    const shouldOpenAuthDialog =
      settings.merged.security.auth.selectedType === undefined || !!authError;

    return {
      authError,
      accountSuspensionInfo,
      themeError: null, // Theme will be validated in background
      shouldOpenAuthDialog,
    };
  } catch {
    return {
      authError: 'Authentication check failed',
      accountSuspensionInfo: null,
      themeError: null,
      shouldOpenAuthDialog: true,
    };
  }
}
