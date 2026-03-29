/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICommandLoader, SlashCommand } from './types.js';

export class FileCommandLoader implements ICommandLoader {
  constructor(private config: unknown = null) {}

  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    return [];
  }
}
