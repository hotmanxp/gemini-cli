/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  type Component,
  createSignal,
  createEffect,
  on,
  For,
  Show,
  onMount,
  onCleanup,
  Switch,
  Match,
  createMemo,
} from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useSync } from '../context/sync.js';
import { useSdk } from '../context/sdk.js';
import { useSettings } from '../context/settings.js';
import { leftSidebarOpen, rightPanelOpen } from '../app.js';
import { Markdown } from '../components/markdown.js';
import { MessageNav } from '../components/MessageNav.js';
import type { TokenUsage, CostInfo } from '../lib/sdk-shim.js';
import {
  ReadTool,
  WriteTool,
  EditTool,
  BashTool,
  GrepTool,
  GlobTool,
  LsTool,
  TrackerTool,
  type ToolPart,
} from '../components/tools/index.js';

interface Command {
  name: string;
  description: string;
  kind: 'builtin' | 'skill' | 'mcp';
}

interface Suggestion {
  label: string;
  value: string;
  description?: string;
  type: 'command' | 'file';
}

export const Session: Component = () => {
  const sync = useSync();
  const sdk = useSdk();
  const settings = useSettings();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [mode, setMode] = createSignal<'slash' | 'at' | null>(null);
  const [currentMsgIndex, setCurrentMsgIndex] = createSignal(0);
  const [groupedSessions, setGroupedSessions] = createSignal<
    Array<{
      workspace: string;
      name: string;
      sessions: Array<{
        id: string;
        slug: string;
        status: 'idle' | 'busy';
        preview?: string;
      }>;
    }>
  >([]);
  const [expandedWorkspaces, setExpandedWorkspaces] = createSignal<Set<string>>(
    new Set(),
  );
  const [commands, setCommands] = createSignal<Command[]>([]);
  const [suggestions, setSuggestions] = createSignal<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [prompt, setPrompt] = createSignal('');
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);
  let textareaRef: HTMLTextAreaElement | undefined;
  let messagesContainerRef: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    if (messagesContainerRef) {
      messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
    }
  };

  onMount(async () => {
    const sessionId = params.id;
    if (sessionId) {
      sync.selectSession(sessionId);
      await sync.loadMessages(sessionId);
      setTimeout(scrollToBottom, 100);
      const unsub = sync.subscribeToSession(sessionId);
      onCleanup(unsub);
    }
    await loadCommands();
    await loadGroupedSessions(params.id);
  });

  let observer: MutationObserver | undefined;
  onMount(() => {
    if (messagesContainerRef) {
      observer = new MutationObserver(() => {
        scrollToBottom();
      });
      observer.observe(messagesContainerRef, {
        childList: true,
        subtree: true,
      });
    }
  });
  onCleanup(() => observer?.disconnect());

  createEffect(() => {
    const sessionId = params.id;
    if (sessionId) {
      sync.selectSession(sessionId);
      sync.loadMessages(sessionId);
      const unsub = sync.subscribeToSession(sessionId);
      onCleanup(unsub);
    }
  });

  const loadGroupedSessions = async (currentSessionId?: string) => {
    try {
      const data = await sdk.client().getGroupedSessions();
      setGroupedSessions(data);
      if (data.length > 0) {
        if (currentSessionId) {
          const targetWorkspace = data.find((g) =>
            g.sessions.some((s) => s.id === currentSessionId),
          );
          if (targetWorkspace) {
            setExpandedWorkspaces(new Set([targetWorkspace.workspace]));
            return;
          }
        }
        setExpandedWorkspaces(new Set([data[0].workspace]));
      }
    } catch (e) {
      console.error('Failed to load grouped sessions:', e);
    }
  };

  const toggleWorkspace = (workspace: string) => {
    const current = new Set(expandedWorkspaces());
    if (current.has(workspace)) {
      current.delete(workspace);
    } else {
      current.add(workspace);
    }
    setExpandedWorkspaces(current);
  };

  const handleSelectSession = (id: string) => {
    sync.selectSession(id);
    navigate(`/session/${id}`);
  };

  const handleDeleteSession = async (id: string) => {
    await sync.deleteSession(id);
    setDeleteConfirm(null);
    if (sync.state.currentSessionId === id) {
      navigate('/');
    } else {
      await loadGroupedSessions();
    }
  };

  const handleNewSession = () => {
    navigate('/');
  };

  const loadCommands = async () => {
    try {
      const data = await sdk.client().getCommands();
      setCommands(data.commands as Command[]);
    } catch (e) {
      console.error('Failed to load commands:', e);
    }
  };

  const getSlashSuggestions = (query: string) => {
    const filtered = commands()
      .filter((cmd) => cmd.name.toLowerCase().startsWith(query.toLowerCase()))
      .map((cmd) => ({
        label: `/${cmd.name}`,
        value: `/${cmd.name}`,
        description: cmd.description,
        type: 'command' as const,
      }));
    return filtered.slice(0, 20);
  };

  const getAtSuggestions = async (query: string): Promise<Suggestion[]> => {
    if (query.length < 2) return [];
    try {
      const files = await sdk.client().searchFiles(query);
      return (files || [])
        .map((f: string) => ({
          label: `@${f.split('/').pop() || f}`,
          value: `@${f}`,
          description: f,
          type: 'file' as const,
        }))
        .slice(0, 6);
    } catch {
      return [];
    }
  };

  const updateSuggestions = async () => {
    const text = prompt();
    const cursorPos = textareaRef?.selectionStart ?? text.length;

    let triggerChar = -1;
    let triggerType: 'slash' | 'at' | null = null;

    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '/') {
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          triggerChar = i;
          triggerType = 'slash';
          break;
        }
      }
      if (text[i] === '@') {
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          triggerChar = i;
          triggerType = 'at';
          break;
        }
      }
    }

    if (triggerChar === -1 || triggerType === null) {
      setMode(null);
      setSuggestions([]);
      return;
    }

    const query = text.slice(triggerChar + 1, cursorPos);

    if (triggerType === 'slash') {
      const filtered = getSlashSuggestions(query);
      setMode('slash');
      setSuggestions(filtered);
      setSelectedIndex(0);
    } else if (triggerType === 'at') {
      setMode('at');
      const files = await getAtSuggestions(query);
      setSuggestions(files);
      setSelectedIndex(0);
    }
  };

  const handleInput = async (e: InputEvent) => {
    const target = e.target as HTMLTextAreaElement;
    setPrompt(target.value);
    await updateSuggestions();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const suggs = suggestions();

    if (mode() && suggs.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggs.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(selectedIndex());
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode(null);
        setSuggestions([]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertSuggestion = async (index: number) => {
    const sugg = suggestions()[index];
    if (!sugg) return;

    if (sugg.type === 'command') {
      const commandName = sugg.value.replace(/^\//, '');
      setPrompt('');
      setMode(null);
      setSuggestions([]);
      await executeCommand(commandName);
      return;
    }

    const text = prompt();
    const cursorPos = textareaRef?.selectionStart ?? text.length;

    let triggerPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '/' || text[i] === '@') {
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          triggerPos = i;
          break;
        }
      }
    }

    if (triggerPos === -1) return;

    const before = text.slice(0, triggerPos);
    const after = text.slice(cursorPos);
    const newText = before + sugg.value + ' ' + after;

    setPrompt(newText);
    setMode(null);
    setSuggestions([]);

    setTimeout(() => {
      if (textareaRef) {
        const newPos = triggerPos + sugg.value.length + 1;
        textareaRef.selectionStart = newPos;
        textareaRef.selectionEnd = newPos;
        textareaRef.focus();
      }
    }, 0);
  };

  const executeCommand = async (command: string, args?: string) => {
    try {
      const result = await sdk.client().executeCommand(command, args);

      if (result.type === 'message' && result.content) {
        const content = result.content;

        if (content === '__CLEAR_CHAT__') {
          const sessionId = sync.state.currentSessionId;
          if (sessionId) {
            sync.clearMessages(sessionId);
          }
          return;
        }

        if (content === '__OPEN_SETTINGS__') {
          settings.openSettings();
          return;
        }

        if (content === '__NEW_SESSION__') {
          const newSessionId = await sync.createSession();
          sync.selectSession(newSessionId);
          return;
        }

        if (content === '__COMPRESS_CONTEXT__') {
          const sessionId = sync.state.currentSessionId;
          if (sessionId) {
            await sync.sendPrompt(sessionId, '/compress');
          }
          return;
        }

        const sessionId = sync.state.currentSessionId;
        if (sessionId) {
          sync.addMessage(sessionId, {
            id: crypto.randomUUID(),
            sessionID: sessionId,
            role: 'assistant',
            parts: [{ type: 'text' as const, text: content }],
            createdAt: Date.now(),
          });
        }
      } else if (result.type === 'submit_prompt' && result.content) {
        const sessionId = sync.state.currentSessionId;
        if (sessionId) {
          await sync.sendPrompt(sessionId, result.content);
        }
      }
    } catch (e) {
      console.error('Failed to execute command:', e);
    }
  };

  const handleSend = async () => {
    if (mode()) {
      setMode(null);
      setSuggestions([]);
    }
    const sessionId = sync.state.currentSessionId;
    if (!sessionId || !prompt().trim()) return;
    const currentPrompt = prompt();
    await sync.sendPrompt(sessionId, currentPrompt);
    setPrompt('');

    const newPreview =
      currentPrompt.length > 50
        ? currentPrompt.slice(0, 50) + '...'
        : currentPrompt;
    setGroupedSessions((prev) =>
      prev.map((group) => ({
        ...group,
        sessions: group.sessions.map((s) =>
          s.id === sessionId ? { ...s, preview: newPreview } : s,
        ),
      })),
    );
  };

  const messages = () => {
    const id = params.id || sync.state.currentSessionId;
    return id ? sync.state.messages[id] || [] : [];
  };

  const userMessageIndices = createMemo(() => {
    const msgs = messages();
    const indices: number[] = [];
    msgs.forEach((msg, i) => {
      if (msg.role === 'user') {
        indices.push(i);
      }
    });
    return indices;
  });

  const hasMultipleUserMessages = createMemo(
    () => userMessageIndices().length > 1,
  );

  const handleMessageSelect = (index: number) => {
    setCurrentMsgIndex(index);
    const element = document.getElementById(`message-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getMessageText = (msg: {
    parts: Array<{ type: string; text?: string }>;
  }) =>
    msg.parts
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text)
      .join('');

  const sessionStats = createMemo(() => {
    const msgs = messages();
    const stats: { tokens: TokenUsage | null; cost: CostInfo | null } = {
      tokens: null,
      cost: null,
    };
    let totalInput = 0;
    let totalOutput = 0;
    let totalThoughts = 0;
    let totalCost = 0;

    for (const msg of msgs) {
      if (msg.role === 'assistant') {
        if (msg.tokens) {
          totalInput += msg.tokens.input || 0;
          totalOutput += msg.tokens.output || 0;
          totalThoughts += msg.tokens.thoughts || 0;
        }
        if (msg.cost) {
          totalCost += msg.cost.amount || 0;
        }
      }
    }

    if (totalInput > 0 || totalOutput > 0) {
      stats.tokens = {
        input: totalInput,
        output: totalOutput,
        thoughts: totalThoughts,
        total: totalInput + totalOutput,
      };
    }
    if (totalCost > 0) {
      stats.cost = { amount: totalCost };
    }
    return stats;
  });

  return (
    <div className="flex h-screen bg-gemini-background text-gemini-foreground text-sm overflow-hidden">
      <div
        className={`fixed left-0 top-12 bottom-16 bg-gemini-msg-bg border-r border-gemini-dark-gray transition-all duration-200 z-10 overflow-hidden ${
          leftSidebarOpen() ? 'w-60' : 'w-0'
        }`}
      >
        <div className="w-60 h-full flex flex-col">
          <div className="p-2 border-b border-gemini-dark-gray flex items-center justify-between">
            <span className="text-xs font-medium text-gemini-comment px-2">
              Sessions
            </span>
            <button
              onClick={handleNewSession}
              className="px-2 py-0.5 bg-gemini-accent hover:bg-gemini-accent rounded text-xs font-medium text-gemini-background cursor-pointer"
            >
              +
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <For each={groupedSessions()}>
              {(group) => (
                <div className="border-b border-gemini-dark-gray">
                  <div className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-gemini-gray hover:bg-gemini-dark-gray transition-colors">
                    <span
                      onClick={() => toggleWorkspace(group.workspace)}
                      className="cursor-pointer"
                    >
                      {expandedWorkspaces().has(group.workspace) ? '▼' : '▶'}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {group.name}
                    </span>
                    <span className="text-gemini-dark-gray text-xs">
                      {group.sessions.length}
                    </span>
                    <Show when={expandedWorkspaces().has(group.workspace)}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const id = await sync.createSession(
                            group.workspace,
                            group.name,
                          );
                          await loadGroupedSessions(id);
                          navigate(`/session/${id}`);
                        }}
                        className="px-1.5 py-0.5 bg-gemini-accent hover:bg-gemini-accent rounded text-xs font-medium text-gemini-background"
                      >
                        +
                      </button>
                    </Show>
                  </div>
                  <Show when={expandedWorkspaces().has(group.workspace)}>
                    <div className="bg-gemini-background/50">
                      <For each={group.sessions}>
                        {(session) => (
                          <div
                            className={`w-full px-4 py-1.5 text-left text-xs flex items-center gap-2 transition-colors group ${
                              sync.state.currentSessionId === session.id
                                ? 'bg-gemini-accent text-gemini-background'
                                : 'hover:bg-gemini-dark-gray text-gemini-comment'
                            }`}
                          >
                            <span
                              onClick={() => handleSelectSession(session.id)}
                              className="flex items-center gap-2 flex-1 cursor-pointer"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  session.status === 'busy'
                                    ? 'bg-gemini-accent-yellow'
                                    : 'bg-gemini-accent-green'
                                }`}
                              />
                              <span className="truncate font-mono">
                                {session.preview || session.slug}
                              </span>
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(session.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 px-1 py-0.5 hover:bg-red-500/50 rounded text-xs text-red-400 cursor-pointer"
                            >
                              x
                            </button>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col transition-all duration-200 pt-12 pb-16 ${
          leftSidebarOpen() ? 'ml-60' : 'ml-0'
        } ${rightPanelOpen() ? 'mr-60' : 'mr-0'}`}
      >
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          <For each={messages()}>
            {(msg, index) => (
              <div
                id={`message-${index()}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-gemini-accent text-gemini-background'
                      : 'bg-gemini-msg-bg text-gemini-foreground'
                  }`}
                >
                  <Switch>
                    <Match when={msg.role === 'user'}>
                      <p className="whitespace-pre-wrap">
                        {getMessageText(msg)}
                      </p>
                    </Match>
                    <Match when={msg.role === 'assistant'}>
                      <div className="space-y-2">
                        <For each={msg.parts.filter((p) => p.type === 'tool')}>
                          {(part) => (
                            <div className="pt-2 border-t border-gemini-dark-gray">
                              <Switch>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                      'read' ||
                                    (part as unknown as ToolPart).tool ===
                                      'read_file'
                                  }
                                >
                                  <ReadTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                      'write' ||
                                    (part as unknown as ToolPart).tool ===
                                      'write_file'
                                  }
                                >
                                  <WriteTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                      'edit' ||
                                    (part as unknown as ToolPart).tool ===
                                      'replace'
                                  }
                                >
                                  <EditTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                      'bash' ||
                                    (part as unknown as ToolPart).tool ===
                                      'run_shell_command'
                                  }
                                >
                                  <BashTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                      'grep' ||
                                    (part as unknown as ToolPart).tool ===
                                      'grep_search'
                                  }
                                >
                                  <GrepTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={(
                                    part as unknown as ToolPart
                                  ).tool?.startsWith('tracker_')}
                                >
                                  <TrackerTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                    'glob'
                                  }
                                >
                                  <GlobTool
                                    part={part as unknown as ToolPart}
                                  />
                                </Match>
                                <Match
                                  when={
                                    (part as unknown as ToolPart).tool ===
                                    'list_directory'
                                  }
                                >
                                  <LsTool part={part as unknown as ToolPart} />
                                </Match>
                                <Match when={true}>
                                  <div className="text-xs">
                                    <div className="flex items-center gap-2 text-gemini-accent font-medium">
                                      <span>
                                        {(part as unknown as ToolPart).tool}
                                      </span>
                                    </div>
                                    <Show
                                      when={
                                        (part as unknown as ToolPart).state
                                          ?.input
                                      }
                                    >
                                      <pre className="text-gemini-comment font-mono mt-1 bg-gemini-background rounded p-2 overflow-x-auto">
                                        {JSON.stringify(
                                          (part as unknown as ToolPart).state
                                            ?.input,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </Show>
                                    <Show
                                      when={
                                        (part as unknown as ToolPart).state
                                          ?.output
                                      }
                                    >
                                      <pre className="text-gemini-gray font-mono mt-1 bg-gemini-background rounded p-2 overflow-x-auto">
                                        {
                                          (part as unknown as ToolPart).state
                                            ?.output
                                        }
                                      </pre>
                                    </Show>
                                    <Show
                                      when={
                                        (part as unknown as ToolPart).state
                                          ?.status
                                      }
                                    >
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                                          (part as unknown as ToolPart).state
                                            ?.status === 'completed'
                                            ? 'bg-green-900/50 text-green-400'
                                            : (part as unknown as ToolPart)
                                                  .state?.status === 'error'
                                              ? 'bg-red-900/50 text-red-400'
                                              : 'bg-gemini-dark-gray text-gemini-comment'
                                        }`}
                                      >
                                        {
                                          (part as unknown as ToolPart).state
                                            ?.status
                                        }
                                      </span>
                                    </Show>
                                  </div>
                                </Match>
                              </Switch>
                            </div>
                          )}
                        </For>
                        <Show when={getMessageText(msg)} fallback={null}>
                          <Markdown content={getMessageText(msg)} />
                        </Show>
                      </div>
                    </Match>
                  </Switch>
                </div>
              </div>
            )}
          </For>
        </div>
        <div className="fixed bottom-0 left-0 right-0 px-4 py-2 bg-gemini-msg-bg border-t border-gemini-dark-gray z-20">
          <div className="flex gap-2 max-w-3xl mx-auto items-center">
            <Show
              when={
                sync.state.status[sync.state.currentSessionId || ''] === 'busy'
              }
            >
              <div className="flex items-center gap-1 px-2 py-2 text-xs text-gemini-accent">
                <span className="animate-pulse">●</span>
                <span>AI</span>
              </div>
            </Show>
            <textarea
              ref={textareaRef}
              value={prompt()}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="/ for commands, @ for files"
              className="flex-1 px-3 py-2 bg-gemini-background border border-gemini-dark-gray rounded-lg text-gemini-foreground placeholder-gemini-comment resize-none focus:outline-none focus:ring-1 focus:ring-gemini-accent focus:border-transparent text-sm"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={
                sync.state.status[sync.state.currentSessionId || ''] === 'busy'
              }
              className="px-4 py-2 bg-gemini-accent hover:bg-gemini-accent disabled:bg-gemini-dark-gray disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-gemini-background text-sm"
            >
              Send
            </button>
          </div>

          <Show when={suggestions().length > 0 && mode()}>
            <div className="max-w-3xl mx-auto mt-2">
              <div className="bg-gemini-msg-bg border border-gemini-dark-gray rounded-lg shadow-lg overflow-y-auto max-h-60">
                <For each={suggestions()}>
                  {(suggestion, index) => (
                    <div
                      className={`px-3 py-1.5 cursor-pointer flex items-center justify-between text-xs ${
                        index() === selectedIndex()
                          ? 'bg-gemini-accent text-gemini-background'
                          : 'hover:bg-gemini-dark-gray'
                      }`}
                      onClick={() => insertSuggestion(index())}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{suggestion.label}</span>
                        <Show when={suggestion.description}>
                          <span className="text-gemini-comment">
                            {suggestion.description}
                          </span>
                        </Show>
                      </div>
                      <Show when={suggestion.type === 'file'}>
                        <span className="text-gemini-comment truncate max-w-xs">
                          {suggestion.description}
                        </span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </div>

      <div
        className={`fixed right-0 top-12 bottom-16 bg-gemini-msg-bg border-l border-gemini-dark-gray transition-all duration-200 z-10 overflow-hidden ${
          rightPanelOpen() ? 'w-60' : 'w-0'
        }`}
      >
        <div className="w-60 h-full flex flex-col p-3 space-y-3">
          <div>
            <h3 className="text-xs font-medium text-gemini-comment mb-2">
              Tools
            </h3>
            <div className="space-y-1">
              <For each={messages()}>
                {(msg) =>
                  msg.parts
                    .filter((p) => p.type === 'tool')
                    .map((part) => (
                      <div className="text-xs text-gemini-foreground flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-gemini-accent" />
                        {(part as unknown as ToolPart).tool}
                      </div>
                    ))
                }
              </For>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium text-gemini-comment mb-2">
              Info
            </h3>
            <div className="text-xs text-gemini-dark-gray">
              <p>Session: {sync.state.currentSessionId?.slice(0, 8)}</p>
            </div>
          </div>
        </div>
      </div>

      <Show when={deleteConfirm()}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gemini-msg-bg border border-gemini-dark-gray rounded-lg p-4 max-w-sm">
            <p className="text-sm text-gemini-foreground mb-4">
              Delete this session?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded bg-gemini-dark-gray hover:bg-gemini-gray text-gemini-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(deleteConfirm()!)}
                className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export const SessionPage = Session;
