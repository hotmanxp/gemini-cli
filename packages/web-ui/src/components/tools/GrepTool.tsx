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

export const GrepTool: Component<{ part: ToolPart }> = (props) => {
  const state = createMemo(() => parseState(props.part.state));
  const pattern = createMemo(
    () => state().input?.pattern as string | undefined,
  );
  const matches = createMemo(
    () => state().metadata?.matches as number | undefined,
  );
  const output = createMemo(() => state().output as string | undefined);
  const error = createMemo(() => state().metadata?.error as string | undefined);

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-cyan-400 font-medium">Grep</span>
          <span class="text-gemini-comment">·</span>
          <span class="text-gemini-gray font-mono text-xs">"{pattern()}"</span>
        </div>
        <div class="flex items-center gap-2">
          <Show when={matches() !== undefined}>
            <span class="text-xs text-gemini-comment">{matches()} matches</span>
          </Show>
          <span
            class={`text-xs px-2 py-0.5 rounded ${
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
        <div class="text-red-400 text-sm font-mono bg-red-900/20 rounded px-3 py-2">
          {error()}
        </div>
      </Show>
      <Show when={output()}>
        <pre class="text-gemini-gray text-xs font-mono bg-gemini-background rounded px-3 py-2 overflow-x-auto max-h-48">
          {output()}
        </pre>
      </Show>
    </div>
  );
};
