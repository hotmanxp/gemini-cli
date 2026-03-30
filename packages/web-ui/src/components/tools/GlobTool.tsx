/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, createMemo, Show } from 'solid-js';
import type { ToolState, ToolPart } from './ReadTool.js';

function parseState(state: unknown): ToolState {
  if (typeof state === 'string') {
    try {
      return JSON.parse(state) as ToolState;
    } catch {
      return { status: 'error' } as ToolState;
    }
  }
  return state as ToolState;
}

export const GlobTool: Component<{ part: ToolPart }> = (props) => {
  const state = createMemo(() => parseState(props.part.state));
  const pattern = createMemo(
    () => state().input?.pattern as string | undefined,
  );
  const count = createMemo(() => state().metadata?.count as number | undefined);
  const output = createMemo(() => state().output);
  const error = createMemo(() => state().metadata?.error as string | undefined);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-orange-400 font-medium">Glob</span>
          <span className="text-gemini-comment">·</span>
          <span className="text-gemini-gray font-mono text-xs">"{pattern()}"</span>
        </div>
        <div className="flex items-center gap-2">
          <Show when={count() !== undefined}>
            <span className="text-xs text-gemini-comment">{count()} files</span>
          </Show>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              state().status === 'completed'
                ? 'bg-green-900/50 text-green-400'
                : state().status === 'error'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-gemini-dark-gray text-gemini-comment'
            }`}
          >
            {state().status}
          </span>
        </div>
      </div>
      <Show when={error()}>
        <div className="text-red-400 text-sm font-mono bg-red-900/20 rounded px-3 py-2">
          {error()}
        </div>
      </Show>
      <Show when={output()}>
        <pre className="text-gemini-gray text-xs font-mono bg-gemini-background rounded px-3 py-2 overflow-x-auto max-h-48">
          {output()}
        </pre>
      </Show>
    </div>
  );
};
