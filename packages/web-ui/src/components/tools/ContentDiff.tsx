import { type Component, createMemo, For, Show } from 'solid-js';
import { parsePatch } from 'diff';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

type DiffRow = {
  left: string;
  right: string;
  type: 'added' | 'removed' | 'unchanged' | 'modified';
};

interface ContentDiffProps {
  diff: string;
  lang?: string;
}

function highlightCode(code: string, lang?: string): string {
  if (!code || code === ' ') return code;
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang }).value;
  }
  return hljs.highlightAuto(code).value;
}

export const ContentDiff: Component<ContentDiffProps> = (props) => {
  const rows = createMemo<DiffRow[]>(() => {
    const diffRows: DiffRow[] = [];

    try {
      const patches = parsePatch(props.diff);

      for (const patch of patches) {
        for (const hunk of patch.hunks) {
          const lines = hunk.lines;
          let i = 0;

          while (i < lines.length) {
            const line = lines[i];
            const content = line.slice(1);
            const prefix = line[0];

            if (prefix === '-') {
              const removals: string[] = [content];
              let j = i + 1;

              while (j < lines.length && lines[j][0] === '-') {
                removals.push(lines[j].slice(1));
                j++;
              }

              const additions: string[] = [];
              while (j < lines.length && lines[j][0] === '+') {
                additions.push(lines[j].slice(1));
                j++;
              }

              const maxLength = Math.max(removals.length, additions.length);
              for (let k = 0; k < maxLength; k++) {
                const hasLeft = k < removals.length;
                const hasRight = k < additions.length;

                if (hasLeft && hasRight) {
                  diffRows.push({
                    left: removals[k],
                    right: additions[k],
                    type: 'modified',
                  });
                } else if (hasLeft) {
                  diffRows.push({
                    left: removals[k],
                    right: '',
                    type: 'removed',
                  });
                } else if (hasRight) {
                  diffRows.push({
                    left: '',
                    right: additions[k],
                    type: 'added',
                  });
                }
              }

              i = j;
            } else if (prefix === '+') {
              diffRows.push({
                left: '',
                right: content,
                type: 'added',
              });
              i++;
            } else if (prefix === ' ') {
              diffRows.push({
                left: content === '' ? ' ' : content,
                right: content === '' ? ' ' : content,
                type: 'unchanged',
              });
              i++;
            } else {
              i++;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse patch:', error);
      return [];
    }

    return diffRows;
  });

  return (
    <div class="overflow-x-auto rounded-xl bg-gemini-background">
      <For each={rows()}>
        {(row) => (
          <div
            class="grid grid-cols-2 gap-px bg-gemini-msg-bg"
            data-type={row.type}
          >
            <div
              class="font-mono text-xs p-2 overflow-x-auto"
              classList={{
                'bg-red-900/20':
                  row.type === 'removed' || row.type === 'modified',
                'bg-gemini-msg-bg':
                  row.type === 'unchanged' || row.type === 'added',
              }}
            >
              <Show when={row.left}>
                <code innerHTML={highlightCode(row.left, props.lang)} />
              </Show>
            </div>
            <div
              class="font-mono text-xs p-2 overflow-x-auto"
              classList={{
                'bg-green-900/20':
                  row.type === 'added' || row.type === 'modified',
                'bg-gemini-msg-bg':
                  row.type === 'unchanged' || row.type === 'removed',
              }}
            >
              <Show when={row.right}>
                <code innerHTML={highlightCode(row.right, props.lang)} />
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
