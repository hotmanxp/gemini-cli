/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CommandContext,
  SlashCommand,
  OpenDialogActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

export const customModelsCommand: SlashCommand = {
  name: 'models',
  description: 'Select a model from configured providers',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext): Promise<OpenDialogActionReturn> => {
    if (context.services.config) {
      await context.services.config.refreshUserQuota();
    }

    return {
      type: 'dialog',
      dialog: 'model',
    };
  },
};
