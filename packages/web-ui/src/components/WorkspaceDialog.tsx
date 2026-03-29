import { type Component, createSignal, For, Show } from 'solid-js';
import { useSdk } from '../context/sdk.js';

interface DirEntry {
  name: string;
  path: string;
}

interface WorkspaceDialogProps {
  onClose: () => void;
  onSelect: (workspace: string, workspaceName: string) => void;
}

export const WorkspaceDialog: Component<WorkspaceDialogProps> = (props) => {
  const sdk = useSdk();
  const [currentPath, setCurrentPath] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [directories, setDirectories] = createSignal<DirEntry[]>([]);
  const [parent, setParent] = createSignal<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = createSignal<DirEntry[]>([]);
  const [homeDir, setHomeDir] = createSignal<string>('/Users');

  const loadDirectory = async (dir: string | null) => {
    setLoading(true);
    try {
      const result = await sdk.client().listDirectories(dir ?? undefined);
      setHomeDir(result.homeDir);
      const targetDir = dir === null ? result.homeDir : dir;
      setDirectories(result.directories);
      setParent(result.parent);
      setCurrentPath(targetDir);

      const crumbs: DirEntry[] = [{ name: '~', path: '~' }];
      if (targetDir !== result.homeDir && targetDir !== '~') {
        const parts = targetDir.split('/').filter(Boolean);
        let buildPath = '';
        for (const part of parts) {
          buildPath += '/' + part;
          if (buildPath === targetDir) {
            crumbs.push({ name: part, path: targetDir });
          } else {
            crumbs.push({ name: part, path: buildPath });
          }
        }
      }
      setBreadcrumbs(crumbs);
    } catch {
      setDirectories([]);
      setParent(null);
      if (dir === null) {
        setCurrentPath(homeDir());
      }
    }
    setLoading(false);
  };

  loadDirectory(null);

  const handleBackClick = () => {
    const p = parent();
    if (p) {
      loadDirectory(p);
    } else {
      loadDirectory(null);
    }
  };

  const handleBreadcrumbClick = (crumb: DirEntry) => {
    if (crumb.path === '~') {
      loadDirectory(null);
    } else {
      loadDirectory(crumb.path);
    }
  };

  const handleSelect = () => {
    const path = currentPath() || homeDir();
    const name = path.split('/').pop() || path;
    props.onSelect(path, name);
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <div
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div class="bg-gemini-msg-bg rounded-lg shadow-xl w-full max-w-lg mx-4 border border-gemini-dark-gray">
        <div class="px-4 py-3 border-b border-gemini-dark-gray flex items-center justify-between">
          <h2 class="text-base font-semibold text-gemini-foreground">
            Select Workspace
          </h2>
          <button
            onClick={props.onClose}
            class="p-1 text-gemini-comment hover:text-gemini-foreground rounded transition-colors"
          >
            ✕
          </button>
        </div>

        <div class="p-3">
          <div class="flex items-center gap-1 text-xs mb-3 overflow-x-auto whitespace-nowrap">
            <For each={breadcrumbs()}>
              {(crumb, index) => (
                <>
                  <Show when={index() > 0}>
                    <span class="text-gemini-dark-gray">/</span>
                  </Show>
                  <button
                    onClick={() => handleBreadcrumbClick(crumb)}
                    class={`px-1 py-0.5 rounded transition-colors ${
                      index() === breadcrumbs().length - 1
                        ? 'text-gemini-foreground font-medium'
                        : 'text-gemini-comment hover:text-gemini-foreground'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </>
              )}
            </For>
          </div>

          <div class="bg-gemini-background rounded-lg border border-gemini-dark-gray max-h-72 overflow-y-auto">
            <Show when={parent()}>
              <button
                onClick={handleBackClick}
                class="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gemini-comment hover:bg-gemini-dark-gray hover:text-gemini-foreground transition-colors"
              >
                <span class="text-gemini-dark-gray">↑</span>
                <span>..</span>
              </button>
            </Show>
            <Show
              when={!loading()}
              fallback={
                <div class="px-3 py-4 text-center text-xs text-gemini-comment">
                  Loading...
                </div>
              }
            >
              <Show
                when={directories().length > 0}
                fallback={
                  <div class="px-3 py-4 text-center text-xs text-gemini-comment">
                    No subdirectories
                  </div>
                }
              >
                <For each={directories()}>
                  {(dir) => (
                    <button
                      onClick={() => loadDirectory(dir.path)}
                      class="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gemini-comment hover:bg-gemini-dark-gray hover:text-gemini-foreground transition-colors"
                    >
                      <span class="text-gemini-accent">📁</span>
                      <span class="truncate">{dir.name}</span>
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </div>

          <div class="mt-3 px-3 py-2 bg-gemini-dark-gray rounded text-xs text-gemini-foreground font-mono truncate">
            {currentPath() || homeDir()}
          </div>
        </div>

        <div class="px-4 py-3 border-t border-gemini-dark-gray flex justify-end gap-2">
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 text-xs font-medium text-gemini-comment hover:text-gemini-foreground hover:bg-gemini-dark-gray rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            class="px-3 py-1.5 text-xs font-medium bg-gemini-accent hover:bg-gemini-accent text-gemini-background rounded transition-colors"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
};
