/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, createMemo, Show } from 'solid-js';
import type { ToolState, ToolPart } from './ReadTool.js';

function getFileName(filePath?: string): string {
  if (!filePath) return '';
  return filePath.split('/').pop() || filePath;
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

export const EditTool: Component<{ part: ToolPart }> = (props) => {
  const state = createMemo(() => parseState(props.part.state));
  const filePath = createMemo(() => (state().input?.filePath as string) || '');
  const oldString = createMemo(
    () => state().input?.oldString as string | undefined,
  );
  const newString = createMemo(
    () => state().input?.newString as string | undefined,
  );
  const error = createMemo(() => state().metadata?.error as string | undefined);
  const diff = createMemo(() => state().metadata?.diff as string | undefined);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-yellow-400 font-medium">Edit</span>
          <span className="text-gemini-comment">·</span>
          <span className="text-gemini-gray font-mono text-xs" title={filePath()}>
            {getFileName(filePath())}
          </span>
        </div>
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
      <Show when={error()}>
        <div className="text-red-400 text-sm font-mono bg-red-900/20 rounded px-3 py-2">
          {error()}
        </div>
      </Show>
      <Show when={diff()}>
        <pre className="text-gemini-gray text-xs font-mono bg-gemini-background rounded px-3 py-2 overflow-x-auto">
          {diff()}
        </pre>
      </Show>
      <Show when={!diff() && (oldString() || newString())}>
        <div className="bg-gemini-background rounded px-3 py-2 space-y-2">
          <Show when={oldString()}>
            <div>
              <span className="text-red-400 text-xs">- </span>
              <span className="text-gemini-comment text-xs font-mono">
                {oldString()}
              </span>
            </div>
          </Show>
          <Show when={newString()}>
            <div>
              <span className="text-green-400 text-xs">+ </span>
              <span className="text-gemini-gray text-xs font-mono">
                {newString()}
              </span>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};
