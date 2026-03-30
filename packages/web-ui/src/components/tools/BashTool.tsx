/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, createMemo, Show } from 'solid-js';
import type { ToolState, ToolPart } from './ReadTool.js';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

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

export const BashTool: Component<{ part: ToolPart }> = (props) => {
  const state = createMemo(() => parseState(props.part.state));
  const command = createMemo(
    () => state().input?.command as string | undefined,
  );
  const output = createMemo(
    () =>
      (state().metadata?.stdout as string) ||
      (state().output),
  );
  const error = createMemo(() => state().metadata?.error as string | undefined);
  const exitCode = createMemo(
    () => state().metadata?.exitCode as number | undefined,
  );
  const duration = createMemo(() => {
    const t = state().time;
    return t ? t.end - t.start : 0;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-purple-400 font-medium">Bash</span>
          <span className="text-gemini-comment">·</span>
          <span
            className="text-gemini-gray font-mono text-xs truncate max-w-xs"
            title={command()}
          >
            {command() || '...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Show when={duration() > 0}>
            <span className="text-xs text-gemini-comment">
              {formatDuration(duration())}
            </span>
          </Show>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              state().status === 'completed'
                ? exitCode() === 0
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-yellow-900/50 text-yellow-400'
                : state().status === 'error'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-gemini-dark-gray text-gemini-comment'
            }`}
          >
            {state().status}
            {exitCode() !== undefined && ` (${exitCode()})`}
          </span>
        </div>
      </div>
      <Show when={error()}>
        <pre className="text-red-400 text-xs font-mono bg-red-900/20 rounded px-3 py-2 overflow-x-auto">
          {error()}
        </pre>
      </Show>
      <Show when={output()}>
        <pre className="text-gemini-gray text-xs font-mono bg-gemini-background rounded px-3 py-2 overflow-x-auto max-h-48">
          {output()}
        </pre>
      </Show>
    </div>
  );
};
