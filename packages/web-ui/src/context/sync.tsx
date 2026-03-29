import {
  type ParentProps,
  createContext,
  useContext,
  onCleanup,
  onMount,
} from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { useSdk } from './sdk.js';
import type { Session, SessionMessage, SessionEvent } from '../lib/sdk-shim.js';

interface SyncState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Record<string, SessionMessage[]>;
  status: Record<string, 'idle' | 'busy'>;
}

interface SyncContextValue {
  state: SyncState;
  loadSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  selectSession: (id: string | null) => void;
  createSession: (
    workspace?: string,
    workspaceName?: string,
  ) => Promise<string>;
  sendPrompt: (sessionId: string, prompt: string) => Promise<void>;
  addMessage: (sessionId: string, message: SessionMessage) => void;
  clearMessages: (sessionId: string) => void;
  subscribeToSession: (sessionId: string) => () => void;
}

interface BroadcastPayload {
  tabId: string;
  type:
    | 'session.created'
    | 'session.updated'
    | 'message.added'
    | 'message.updated'
    | 'session.selected';
  sessionId: string | null;
  data?: Record<string, unknown>;
}

const SyncContext = createContext<SyncContextValue>();

const CHANNEL_NAME = 'gemini-web-sync';

export function SyncProvider(props: ParentProps) {
  const sdk = useSdk();
  const tabId = crypto.randomUUID();
  const channel = new BroadcastChannel(CHANNEL_NAME);

  const [state, setState] = createStore<SyncState>({
    sessions: [],
    currentSessionId: null,
    messages: {},
    status: {},
  });

  const broadcast = (payload: Omit<BroadcastPayload, 'tabId'>) => {
    try {
      channel.postMessage({ ...payload, tabId });
    } catch {
      // Channel error - ignore
    }
  };

  const broadcastSessionCreated = (session: Session) => {
    broadcast({
      type: 'session.created',
      sessionId: session.id,
      data: { session },
    });
  };

  const broadcastSessionUpdated = (
    sessionId: string,
    status: 'idle' | 'busy',
  ) => {
    broadcast({
      type: 'session.updated',
      sessionId,
      data: { status },
    });
  };

  const broadcastMessageAdded = (
    sessionId: string,
    message: SessionMessage,
  ) => {
    broadcast({
      type: 'message.added',
      sessionId,
      data: { message },
    });
  };

  const broadcastSessionSelected = (sessionId: string | null) => {
    broadcast({
      type: 'session.selected',
      sessionId,
    });
  };

  const handleBroadcast = (event: MessageEvent<BroadcastPayload>) => {
    const { tabId: sourceTabId, type, sessionId, data } = event.data;

    // Ignore events from the same tab
    if (sourceTabId === tabId) return;

    switch (type) {
      case 'session.created': {
        const session = data?.session as Session;
        if (session) {
          setState(
            produce((s) => {
              if (!s.sessions.find((existing) => existing.id === session.id)) {
                s.sessions.unshift(session);
                s.status[session.id] = session.status || 'idle';
              }
            }),
          );
        }
        break;
      }
      case 'session.updated': {
        if (sessionId === null) break;
        const { status } = data as { status: 'idle' | 'busy' };
        setState('status', sessionId, status);
        break;
      }
      case 'message.added': {
        if (sessionId === null) break;
        const { message } = data as { message: SessionMessage };
        if (message) {
          setState(
            produce((s) => {
              if (!s.messages[sessionId]) {
                s.messages[sessionId] = [];
              }
              if (!s.messages[sessionId].find((m) => m.id === message.id)) {
                s.messages[sessionId].push(message);
              }
            }),
          );
        }
        break;
      }
      case 'message.updated': {
        if (sessionId === null) break;
        const { message } = data as { message: SessionMessage };
        if (message) {
          setState(
            produce((s) => {
              if (!s.messages[sessionId]) {
                s.messages[sessionId] = [];
              }
              const existingIndex = s.messages[sessionId].findIndex(
                (m) => m.id === message.id,
              );
              if (existingIndex >= 0) {
                s.messages[sessionId][existingIndex] = message;
              } else {
                s.messages[sessionId].push(message);
              }
            }),
          );
        }
        break;
      }
      case 'session.selected': {
        setState('currentSessionId', sessionId);
        break;
      }
    }
  };

  onMount(() => {
    channel.addEventListener('message', handleBroadcast);
  });

  onCleanup(() => {
    channel.removeEventListener('message', handleBroadcast);
    channel.close();
  });

  const loadSessions = async () => {
    const sessions = await sdk.client().listSessions();
    setState('sessions', sessions);
    for (const s of sessions) {
      setState('status', s.id, s.status);
    }
  };

  const loadMessages = async (sessionId: string) => {
    const { messages } = await sdk.client().getMessages(sessionId);
    setState('messages', sessionId, messages);
  };

  const selectSession = (id: string | null) => {
    setState('currentSessionId', id);
    broadcastSessionSelected(id);
  };

  const createSession = async (workspace?: string, workspaceName?: string) => {
    const session = await sdk.client().createSession(workspace, workspaceName);
    setState(
      produce((s) => {
        s.sessions.unshift(session);
        s.status[session.id] = 'idle';
      }),
    );
    broadcastSessionCreated(session);
    return session.id;
  };

  const sendPrompt = async (sessionId: string, prompt: string) => {
    await sdk.client().sendPrompt(sessionId, prompt);
  };

  const addMessage = (sessionId: string, message: SessionMessage) => {
    setState(
      produce((s) => {
        if (!s.messages[sessionId]) {
          s.messages[sessionId] = [];
        }
        s.messages[sessionId].push(message);
      }),
    );
    broadcastMessageAdded(sessionId, message);
  };

  const clearMessages = (sessionId: string) => {
    setState(
      produce((s) => {
        if (s.messages[sessionId]) {
          s.messages[sessionId] = [];
        }
      }),
    );
  };

  const subscribeToSession = (sessionId: string) => {
    const handleEvent = (event: SessionEvent) => {
      if (event.type === 'session.status') {
        const { status } = event.properties as { status: 'idle' | 'busy' };
        setState('status', sessionId, status);
        broadcastSessionUpdated(sessionId, status);
      }
      if (event.type === 'message.added' || event.type === 'message.updated') {
        const { message } = event.properties as { message: SessionMessage };
        setState(
          produce((s) => {
            if (!s.messages[sessionId]) {
              s.messages[sessionId] = [];
            }
            const existingIndex = s.messages[sessionId].findIndex(
              (m) => m.id === message.id,
            );
            if (existingIndex >= 0) {
              s.messages[sessionId][existingIndex] = message;
            } else {
              s.messages[sessionId].push(message);
            }
          }),
        );
        if (event.type === 'message.added') {
          broadcastMessageAdded(sessionId, message);
        }
      }
    };

    return sdk.subscribe(handleEvent);
  };

  return (
    <SyncContext.Provider
      value={{
        state,
        loadSessions,
        loadMessages,
        selectSession,
        createSession,
        sendPrompt,
        addMessage,
        clearMessages,
        subscribeToSession,
      }}
    >
      {props.children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
