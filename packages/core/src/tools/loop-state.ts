/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface LoopState {
  /** Whether the loop is currently active */
  active: boolean;
  /** Current iteration number */
  iteration: number;
  /** Maximum iterations (0 for unbounded) */
  max_iterations: number;
  /** The completion promise signal to look for */
  completion_promise: string;
  /** Initial completion promise (for ultrawork verification) */
  initial_completion_promise?: string;
  /** ISO timestamp when loop started */
  started_at: string;
  /** Unique session identifier */
  session_id: string;
  /** Whether this is ultrawork mode with Oracle verification */
  ultrawork: boolean;
  /** Whether verification is pending (ultrawork mode) */
  verification_pending?: boolean;
  /** Session ID for Oracle verification */
  verification_session_id?: string;
  /** Strategy: 'continue' (maintain history) or 'reset' (fresh each iteration) */
  strategy: 'continue' | 'reset';
  /** Message count at loop start (for continuation strategy) */
  message_count_at_start: number;
  /** The original task description */
  task: string;
}

export interface LoopStartOptions {
  task: string;
  ultrawork?: boolean;
  maxIterations?: number;
  completionPromise?: string;
  strategy?: 'continue' | 'reset';
  sessionId: string;
}

const STATE_FILE_NAME = '.gemini-loop-state.md';

/**
 * Get the loop state directory
 */
export function getLoopStateDir(projectDir: string): string {
  return path.join(projectDir, '.agent_working_dir', 'loops');
}

/**
 * Get the path to the state file
 */
export function getLoopStateFilePath(projectDir: string): string {
  return path.join(getLoopStateDir(projectDir), STATE_FILE_NAME);
}

/**
 * Initialize the loop state directory
 */
export async function initializeLoopStateDir(
  projectDir: string,
): Promise<void> {
  const loopDir = getLoopStateDir(projectDir);
  await fs.mkdir(loopDir, { recursive: true });
}

/**
 * Start a new loop session
 */
export async function startLoop(
  projectDir: string,
  options: LoopStartOptions,
): Promise<LoopState> {
  await initializeLoopStateDir(projectDir);

  const state: LoopState = {
    active: true,
    iteration: 1,
    max_iterations: options.maxIterations ?? 100,
    completion_promise: options.completionPromise ?? '<promise>DONE</promise>',
    initial_completion_promise:
      options.completionPromise ?? '<promise>DONE</promise>',
    started_at: new Date().toISOString(),
    session_id: options.sessionId,
    ultrawork: options.ultrawork ?? false,
    verification_pending: false,
    strategy: options.strategy ?? 'continue',
    message_count_at_start: 0,
    task: options.task,
  };

  await writeLoopState(projectDir, state);
  return state;
}

/**
 * Read the current loop state
 */
export async function readLoopState(
  projectDir: string,
): Promise<LoopState | null> {
  const stateFilePath = getLoopStateFilePath(projectDir);

  try {
    const content = await fs.readFile(stateFilePath, 'utf-8');
    const parsed = parseLoopStateFile(content);
    return parsed;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Write loop state to file
 */
export async function writeLoopState(
  projectDir: string,
  state: LoopState,
): Promise<void> {
  const stateFilePath = getLoopStateFilePath(projectDir);
  const content = formatLoopStateFile(state);
  await fs.writeFile(stateFilePath, content, 'utf-8');
}

/**
 * Update loop state atomically
 */
export async function updateLoopState(
  projectDir: string,
  updater: (state: LoopState) => LoopState | null,
): Promise<LoopState | null> {
  const currentState = await readLoopState(projectDir);
  if (!currentState) {
    return null;
  }

  const newState = updater(currentState);
  if (!newState) {
    return null;
  }

  await writeLoopState(projectDir, newState);
  return newState;
}

/**
 * Increment the loop iteration counter
 */
export async function incrementLoopIteration(
  projectDir: string,
): Promise<LoopState | null> {
  return updateLoopState(projectDir, (state) => ({
    ...state,
    iteration: state.iteration + 1,
  }));
}

/**
 * Mark loop as completed
 */
export async function completeLoop(
  projectDir: string,
  success: boolean,
): Promise<LoopState | null> {
  return updateLoopState(projectDir, (state) => ({
    ...state,
    active: false,
    verification_pending: false,
    task: success ? state.task : `[FAILED] ${state.task}`,
  }));
}

/**
 * Cancel the active loop
 */
export async function cancelLoop(
  projectDir: string,
): Promise<LoopState | null> {
  return updateLoopState(projectDir, (state) => ({
    ...state,
    active: false,
    verification_pending: false,
    task: `[CANCELLED] ${state.task}`,
  }));
}

/**
 * Set verification pending for ultrawork mode
 */
export async function setVerificationPending(
  projectDir: string,
  verificationSessionId: string,
): Promise<LoopState | null> {
  return updateLoopState(projectDir, (state) => ({
    ...state,
    verification_pending: true,
    verification_session_id: verificationSessionId,
  }));
}

/**
 * Clear verification state after Oracle completes
 */
export async function clearVerificationState(
  projectDir: string,
  verified: boolean,
): Promise<LoopState | null> {
  return updateLoopState(projectDir, (state) => {
    if (!verified) {
      // If not verified, increment iteration for retry
      return {
        ...state,
        verification_pending: false,
        verification_session_id: undefined,
        iteration: state.iteration + 1,
      };
    }
    // If verified, complete the loop
    return {
      ...state,
      verification_pending: false,
      verification_session_id: undefined,
    };
  });
}

/**
 * Parse a loop state file (YAML frontmatter + task)
 */
export function parseLoopStateFile(content: string): LoopState | null {
  // Match YAML frontmatter
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const [, yamlContent, task] = match;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const metadata = parseYaml<Record<string, unknown>>(yamlContent);

  // Helper function for safe type extraction
  const getBool = (key: string): boolean =>
    typeof metadata[key] === 'boolean' ? (metadata[key]) : false;
  const getNum = (key: string): number =>
    typeof metadata[key] === 'number' ? (metadata[key]) : 0;
  const getStr = (key: string): string =>
    typeof metadata[key] === 'string' ? (metadata[key]) : '';
  const getStrOpt = (key: string): string | undefined =>
    typeof metadata[key] === 'string' ? (metadata[key]) : undefined;
  const getBoolOpt = (key: string): boolean | undefined =>
    typeof metadata[key] === 'boolean' ? (metadata[key]) : undefined;

  return {
    active: getBool('active'),
    iteration: getNum('iteration'),
    max_iterations: getNum('max_iterations'),
    completion_promise: getStr('completion_promise'),
    initial_completion_promise: getStrOpt('initial_completion_promise'),
    started_at: getStr('started_at'),
    session_id: getStr('session_id'),
    ultrawork: getBool('ultrawork'),
    verification_pending: getBoolOpt('verification_pending'),
    verification_session_id: getStrOpt('verification_session_id'),
    strategy:
      metadata['strategy'] === 'continue' || metadata['strategy'] === 'reset'
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          (metadata['strategy'] as 'continue' | 'reset')
        : 'continue',
    message_count_at_start: getNum('message_count_at_start'),
    task: task.trim(),
  };
}

/**
 * Format loop state as a markdown file with YAML frontmatter
 */
export function formatLoopStateFile(state: LoopState): string {
  const metadata: Record<string, unknown> = {
    active: state.active,
    iteration: state.iteration,
    max_iterations: state.max_iterations,
    completion_promise: state.completion_promise,
    initial_completion_promise: state.initial_completion_promise,
    started_at: state.started_at,
    session_id: state.session_id,
    ultrawork: state.ultrawork,
    verification_pending: state.verification_pending,
    verification_session_id: state.verification_session_id,
    strategy: state.strategy,
    message_count_at_start: state.message_count_at_start,
  };

  // Remove undefined values
  Object.keys(metadata).forEach(
    (key) =>
      metadata[key] === undefined &&
      delete metadata[key],
  );

  return `---\n${stringifyYaml(metadata).trim()}\n---\n${state.task}\n`;
}

/**
 * Check if a completion promise is present in text
 */
export function hasCompletionPromise(text: string, promise: string): boolean {
  return text.includes(promise);
}

/**
 * Get a human-readable status summary
 */
export function getLoopStatusSummary(state: LoopState): string {
  const mode = state.ultrawork ? 'Ultrawork ⚡' : 'Standard';
  const status = state.active ? 'In Progress' : 'Completed';
  const maxIter =
    state.max_iterations === 0 ? '∞' : state.max_iterations.toString();
  const verification = state.ultrawork
    ? state.verification_pending
      ? 'Pending'
      : 'Not Required'
    : 'N/A';

  return `
╔══════════════════════════════════════════════════════════╗
║                  Loop Status                              ║
╠══════════════════════════════════════════════════════════╣
║  Mode: ${mode.padEnd(48)}║
║  Status: ${status.padEnd(46)}║
║  Iteration: ${state.iteration.toString().padStart(2)} / ${maxIter.padEnd(
    maxIter === '∞' ? 1 : 2,
  )}                                        ║
║  Started: ${state.started_at.slice(0, 19).padEnd(43)}║
║  Verification: ${verification.padEnd(39)}║
╠══════════════════════════════════════════════════════════╣
║  Task: ${state.task.slice(0, 52).padEnd(52)}║
╚══════════════════════════════════════════════════════════╝
`.trim();
}
