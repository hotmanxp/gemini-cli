/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { defer } from '../deferred.js';
import { startCommand } from './lsp/start.js';
import { statusCommand } from './lsp/status.js';
import { stopCommand } from './lsp/stop.js';
import { completionCommand } from './lsp/completion.js';
import { definitionCommand } from './lsp/definition.js';
import { referencesCommand } from './lsp/references.js';
import { hoverCommand } from './lsp/hover.js';
import { diagnosticsCommand } from './lsp/diagnostics.js';

export const lspCommand: CommandModule = {
  command: 'lsp',
  describe: 'Manage Language Server Protocol (LSP) servers',
  builder: (yargs: Argv) =>
    yargs
      .command(defer(startCommand, 'lsp'))
      .command(defer(statusCommand, 'lsp'))
      .command(defer(stopCommand, 'lsp'))
      .command(defer(completionCommand, 'lsp'))
      .command(defer(definitionCommand, 'lsp'))
      .command(defer(referencesCommand, 'lsp'))
      .command(defer(hoverCommand, 'lsp'))
      .command(defer(diagnosticsCommand, 'lsp'))
      .demandCommand(1, 'You need at least one subcommand')
      .version(false),
  handler: () => {
    // yargs will automatically show help if no subcommand is provided
  },
};
