import { type Component, createSignal, Show, onMount } from 'solid-js';
import { Route, Router, useNavigate } from '@solidjs/router';
import { SdkProvider } from './context/sdk.js';
import { SyncProvider, useSync } from './context/sync.js';
import { SettingsProvider } from './context/settings.js';
import {
  SettingsButton,
  default as SettingsDialog,
} from './components/settings-dialog.js';
import { Home } from './pages/home.js';
import { SessionPage } from './pages/session.js';

export const [leftSidebarOpen, setLeftSidebarOpen] = createSignal(true);
export const [rightPanelOpen, setRightPanelOpen] = createSignal(false);

const Layout: Component<{ children?: any }> = (props) => {
  const sync = useSync();
  const navigate = useNavigate();

  onMount(() => {
    sync.loadSessions();
  });

  return (
    <div class="min-h-screen bg-gemini-background text-gemini-gray text-sm">
      <header class="fixed top-0 left-0 right-0 z-20 bg-gemini-msg-bg border-b border-gemini-dark-gray px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen())}
          class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            leftSidebarOpen()
              ? 'bg-gemini-accent text-gemini-background'
              : 'bg-gemini-dark-gray text-gemini-comment hover:text-gemini-foreground'
          }`}
          title="Toggle sidebar"
        >
          ☰
        </button>
        <Show
          when={sync.state.currentSessionId}
          fallback={
            <h1 class="text-base font-bold text-gemini-foreground">
              Gemini CLI
            </h1>
          }
        >
          <button
            onClick={() => navigate('/')}
            class="px-2 py-1 bg-gemini-dark-gray hover:bg-gemini-dark-gray rounded text-xs font-medium transition-colors text-gemini-comment"
          >
            Home
          </button>
          <span class="font-mono text-xs text-gemini-comment">
            {sync.state.currentSessionId?.slice(0, 8)}
          </span>
        </Show>
        <div class="ml-auto flex items-center gap-2">
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen())}
            class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              rightPanelOpen()
                ? 'bg-gemini-accent text-gemini-background'
                : 'bg-gemini-dark-gray text-gemini-comment hover:text-gemini-foreground'
            }`}
            title="Toggle tools panel"
          >
            ⚙
          </button>
          <SettingsButton />
        </div>
      </header>
      <main class="pt-12 pb-16">{props.children}</main>
    </div>
  );
};

const HomePage: Component = () => {
  return <Home />;
};

const SessionPageWithContext: Component<{ id?: string }> = (props) => {
  const sync = useSync();

  onMount(() => {
    if (props.id) {
      sync.selectSession(props.id);
    }
  });

  return <SessionPage />;
};

export const App: Component = () => {
  return (
    <SettingsProvider>
      <SdkProvider>
        <SyncProvider>
          <Router root={Layout}>
            <Route path="/" component={HomePage} />
            <Route
              path="/session/:id"
              component={(props) => (
                <SessionPageWithContext id={props.params.id} />
              )}
            />
          </Router>
          <SettingsDialog />
        </SyncProvider>
      </SdkProvider>
    </SettingsProvider>
  );
};
