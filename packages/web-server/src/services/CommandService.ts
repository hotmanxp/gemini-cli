/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '@google/gemini-cli-core';
import type { SlashCommand , ICommandLoader, CommandConflict } from './types.js';

class CommandRegistry {
  readonly commandMap = new Map<string, SlashCommand>();
  readonly conflictsMap = new Map<string, CommandConflict>();
  readonly firstEncounters = new Map<string, SlashCommand>();

  get finalCommands(): SlashCommand[] {
    return Array.from(this.commandMap.values());
  }

  get conflicts(): CommandConflict[] {
    return Array.from(this.conflictsMap.values());
  }
}

export class CommandService {
  private constructor(
    private readonly commands: readonly SlashCommand[],
    private readonly conflicts: readonly CommandConflict[],
  ) {}

  static async create(
    loaders: ICommandLoader[],
    signal: AbortSignal,
  ): Promise<CommandService> {
    const allCommands = await this.loadAllCommands(loaders, signal);
    const { finalCommands, conflicts } = CommandService.resolve(allCommands);

    return new CommandService(
      Object.freeze(finalCommands),
      Object.freeze(conflicts),
    );
  }

  private static async loadAllCommands(
    loaders: ICommandLoader[],
    signal: AbortSignal,
  ): Promise<SlashCommand[]> {
    const results = await Promise.allSettled(
      loaders.map((loader) => loader.loadCommands(signal)),
    );

    const commands: SlashCommand[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        commands.push(...result.value);
      } else {
        debugLogger.debug('A command loader failed:', result.reason);
      }
    }
    return commands;
  }

  static resolve(allCommands: SlashCommand[]): {
    finalCommands: SlashCommand[];
    conflicts: CommandConflict[];
  } {
    const registry = new CommandRegistry();

    for (const cmd of allCommands) {
      const originalName = cmd.name;
      let finalName = originalName;

      const shouldAlwaysPrefix = cmd.kind === 'skill' && !!cmd.extensionName;

      if (shouldAlwaysPrefix) {
        finalName = CommandService.getRenamedName(
          originalName,
          CommandService.getPrefix(cmd),
          registry.commandMap,
          cmd.kind,
        );
      } else if (registry.firstEncounters.has(originalName)) {
        finalName = CommandService.handleConflict(cmd, registry);
      } else {
        registry.firstEncounters.set(originalName, cmd);
      }

      registry.commandMap.set(finalName, {
        ...cmd,
        name: finalName,
      });
    }

    return {
      finalCommands: registry.finalCommands,
      conflicts: registry.conflicts,
    };
  }

  private static handleConflict(
    incoming: SlashCommand,
    registry: CommandRegistry,
  ): string {
    const collidingName = incoming.name;
    const originalClaimant = registry.firstEncounters.get(collidingName)!;

    if (incoming.kind === 'built-in') {
      CommandService.prefixExistingCommand(collidingName, incoming, registry);
      return collidingName;
    }

    const renamedName = CommandService.getRenamedName(
      incoming.name,
      CommandService.getPrefix(incoming),
      registry.commandMap,
      incoming.kind,
    );
    CommandService.trackConflict(
      registry.conflictsMap,
      collidingName,
      originalClaimant,
      incoming,
      renamedName,
    );

    CommandService.prefixExistingCommand(collidingName, incoming, registry);

    return renamedName;
  }

  private static prefixExistingCommand(
    name: string,
    reason: SlashCommand,
    registry: CommandRegistry,
  ): void {
    const currentOwner = registry.commandMap.get(name);

    if (!currentOwner || currentOwner.kind === 'built-in') {
      return;
    }

    const renamedName = CommandService.getRenamedName(
      currentOwner.name,
      CommandService.getPrefix(currentOwner),
      registry.commandMap,
      currentOwner.kind,
    );

    registry.commandMap.delete(name);
    const renamedOwner = { ...currentOwner, name: renamedName };
    registry.commandMap.set(renamedName, renamedOwner);

    CommandService.trackConflict(
      registry.conflictsMap,
      name,
      reason,
      currentOwner,
      renamedName,
    );
  }

  private static getRenamedName(
    name: string,
    prefix: string | undefined,
    commandMap: Map<string, SlashCommand>,
    kind?: string,
  ): string {
    const isExtensionPrefix = kind === 'skill' || kind === 'extension-file';
    const separator = isExtensionPrefix ? ':' : '.';
    const base = prefix ? `${prefix}${separator}${name}` : name;
    let renamedName = base;
    let suffix = 1;

    while (commandMap.has(renamedName)) {
      renamedName = `${base}${suffix}`;
      suffix++;
    }
    return renamedName;
  }

  private static getPrefix(cmd: SlashCommand): string | undefined {
    switch (cmd.kind) {
      case 'extension-file':
      case 'skill':
        return cmd.extensionName;
      case 'mcp-prompt':
        return cmd.mcpServerName;
      case 'user-file':
        return 'user';
      case 'workspace-file':
        return 'workspace';
      default:
        return undefined;
    }
  }

  private static trackConflict(
    conflictsMap: Map<string, CommandConflict>,
    originalName: string,
    reason: SlashCommand,
    displacedCommand: SlashCommand,
    renamedTo: string,
  ) {
    if (!conflictsMap.has(originalName)) {
      conflictsMap.set(originalName, {
        name: originalName,
        losers: [],
      });
    }

    conflictsMap.get(originalName)!.losers.push({
      command: displacedCommand,
      renamedTo,
      reason,
    });
  }

  getCommands(): readonly SlashCommand[] {
    return this.commands;
  }

  getConflicts(): readonly CommandConflict[] {
    return this.conflicts;
  }
}
