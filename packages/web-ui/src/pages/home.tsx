/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Component, createSignal, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useSync } from '../context/sync.js';
import { useSdk } from '../context/sdk.js';
import { WorkspaceDialog } from '../components/WorkspaceDialog.js';

interface WorkspaceGroup {
  workspace: string;
  name: string;
  sessions: Array<{
    id: string;
    slug: string;
    createdAt: number;
    updatedAt: number;
    status: 'idle' | 'busy';
  }>;
}

export const Home: Component = () => {
  const sync = useSync();
  const sdk = useSdk();
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(true);
  const [showWorkspaceDialog, setShowWorkspaceDialog] = createSignal(false);
  const [groupedSessions, setGroupedSessions] = createSignal<WorkspaceGroup[]>(
    [],
  );

  onMount(async () => {
    await sync.loadSessions();
    await loadGroupedSessions();
    setLoading(false);
  });

  const loadGroupedSessions = async () => {
    try {
      const data = await sdk.client().getGroupedSessions();
      setGroupedSessions(data);
    } catch {
      setGroupedSessions([]);
    }
  };

  const handleNewSession = () => {
    setShowWorkspaceDialog(true);
  };

  const handleWorkspaceSelect = async (
    workspace: string,
    workspaceName: string,
  ) => {
    setShowWorkspaceDialog(false);
    const id = await sync.createSession(workspace, workspaceName);
    navigate(`/session/${id}`);
  };

  const handleSelectSession = (id: string) => {
    sync.selectSession(id);
    navigate(`/session/${id}`);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-3xl mx-auto text-sm">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Sessions</h2>
        <button
          onClick={handleNewSession}
          className="px-3 py-1.5 bg-gemini-accent hover:bg-gemini-accent rounded-lg font-medium transition-colors text-gemini-background text-sm"
        >
          New Session
        </button>
      </header>

      <Show
        when={!loading()}
        fallback={<p className="text-gemini-comment text-xs">Loading...</p>}
      >
        <Show
          when={groupedSessions().length > 0}
          fallback={
            <div className="text-center py-8">
              <p className="text-gemini-comment mb-4">No sessions yet</p>
              <p className="text-gemini-dark-gray text-sm">
                Start a new session to begin chatting
              </p>
            </div>
          }
        >
          <div className="space-y-6">
            <For each={groupedSessions()}>
              {(group) => (
                <div className="workspace-group">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-semibold text-gemini-gray">
                      {group.name}
                    </span>
                    <span className="text-xs text-gemini-comment bg-gemini-msg-bg px-2 py-1 rounded">
                      {group.sessions.length} session
                      {group.sessions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <For each={group.sessions.slice(0, 5)}>
                      {(session) => (
                        <div
                          className="p-3 bg-gemini-msg-bg rounded-lg hover:bg-gemini-dark-gray cursor-pointer transition-colors flex items-center justify-between group"
                          onClick={() => handleSelectSession(session.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full ${session.status === 'busy' ? 'bg-gemini-accent-yellow' : 'bg-gemini-accent-green'}`}
                            />
                            <span className="font-mono text-sm">
                              {session.slug}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gemini-comment">
                              {formatTime(session.updatedAt)}
                            </span>
                            <span className="text-xs text-gemini-dark-gray group-hover:text-gemini-comment">
                              {session.status === 'busy' ? 'busy' : 'idle'}
                            </span>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={group.sessions.length > 5}>
                      <p className="text-xs text-gemini-comment pl-3">
                        +{group.sessions.length - 5} more
                      </p>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={showWorkspaceDialog()}>
        <WorkspaceDialog
          onClose={() => setShowWorkspaceDialog(false)}
          onSelect={handleWorkspaceSelect}
        />
      </Show>
    </div>
  );
};
