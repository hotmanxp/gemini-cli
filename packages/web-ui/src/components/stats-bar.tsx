import { type Component, Show } from 'solid-js';
import type { TokenUsage, CostInfo } from '../lib/sdk-shim.js';

interface StatsBarProps {
  tokens: TokenUsage | null;
  cost: CostInfo | null;
}

export const StatsBar: Component<StatsBarProps> = (props) => {
  const hasTokens = () =>
    props.tokens &&
    (props.tokens.input > 0 ||
      props.tokens.output > 0 ||
      props.tokens.total > 0);
  const hasCost = () => props.cost && props.cost.amount > 0;

  return (
    <Show when={hasTokens() || hasCost()}>
      <div class="flex items-center gap-3 px-4 py-1 bg-gemini-msg-bg text-gemini-comment text-xs font-mono">
        <Show when={hasTokens()}>
          <div class="flex items-center gap-1">
            <span class="text-gemini-dark-gray">In:</span>
            <span>{props.tokens?.input.toLocaleString() ?? 0}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-gemini-dark-gray">Out:</span>
            <span>{props.tokens?.output.toLocaleString() ?? 0}</span>
          </div>
          <Show when={(props.tokens?.thoughts ?? 0) > 0}>
            <div class="flex items-center gap-1">
              <span class="text-gemini-dark-gray">Thoughts:</span>
              <span>{props.tokens?.thoughts?.toLocaleString() ?? 0}</span>
            </div>
          </Show>
          <div class="flex items-center gap-1">
            <span class="text-gemini-dark-gray">Total:</span>
            <span>{props.tokens?.total.toLocaleString() ?? 0}</span>
          </div>
        </Show>
        <Show when={hasCost()}>
          <div class="flex items-center gap-1">
            <span class="text-gemini-dark-gray">Cost:</span>
            <span>${props.cost?.amount.toFixed(6)}</span>
          </div>
        </Show>
      </div>
    </Show>
  );
};
