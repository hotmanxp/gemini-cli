/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandActionReturn } from '@google/gemini-cli-core';

export enum CommandKind {
  BUILT_IN = 'built-in',
  USER_FILE = 'user-file',
  WORKSPACE_FILE = 'workspace-file',
  EXTENSION_FILE = 'extension-file',
  MCP_PROMPT = 'mcp-prompt',
  AGENT = 'agent',
  SKILL = 'skill',
}

export interface SlashCommand {
  name: string;
  altNames?: string[];
  description: string;
  hidden?: boolean;
  suggestionGroup?: string;
  kind: CommandKind;
  autoExecute?: boolean;
  isSafeConcurrent?: boolean;
  extensionName?: string;
  extensionId?: string;
  mcpServerName?: string;
  action?: (
    context: CommandContext,
    args: string,
  ) =>
    | void
    | SlashCommandActionReturn
    | Promise<void | SlashCommandActionReturn>;
  completion?: (
    context: CommandContext,
    partialArg: string,
  ) => Promise<string[]> | string[];
  showCompletionLoading?: boolean;
  subCommands?: SlashCommand[];
}

export interface QuitActionReturn {
  type: 'quit';
  messages: unknown[];
}

export interface OpenDialogActionReturn {
  type: 'dialog';
  props?: Record<string, unknown>;
  dialog:
    | 'help'
    | 'auth'
    | 'theme'
    | 'editor'
    | 'privacy'
    | 'settings'
    | 'sessionBrowser'
    | 'model'
    | 'agentConfig'
    | 'permissions';
}

export interface ConfirmShellCommandsActionReturn {
  type: 'confirm_shell_commands';
  commandsToConfirm: string[];
  originalInvocation: {
    raw: string;
  };
}

export interface ConfirmActionReturn {
  type: 'confirm_action';
  prompt: unknown;
  originalInvocation: {
    raw: string;
  };
}

export interface OpenCustomDialogActionReturn {
  type: 'custom_dialog';
  component: unknown;
}

export interface LogoutActionReturn {
  type: 'logout';
}

export type SlashCommandActionReturn =
  | CommandActionReturn<unknown[]>
  | QuitActionReturn
  | OpenDialogActionReturn
  | ConfirmShellCommandsActionReturn
  | ConfirmActionReturn
  | OpenCustomDialogActionReturn
  | LogoutActionReturn;

export interface CommandContext {
  invocation?: {
    raw: string;
    name: string;
    args: string;
  };
  services: {
    agentContext: unknown;
    settings: unknown;
    git: unknown;
    logger: unknown;
  };
  ui: {
    addItem: (item: unknown, timestamp?: number) => void;
    clear: () => void;
    setDebugMessage: (message: string) => void;
    pendingItem: unknown | null;
    setPendingItem: (item: unknown | null) => void;
    loadHistory: (history: unknown[], postLoadInput?: string) => void;
    toggleCorgiMode: () => void;
    toggleDebugProfiler: () => void;
    toggleVimEnabled: () => Promise<boolean>;
    reloadCommands: () => void;
    openAgentConfigDialog: (
      name: string,
      displayName: string,
      definition: unknown,
    ) => void;
    extensionsUpdateState: Map<string, unknown>;
    dispatchExtensionStateUpdate: (action: unknown) => void;
    addConfirmUpdateExtensionRequest: (value: unknown) => void;
    setConfirmationRequest: (value: unknown) => void;
    removeComponent: () => void;
    toggleBackgroundShell: () => void;
    toggleShortcutsHelp: () => void;
  };
  session: {
    stats: unknown;
    sessionShellAllowlist: Set<string>;
  };
  overwriteConfirmed?: boolean;
}

export interface ICommandLoader {
  loadCommands(signal: AbortSignal): Promise<SlashCommand[]>;
}

export interface CommandConflict {
  name: string;
  losers: Array<{
    command: SlashCommand;
    renamedTo: string;
    reason: SlashCommand;
  }>;
}
