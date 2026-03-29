import { type Component, createMemo, For, Show } from 'solid-js';
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

interface Task {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dependencies?: string[];
}

export const TrackerTool: Component<{ part: ToolPart }> = (props) => {
  const state = createMemo(() => parseState(props.part.state));
  const toolName = createMemo(() => {
    const name = props.part.tool || '';
    return name.replace('tracker_', '').replace(/_/g, ' ');
  });

  const tasks = createMemo(() => {
    const output = state().output;
    if (typeof output === 'string') {
      try {
        const parsed = JSON.parse(output);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.tasks) return parsed.tasks;
        return [parsed];
      } catch {
        return [];
      }
    }
    if (Array.isArray(output)) return output;
    return [];
  });

  const taskObj = createMemo(() => {
    const output = state().output;
    if (typeof output === 'string') {
      try {
        return JSON.parse(output);
      } catch {
        return null;
      }
    }
    return output;
  });

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-purple-400 font-medium">Tracker</span>
          <span class="text-gemini-comment">·</span>
          <span class="text-gemini-gray text-xs capitalize">{toolName()}</span>
        </div>
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

      <Show when={state().metadata?.error}>
        <pre class="text-red-400 text-xs font-mono bg-red-900/20 rounded px-3 py-2 overflow-x-auto">
          {state().metadata?.error as string}
        </pre>
      </Show>

      <Show when={tasks().length > 0}>
        <div class="space-y-1">
          <For each={tasks()}>
            {(task: Task) => (
              <div class="flex items-start gap-2 p-2 bg-gemini-background rounded text-xs">
                <span
                  class={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                    task.status === 'done'
                      ? 'bg-green-400'
                      : task.status === 'in_progress'
                        ? 'bg-yellow-400'
                        : 'bg-gray-500'
                  }`}
                />
                <div class="flex-1 min-w-0">
                  <p class="text-gemini-foreground truncate">
                    {task.title || task.id}
                  </p>
                  <Show when={task.status}>
                    <span class="text-gemini-comment text-xs">
                      {task.status}
                    </span>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={state().input}>
        <div class="text-xs text-gemini-comment">
          Input: {JSON.stringify(state().input)}
        </div>
      </Show>

      <Show when={taskObj() && tasks().length === 0 && state().output}>
        <pre class="text-gemini-gray text-xs font-mono bg-gemini-background rounded px-3 py-2 overflow-x-auto max-h-32">
          {typeof state().output === 'string'
            ? state().output
            : JSON.stringify(state().output, null, 2)}
        </pre>
      </Show>
    </div>
  );
};
