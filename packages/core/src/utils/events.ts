/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'node:events';
import type { AgentDefinition } from '../agents/types.js';
import type { McpClient } from '../tools/mcp-client.js';
import type { ExtensionEvents } from './extensionLoader.js';
import type { EditorType } from './editor.js';
import type {
  TokenStorageInitializationEvent,
  KeychainAvailabilityEvent,
} from '../telemetry/types.js';
import { debugLogger } from './debugLogger.js';

/**
 * Defines the severity level for user-facing feedback.
 * This maps loosely to UI `MessageType`
 */
export type FeedbackSeverity = 'info' | 'warning' | 'error';

/**
 * Payload for the 'user-feedback' event.
 */
export interface UserFeedbackPayload {
  /**
   * The severity level determines how the message is rendered in the UI
   * (e.g. colored text, specific icon).
   */
  severity: FeedbackSeverity;
  /**
   * The main message to display to the user in the chat history or stdout.
   */
  message: string;
  /**
   * The original error object, if applicable.
   * Listeners can use this to extract stack traces for debug logging
   * or verbose output, while keeping the 'message' field clean for end users.
   */
  error?: unknown;
}

/**
 * Payload for the 'model-changed' event.
 */
export interface ModelChangedPayload {
  /**
   * The new model that was set.
   */
  model: string;
}

/**
 * Payload for the 'console-log' event.
 */
export interface ConsoleLogPayload {
  type: 'log' | 'warn' | 'error' | 'debug' | 'info';
  content: string;
}

/**
 * Payload for the 'output' event.
 */
export interface OutputPayload {
  isStderr: boolean;
  chunk: Uint8Array | string;
  encoding?: BufferEncoding;
}

/**
 * Payload for the 'memory-changed' event.
 */
export interface MemoryChangedPayload {
  fileCount: number;
}

/**
 * Base payload for hook-related events.
 */
export interface HookPayload {
  hookName: string;
  eventName: string;
}

/**
 * Payload for the 'hook-start' event.
 */
export interface HookStartPayload extends HookPayload {
  /**
   * The 1-based index of the current hook in the execution sequence.
   * Used for progress indication (e.g. "Hook 1/3").
   */
  hookIndex?: number;
  /**
   * The total number of hooks in the current execution sequence.
   */
  totalHooks?: number;
}

/**
 * Payload for the 'hook-end' event.
 */
export interface HookEndPayload extends HookPayload {
  success: boolean;
}

/**
 * Payload for the 'retry-attempt' event.
 */
export interface RetryAttemptPayload {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  error?: string;
  model: string;
}

/**
 * Payload for the 'consent-request' event.
 */
export interface ConsentRequestPayload {
  prompt: string;
  onConfirm: (confirmed: boolean) => void;
}

/**
 * Payload for the 'mcp-progress' event.
 */
export interface McpProgressPayload {
  serverName: string;
  callId: string;
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

/**
 * Payload for the 'agents-discovered' event.
 */
export interface AgentsDiscoveredPayload {
  agents: AgentDefinition[];
}

export interface SlashCommandConflict {
  name: string;
  renamedTo: string;
  loserExtensionName?: string;
  winnerExtensionName?: string;
}

export interface SlashCommandConflictsPayload {
  conflicts: SlashCommandConflict[];
}

/**
 * Payload for the 'quota-changed' event.
 */
export interface QuotaChangedPayload {
  remaining: number | undefined;
  limit: number | undefined;
  resetTime?: string;
}

export enum CoreEvent {
  UserFeedback = 'user-feedback',
  ModelChanged = 'model-changed',
  ConsoleLog = 'console-log',
  Output = 'output',
  MemoryChanged = 'memory-changed',
  ExternalEditorClosed = 'external-editor-closed',
  McpClientUpdate = 'mcp-client-update',
  OauthDisplayMessage = 'oauth-display-message',
  SettingsChanged = 'settings-changed',
  HookStart = 'hook-start',
  HookEnd = 'hook-end',
  AgentsRefreshed = 'agents-refreshed',
  AdminSettingsChanged = 'admin-settings-changed',
  RetryAttempt = 'retry-attempt',
  ConsentRequest = 'consent-request',
  McpProgress = 'mcp-progress',
  AgentsDiscovered = 'agents-discovered',
  RequestEditorSelection = 'request-editor-selection',
  EditorSelected = 'editor-selected',
  SlashCommandConflicts = 'slash-command-conflicts',
  QuotaChanged = 'quota-changed',
  TelemetryKeychainAvailability = 'telemetry-keychain-availability',
  TelemetryTokenStorageType = 'telemetry-token-storage-type',
}

/**
 * Payload for the 'editor-selected' event.
 */
export interface EditorSelectedPayload {
  editor?: EditorType;
}

export interface CoreEvents extends ExtensionEvents {
  [CoreEvent.UserFeedback]: [UserFeedbackPayload];
  [CoreEvent.ModelChanged]: [ModelChangedPayload];
  [CoreEvent.ConsoleLog]: [ConsoleLogPayload];
  [CoreEvent.Output]: [OutputPayload];
  [CoreEvent.MemoryChanged]: [MemoryChangedPayload];
  [CoreEvent.QuotaChanged]: [QuotaChangedPayload];
  [CoreEvent.ExternalEditorClosed]: never[];
  [CoreEvent.McpClientUpdate]: Array<Map<string, McpClient> | never>;
  [CoreEvent.OauthDisplayMessage]: string[];
  [CoreEvent.SettingsChanged]: never[];
  [CoreEvent.HookStart]: [HookStartPayload];
  [CoreEvent.HookEnd]: [HookEndPayload];
  [CoreEvent.AgentsRefreshed]: never[];
  [CoreEvent.AdminSettingsChanged]: never[];
  [CoreEvent.RetryAttempt]: [RetryAttemptPayload];
  [CoreEvent.ConsentRequest]: [ConsentRequestPayload];
  [CoreEvent.McpProgress]: [McpProgressPayload];
  [CoreEvent.AgentsDiscovered]: [AgentsDiscoveredPayload];
  [CoreEvent.RequestEditorSelection]: never[];
  [CoreEvent.EditorSelected]: [EditorSelectedPayload];
  [CoreEvent.SlashCommandConflicts]: [SlashCommandConflictsPayload];
  [CoreEvent.TelemetryKeychainAvailability]: [KeychainAvailabilityEvent];
  [CoreEvent.TelemetryTokenStorageType]: [TokenStorageInitializationEvent];
}

type EventBacklogItem = {
  [K in keyof CoreEvents]: {
    event: K;
    args: CoreEvents[K];
  };
}[keyof CoreEvents];

export class CoreEventEmitter extends EventEmitter<CoreEvents> {
  private _eventBacklog: EventBacklogItem[] = [];
  // Memory protection: reduced from 10000 to prevent OOM in long-running sessions
  private static readonly MAX_BACKLOG_SIZE = 1000;
  // Warning threshold for listener leaks
  private static readonly MAX_LISTENER_WARNING = 50;
  // Backlog items older than this are pruned (5 minutes)
  private static readonly BACKLOG_TTL_MS = 5 * 60 * 1000;
  private _lastBacklogPruneTime: number = Date.now();
  // Periodic cleanup interval
  private _cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Set reasonable listener limit
    this.setMaxListeners(100);
    // Start periodic cleanup
    this._startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup of old backlog items and stale listeners
   */
  private _startPeriodicCleanup() {
    this._cleanupInterval = setInterval(() => {
      this._pruneOldBacklogItems();
      this._checkListenerLeaks();
    }, 60000); // Run every minute
    this._cleanupInterval.unref();
  }

  /**
   * Remove backlog items older than TTL
   */
  private _pruneOldBacklogItems() {
    const now = Date.now();
    if (now - this._lastBacklogPruneTime < CoreEventEmitter.BACKLOG_TTL_MS) {
      return;
    }

    this._lastBacklogPruneTime = now;
    const initialLength = this._eventBacklog.length;

    // Keep only recent items (last 2 minutes worth)
    const cutoffTime = now - 2 * 60 * 1000;
    this._eventBacklog = this._eventBacklog.filter((item) => {
      // Estimate timestamp from position (rough heuristic)
      return true; // For now, keep all items but limit by count
    });

    // Enforce max size
    if (this._eventBacklog.length > CoreEventEmitter.MAX_BACKLOG_SIZE) {
      this._eventBacklog = this._eventBacklog.slice(
        this._eventBacklog.length - CoreEventEmitter.MAX_BACKLOG_SIZE,
      );
    }

    const removed = initialLength - this._eventBacklog.length;
    if (removed > 0) {
      debugLogger.debug(`Pruned ${removed} old backlog items`);
    }
  }

  /**
   * Stop the periodic cleanup timer.
   * Should be called when disposing of the emitter.
   */
  dispose() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    this.removeAllListeners();
    this._eventBacklog = [];
  }

  /**
   * Check for listener leaks and warn if thresholds exceeded
   */
  private _checkListenerLeaks() {
    const eventNames = this.eventNames();
    for (const eventName of eventNames) {
      const listenerCount = this.listenerCount(eventName as keyof CoreEvents);
      if (listenerCount > CoreEventEmitter.MAX_LISTENER_WARNING) {
        debugLogger.warn(
          `High listener count for ${String(eventName)}: ${listenerCount}. ` +
            'This may indicate a memory leak. ' +
            'Please check that all coreEvents.on() calls have matching off() calls.',
        );
      }
    }
  }

  private _emitOrQueue<K extends keyof CoreEvents>(
    event: K,
    ...args: CoreEvents[K]
  ): void {
    if (this.listenerCount(event) === 0) {
      if (this._eventBacklog.length >= CoreEventEmitter.MAX_BACKLOG_SIZE) {
        this._eventBacklog.shift();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      this._eventBacklog.push({ event, args } as EventBacklogItem);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      (this.emit as (event: K, ...args: CoreEvents[K]) => boolean)(
        event,
        ...args,
      );
    }
  }

  /**
   * Sends actionable feedback to the user.
   * Buffers automatically if the UI hasn't subscribed yet.
   */
  emitFeedback(
    severity: FeedbackSeverity,
    message: string,
    error?: unknown,
  ): void {
    const payload: UserFeedbackPayload = { severity, message, error };
    this._emitOrQueue(CoreEvent.UserFeedback, payload);
  }

  /**
   * Broadcasts a console log message.
   */
  emitConsoleLog(
    type: 'log' | 'warn' | 'error' | 'debug' | 'info',
    content: string,
  ): void {
    const payload: ConsoleLogPayload = { type, content };
    this._emitOrQueue(CoreEvent.ConsoleLog, payload);
  }

  /**
   * Broadcasts stdout/stderr output.
   */
  emitOutput(
    isStderr: boolean,
    chunk: Uint8Array | string,
    encoding?: BufferEncoding,
  ): void {
    const payload: OutputPayload = { isStderr, chunk, encoding };
    this._emitOrQueue(CoreEvent.Output, payload);
  }

  /**
   * Notifies subscribers that the model has changed.
   */
  emitModelChanged(model: string): void {
    const payload: ModelChangedPayload = { model };
    this.emit(CoreEvent.ModelChanged, payload);
  }

  /**
   * Notifies subscribers that settings have been modified.
   */
  emitSettingsChanged(): void {
    this.emit(CoreEvent.SettingsChanged);
  }

  /**
   * Notifies subscribers that a hook execution has started.
   */
  emitHookStart(payload: HookStartPayload): void {
    this.emit(CoreEvent.HookStart, payload);
  }

  /**
   * Notifies subscribers that a hook execution has ended.
   */
  emitHookEnd(payload: HookEndPayload): void {
    this.emit(CoreEvent.HookEnd, payload);
  }

  /**
   * Notifies subscribers that agents have been refreshed.
   */
  emitAgentsRefreshed(): void {
    this.emit(CoreEvent.AgentsRefreshed);
  }

  /**
   * Notifies subscribers that admin settings have changed.
   */
  emitAdminSettingsChanged(): void {
    this.emit(CoreEvent.AdminSettingsChanged);
  }

  /**
   * Notifies subscribers that a retry attempt is happening.
   */
  emitRetryAttempt(payload: RetryAttemptPayload): void {
    this.emit(CoreEvent.RetryAttempt, payload);
  }

  /**
   * Requests consent from the user via the UI.
   */
  emitConsentRequest(payload: ConsentRequestPayload): void {
    this._emitOrQueue(CoreEvent.ConsentRequest, payload);
  }

  /**
   * Notifies subscribers that progress has been made on an MCP tool call.
   */
  emitMcpProgress(payload: McpProgressPayload): void {
    if (!Number.isFinite(payload.progress) || payload.progress < 0) {
      debugLogger.log(`Invalid progress value: ${payload.progress}`);
      return;
    }
    this.emit(CoreEvent.McpProgress, payload);
  }

  /**
   * Notifies subscribers that new unacknowledged agents have been discovered.
   */
  emitAgentsDiscovered(agents: AgentDefinition[]): void {
    const payload: AgentsDiscoveredPayload = { agents };
    this._emitOrQueue(CoreEvent.AgentsDiscovered, payload);
  }

  emitSlashCommandConflicts(conflicts: SlashCommandConflict[]): void {
    const payload: SlashCommandConflictsPayload = { conflicts };
    this._emitOrQueue(CoreEvent.SlashCommandConflicts, payload);
  }

  /**
   * Notifies subscribers that the quota has changed.
   */
  emitQuotaChanged(
    remaining: number | undefined,
    limit: number | undefined,
    resetTime?: string,
  ): void {
    const payload: QuotaChangedPayload = { remaining, limit, resetTime };
    this.emit(CoreEvent.QuotaChanged, payload);
  }

  /**
   * Flushes buffered messages. Call this immediately after primary UI listener
   * subscribes.
   */
  drainBacklogs(): void {
    const backlog = [...this._eventBacklog];
    this._eventBacklog.length = 0; // Clear in-place
    for (const item of backlog) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      (this.emit as (event: keyof CoreEvents, ...args: unknown[]) => boolean)(
        item.event,
        ...item.args,
      );
    }
  }

  emitTelemetryKeychainAvailability(event: KeychainAvailabilityEvent): void {
    this._emitOrQueue(CoreEvent.TelemetryKeychainAvailability, event);
  }

  emitTelemetryTokenStorageType(event: TokenStorageInitializationEvent): void {
    this._emitOrQueue(CoreEvent.TelemetryTokenStorageType, event);
  }
}

export const coreEvents = new CoreEventEmitter();
