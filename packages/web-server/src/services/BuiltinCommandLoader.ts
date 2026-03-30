/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICommandLoader, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { createWebCommand } from './WebCommandExecutor.js';

const COMMAND_DEFINITIONS: Array<{
  name: string;
  description: string;
  autoExecute: boolean;
  subCommands?: Array<{
    name: string;
    description: string;
    autoExecute: boolean;
  }>;
}> = [
  {
    name: 'about',
    description: 'Show information about Gemini CLI',
    autoExecute: false,
  },
  {
    name: 'agents',
    description: 'Manage agent configurations',
    autoExecute: false,
  },
  { name: 'auth', description: 'Authentication settings', autoExecute: false },
  { name: 'bug', description: 'Report a bug or issue', autoExecute: true },
  {
    name: 'chat',
    description: 'Manage chat sessions',
    autoExecute: false,
    subCommands: [
      { name: 'new', description: 'Start a new chat', autoExecute: true },
      { name: 'list', description: 'List chat sessions', autoExecute: true },
      {
        name: 'resume',
        description: 'Resume a previous session',
        autoExecute: false,
      },
    ],
  },
  {
    name: 'clear',
    description: 'Clear the current chat conversation',
    autoExecute: true,
  },
  {
    name: 'commands',
    description: 'List all available commands',
    autoExecute: true,
  },
  {
    name: 'compress',
    description: 'Compress conversation context',
    autoExecute: true,
  },
  {
    name: 'copy',
    description: 'Copy conversation to clipboard',
    autoExecute: true,
  },
  { name: 'corgi', description: 'Toggle corgi mode', autoExecute: true },
  { name: 'docs', description: 'Open documentation', autoExecute: false },
  {
    name: 'directory',
    description: 'Change working directory',
    autoExecute: false,
  },
  {
    name: 'editor',
    description: 'Edit a file in your editor',
    autoExecute: false,
  },
  { name: 'extensions', description: 'Manage extensions', autoExecute: false },
  {
    name: 'help',
    description: 'Show available commands and usage',
    autoExecute: true,
  },
  { name: 'footer', description: 'Show footer information', autoExecute: true },
  {
    name: 'shortcuts',
    description: 'Show keyboard shortcuts',
    autoExecute: true,
  },
  { name: 'hooks', description: 'Manage hooks', autoExecute: false },
  {
    name: 'rewind',
    description: 'Rewind conversation context',
    autoExecute: false,
  },
  { name: 'ide', description: 'IDE integration settings', autoExecute: false },
  { name: 'init', description: 'Initialize a new project', autoExecute: false },
  { name: 'mcp', description: 'Manage MCP servers', autoExecute: false },
  {
    name: 'memory',
    description: 'Memory and context management',
    autoExecute: false,
  },
  {
    name: 'model',
    description: 'Show or change the current model',
    autoExecute: false,
  },
  {
    name: 'permissions',
    description: 'Manage folder permissions',
    autoExecute: false,
  },
  {
    name: 'plan',
    description: 'Show planning information',
    autoExecute: false,
  },
  {
    name: 'policies',
    description: 'Show policy information',
    autoExecute: true,
  },
  {
    name: 'privacy',
    description: 'Show privacy information',
    autoExecute: true,
  },
  { name: 'profile', description: 'Manage profiles', autoExecute: false },
  { name: 'quit', description: 'Exit the application', autoExecute: true },
  {
    name: 'restore',
    description: 'Restore a previous session',
    autoExecute: false,
  },
  {
    name: 'resume',
    description: 'Resume a previous chat session',
    autoExecute: false,
  },
  {
    name: 'stats',
    description: 'Show token and cost statistics',
    autoExecute: true,
  },
  { name: 'theme', description: 'Change color theme', autoExecute: false },
  { name: 'tools', description: 'Manage available tools', autoExecute: false },
  { name: 'skills', description: 'Manage agent skills', autoExecute: false },
  { name: 'settings', description: 'Open settings panel', autoExecute: true },
  { name: 'shells', description: 'Manage shell sessions', autoExecute: false },
  { name: 'vim', description: 'Toggle vim mode', autoExecute: true },
  { name: 'upgrade', description: 'Check for upgrades', autoExecute: false },
];

export class BuiltinCommandLoader implements ICommandLoader {
  constructor(_config: unknown = null) {}

  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    return COMMAND_DEFINITIONS.map((def) => {
      const baseCommand: Omit<SlashCommand, 'action'> = {
        name: def.name,
        description: def.description,
        kind: CommandKind.BUILT_IN,
        autoExecute: def.autoExecute,
      };

      if (def.subCommands) {
        return createWebCommand(def.name, {
          ...baseCommand,
          subCommands: def.subCommands.map((sub) => ({
            name: sub.name,
            description: sub.description,
            kind: CommandKind.BUILT_IN,
            autoExecute: sub.autoExecute,
          })),
        });
      }

      return createWebCommand(def.name, baseCommand);
    });
  }
}
