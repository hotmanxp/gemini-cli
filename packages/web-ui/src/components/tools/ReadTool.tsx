/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, createMemo, Show } from 'solid-js';

export interface ToolState {
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  metadata?: Record<string, unknown>;
  time?: { start: number; end: number };
}

export interface ToolPart {
  type: 'tool';
  tool: string;
  state: ToolState;
}

function getFileName(filePath?: string): string {
  if (!filePath) return '';
  return filePath.split('/').pop() || filePath;
}

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

function ToolHeader(props: { name: string; target?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gemini-accent-blue font-medium">{props.name}</span>
      <Show when={props.target}>
        <span className="text-gemini-comment">·</span>
        <span className="text-gemini-gray font-mono text-xs" title={props.target}>
          {getFileName(props.target)}
        </span>
      </Show>
    </div>
  );
}

function ToolStatus(props: { status: ToolState['status'] }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${
        props.status === 'completed'
          ? 'bg-green-900/50 text-green-400'
          : props.status === 'error'
            ? 'bg-red-900/50 text-red-400'
            : props.status === 'running'
              ? 'bg-yellow-900/50 text-yellow-400'
              : 'bg-gemini-dark-gray text-gemini-comment'
      }`}
    >
      {props.status}
    </span>
  );
}

function ToolDuration(props: { time?: { start: number; end: number } }) {
  return (
    <Show when={props.time}>
      <span className="text-xs text-gemini-comment">
        {formatDuration((props.time?.end || 0) - (props.time?.start || 0))}
      </span>
    </Show>
  );
}

export const ReadTool: Component<{ part: ToolPart }> = (props) => {
  const state = createMemo(() => parseState(props.part.state));
  const filePath = createMemo(() => (state().input?.filePath as string) || '');
  const preview = createMemo(
    () => state().metadata?.preview as string | undefined,
  );
  const error = createMemo(() => state().metadata?.error as string | undefined);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <ToolHeader name="Read" target={filePath()} />
        <div className="flex items-center gap-2">
          <ToolStatus status={state().status} />
          <ToolDuration time={state().time} />
        </div>
      </div>
      <Show when={error()}>
        <div className="text-red-400 text-sm font-mono bg-red-900/20 rounded px-3 py-2">
          {error()}
        </div>
      </Show>
      <Show when={preview()}>
        <pre className="text-gemini-gray text-xs font-mono bg-gemini-background rounded px-3 py-2 overflow-x-auto max-h-48">
          {preview()}
        </pre>
      </Show>
      <Show when={!error() && !preview() && state().output}>
        <pre className="text-gemini-comment text-xs font-mono bg-gemini-background/50 rounded px-3 py-2">
          {state().output}
        </pre>
      </Show>
    </div>
  );
};
