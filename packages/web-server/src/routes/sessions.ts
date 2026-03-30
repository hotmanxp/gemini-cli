/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { eventBus } from '../event-bus.js';
import { GeminiCliAgent } from '@google/gemini-cli-sdk';
import {
  GeminiEventType,
  type ServerGeminiStreamEvent,
} from '@google/gemini-cli-core';
import { CommandService } from '../services/CommandService.js';
import { BuiltinCommandLoader } from '../services/BuiltinCommandLoader.js';
import { SkillCommandLoader } from '../services/SkillCommandLoader.js';
import { FileCommandLoader } from '../services/FileCommandLoader.js';
import { McpPromptLoader } from '../services/McpPromptLoader.js';
import type { CommandContext } from '../services/types.js';
import { CommandKind } from '../services/types.js';

const router = express.Router();

interface Session {
  id: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'busy';
  workspace?: string;
  workspaceName?: string;
}

interface Part {
  type: 'text' | 'tool';
  text?: string;
  tool?: string;
  callId?: string;
  state?: {
    status: string;
    input?: Record<string, unknown>;
    output?: string;
    metadata?: Record<string, unknown>;
    time?: { start: number; end: number };
  };
}

interface ToolCallPart {
  type: 'tool';
  tool: string;
  callId?: string;
  state: {
    status: string;
    input?: Record<string, unknown>;
    output?: string;
    metadata?: Record<string, unknown>;
    time?: { start: number; end: number };
  };
}

interface SessionMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  parts: Part[];
  createdAt: number;
}

class StorageManager {
  private sessionsDir: string;
  private sessionsCache: Map<string, Session> = new Map();
  private messagesCache: Map<string, SessionMessage[]> = new Map();
  private initialized = false;

  constructor() {
    this.sessionsDir = path.join(
      os.homedir(),
      '.gemini',
      'web-server',
      'sessions',
    );
  }

  private sessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private messagesFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}-messages.json`);
  }

  async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create sessions directory:', error);
    }
  }

  async loadSessions(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDataDir();

    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(
        (f) => f.endsWith('.json') && !f.includes('-messages'),
      );

      for (const file of sessionFiles) {
        const filePath = path.join(this.sessionsDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(content) as unknown as Session;
          if (session.id && session.slug) {
            this.sessionsCache.set(session.id, session);
          }
        } catch {
          // eslint-disable-next-line no-console
          console.warn(`Skipped corrupted session file: ${file}`);
        }
      }

      this.initialized = true;
    } catch (error) {
      if ((error as unknown as NodeJS.ErrnoException).code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.error('Failed to load sessions:', error);
      }
      this.initialized = true;
    }
  }

  async saveSession(session: Session): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.sessionFilePath(session.id);
    try {
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
      this.sessionsCache.set(session.id, session);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to save session ${session.id}:`, error);
    }
  }

  async loadMessages(sessionId: string): Promise<SessionMessage[]> {
    if (this.messagesCache.has(sessionId)) {
      return this.messagesCache.get(sessionId)!;
    }

    const filePath = this.messagesFilePath(sessionId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const messages = JSON.parse(content) as unknown as SessionMessage[];
      this.messagesCache.set(sessionId, messages);
      return messages;
    } catch (error) {
      if ((error as unknown as NodeJS.ErrnoException).code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.warn(
          `Failed to load messages for session ${sessionId}:`,
          error,
        );
      }
      return [];
    }
  }

  async saveMessages(
    sessionId: string,
    messages: SessionMessage[],
  ): Promise<void> {
    await this.ensureDataDir();
    const filePath = this.messagesFilePath(sessionId);
    try {
      await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8');
      this.messagesCache.set(sessionId, messages);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to save messages for session ${sessionId}:`, error);
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessionsCache.get(sessionId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessionsCache.values());
  }

  setSession(sessionId: string, session: Session): void {
    this.sessionsCache.set(sessionId, session);
  }

  getMessages(sessionId: string): SessionMessage[] | undefined {
    return this.messagesCache.get(sessionId);
  }

  setMessages(sessionId: string, messages: SessionMessage[]): void {
    this.messagesCache.set(sessionId, messages);
  }
}

const storageManager = new StorageManager();

storageManager.loadSessions().catch(console.error); // eslint-disable-line no-console

let commandService: CommandService | null = null;

async function getCommandService(): Promise<CommandService> {
  if (!commandService) {
    const loaders = [
      new BuiltinCommandLoader(),
      new SkillCommandLoader(),
      new FileCommandLoader(),
      new McpPromptLoader(),
    ];
    commandService = await CommandService.create(
      loaders,
      new AbortController().signal,
    );
  }
  return commandService;
}

const agentCache = new Map<string, GeminiCliAgent>();

function getAgent(cwd?: string): GeminiCliAgent {
  const key = cwd || 'default';
  if (!agentCache.has(key)) {
    process.env['USE_QWEN_OAUTH'] = 'true';
    const agent = new GeminiCliAgent({
      instructions: 'You are a helpful AI assistant.',
      cwd: cwd,
    });
    agentCache.set(key, agent);
  }
  return agentCache.get(key)!;
}

async function loadMessagesFromSdkStorage(
  sessionId: string,
  cwd?: string,
): Promise<SessionMessage[]> {
  const { Storage } = await import('@google/gemini-cli-core');
  const storage = new Storage(cwd || process.cwd());
  await storage.initialize();

  const files = await storage.listProjectChatFiles();
  const truncatedId = sessionId.slice(0, 8);
  const candidates = files.filter((f) => f.filePath.includes(truncatedId));

  for (const file of candidates) {
    const loaded = await storage.loadProjectTempFile<{
      sessionId: string;
      messages: Array<{
        id: string;
        timestamp: string;
        content: unknown;
        type: string;
        toolCalls?: Array<{
          id: string;
          name: string;
          args: Record<string, unknown>;
          result?: unknown;
          status: string;
          timestamp: string;
        }>;
      }>;
    }>(file.filePath);
    if (loaded && loaded.sessionId === sessionId) {
      return loaded.messages.map((m) => {
        const role = m.type === 'gemini' ? 'assistant' : 'user';
        const parts: Part[] = [];

        if (Array.isArray(m.content)) {
          const textParts = (m.content as Array<{ text?: string }>).map(
            (c) => ({
              type: 'text' as const,
              text: c.text || '',
            }),
          );
          parts.push(...textParts);
        } else if (m.content) {
          parts.push({ type: 'text', text: String(m.content) });
        }

        if (m.toolCalls && m.type === 'gemini') {
          for (const tc of m.toolCalls) {
            let output: string | undefined;
            if (tc.result) {
              if (typeof tc.result === 'string') {
                output = tc.result;
              } else if (typeof tc.result === 'object') {
                output = JSON.stringify(tc.result);
              }
            }
            parts.push({
              type: 'tool',
              tool: tc.name,
              callId: tc.id,
              state: {
                status: tc.status,
                input: tc.args,
                output,
                time: {
                  start: new Date(tc.timestamp).getTime(),
                  end: Date.now(),
                },
              },
            });
          }
        }

        return {
          id: m.id,
          sessionID: sessionId,
          role: role as 'user' | 'assistant',
          parts,
          createdAt: new Date(m.timestamp).getTime(),
        };
      });
    }
  }
  return [];
}

async function getSessionPreview(
  sessionId: string,
  cwd?: string,
): Promise<string> {
  const messages = await loadMessagesFromSdkStorage(sessionId, cwd);
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) return 'New conversation';

  const textPart = firstUserMessage.parts.find((p) => p.type === 'text');
  if (!textPart || !textPart.text) return 'New conversation';

  const MAX_LENGTH = 50;
  if (textPart.text.length <= MAX_LENGTH) return textPart.text;
  return textPart.text.slice(0, MAX_LENGTH) + '...';
}

router.get('/', async (_req: Request, res: Response) => {
  const sessions = storageManager.getAllSessions();
  const sessionList = await Promise.all(
    sessions.map(async (s) => ({
      id: s.id,
      slug: s.slug,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      status: s.status,
      workspace: s.workspace,
      workspaceName: s.workspaceName,
      preview: await getSessionPreview(s.id, s.workspace),
    })),
  );
  res.json(sessionList);
});

router.get('/grouped', async (_req: Request, res: Response) => {
  const sessions = storageManager.getAllSessions();
  const grouped: Record<
    string,
    {
      workspace: string;
      name: string;
      sessions: Array<Session & { preview: string }>;
    }
  > = {};

  for (const s of sessions) {
    const ws = s.workspace || 'default';
    if (!grouped[ws]) {
      grouped[ws] = {
        workspace: ws,
        name: s.workspaceName || 'Default Workspace',
        sessions: [],
      };
    }
    grouped[ws].sessions.push({
      ...s,
      preview: await getSessionPreview(s.id, s.workspace),
    });
  }

  res.json(Object.values(grouped));
});

router.post('/', async (_req: Request, res: Response) => {
  const id = randomUUID();
  const slug = `session-${id.slice(0, 8)}`;
  const now = Date.now();
  const { workspace, workspaceName } =
    (_req.body as unknown as { workspace?: string; workspaceName?: string }) ||
    {};

  const session: Session = {
    id,
    slug,
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    workspace: workspace || process.cwd(),
    workspaceName: workspaceName || path.basename(process.cwd()) || 'Local',
  };

  storageManager.setSession(id, session);
  await storageManager.saveSession(session);

  res.status(201).json({
    id,
    slug,
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    workspace: session.workspace,
    workspaceName: session.workspaceName,
  });
});

router.get('/commands', async (_req: Request, res: Response) => {
  const service = await getCommandService();
  const commands = service.getCommands();

  const builtinCommands = commands
    .filter((cmd) => cmd.kind === CommandKind.BUILT_IN && !cmd.hidden)
    .map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      kind: 'builtin' as const,
    }));

  res.json({ commands: builtinCommands });
});

router.post('/commands/execute', async (req: Request, res: Response) => {
  const { command, args } = req.body as unknown as {
    command?: string;
    args?: string;
  };

  if (!command || typeof command !== 'string') {
    res.status(400).json({ error: 'Missing or invalid command' });
    return;
  }

  const service = await getCommandService();
  const commands = service.getCommands();
  const matchedCommand = commands.find(
    (c) => c.name === command || c.altNames?.includes(command),
  );

  if (!matchedCommand) {
    res.status(404).json({ error: `Command not found: ${command}` });
    return;
  }

  if (!matchedCommand.action) {
    res.status(400).json({ error: `Command has no action: ${command}` });
    return;
  }

  const context: CommandContext = {
    invocation: {
      raw: `/${command} ${args || ''}`.trim(),
      name: matchedCommand.name,
      args: args || '',
    },
    services: {
      agentContext: null,
      settings: {},
      git: undefined,
      logger: console,
    },
    ui: {
      addItem: (item: unknown) => {
        eventBus.publish({
          type: 'command.item',
          properties: { item },
          timestamp: Date.now(),
        });
      },
      clear: () => {
        eventBus.publish({
          type: 'command.clear',
          properties: {},
          timestamp: Date.now(),
        });
      },
      setDebugMessage: () => {},
      pendingItem: null,
      setPendingItem: () => {},
      loadHistory: () => {},
      toggleCorgiMode: () => {},
      toggleDebugProfiler: () => {},
      toggleVimEnabled: async () => false,
      reloadCommands: () => {},
      openAgentConfigDialog: () => {},
      extensionsUpdateState: new Map(),
      dispatchExtensionStateUpdate: () => {},
      addConfirmUpdateExtensionRequest: () => {},
      setConfirmationRequest: () => {},
      removeComponent: () => {},
      toggleBackgroundShell: () => {},
      toggleShortcutsHelp: () => {},
    },
    session: {
      stats: {},
      sessionShellAllowlist: new Set(),
    },
  };

  try {
    const result = await matchedCommand.action(context, args || '');
    res.json({ result });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

router.get('/files', async (req: Request, res: Response) => {
  const query = (req.query['q'] as unknown as string) || '';
  const baseDir = (req.query['cwd'] as unknown as string) || process.cwd();

  if (!query || query.length < 2) {
    res.json({ files: [] });
    return;
  }

  try {
    const results: string[] = [];
    const searchPattern = query.toLowerCase();

    async function search(dir: string, depth: number = 0) {
      if (depth > 3 || results.length >= 20) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= 20) break;
          if (entry.name.startsWith('.')) continue;

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await search(fullPath, depth + 1);
          } else if (entry.name.toLowerCase().includes(searchPattern)) {
            results.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors during file search
      }
    }

    await search(baseDir);
    res.json({ files: results.slice(0, 20) });
  } catch {
    res.json({ files: [] });
  }
});

router.get('/directories', async (req: Request, res: Response) => {
  const dir = (req.query.path as string) || os.homedir();
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const directories = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ directories, parent: path.dirname(dir), homeDir: os.homedir() });
  } catch {
    res.json({ directories: [], parent: null, homeDir: os.homedir() });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  const session = storageManager.getSession(req.params['id']);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

router.get('/:id/messages', async (req: Request, res: Response) => {
  const session = storageManager.getSession(req.params['id']);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const messages = await loadMessagesFromSdkStorage(
    req.params['id'],
    session.workspace,
  );
  res.json({ messages });
});

router.post('/:id/prompt', async (req: Request, res: Response) => {
  const session = storageManager.getSession(req.params['id']);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const { prompt } = req.body as unknown as { prompt?: string };
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing or invalid prompt' });
    return;
  }

  session.status = 'busy';
  session.updatedAt = Date.now();
  await storageManager.saveSession(session);

  eventBus.publish({
    type: 'session.status',
    properties: { sessionId: session.id, status: 'busy' },
    timestamp: Date.now(),
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (eventType: string, data: unknown) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const userMessage: SessionMessage = {
    id: randomUUID(),
    sessionID: session.id,
    role: 'user',
    parts: [{ type: 'text', text: prompt }],
    createdAt: Date.now(),
  };

  const messages = await storageManager.loadMessages(session.id);
  messages.push(userMessage);

  eventBus.publish({
    type: 'message.added',
    properties: { sessionId: session.id, message: userMessage },
    timestamp: Date.now(),
  });

  sendEvent('message.added', { message: userMessage });

  const assistantMessageId = randomUUID();
  const assistantParts: Part[] = [];

  try {
    const geminiAgent = getAgent(session.workspace);
    let geminiSession;
    try {
      geminiSession = await geminiAgent.resumeSession(session.id);
    } catch {
      geminiSession = geminiAgent.session({
        sessionId: session.id,
        cwd: session.workspace || undefined,
      });
    }

    const stream = geminiSession.sendStream(prompt);

    for await (const event of stream) {
      const result = convertSdkEventToMessage(
        event,
        assistantMessageId,
        session.id,
        assistantParts,
      );
      if (result) {
        sendEvent(result.type, result.data);
        if (result.type === 'message.added' && 'message' in result.data) {
          eventBus.publish({
            type: 'message.added',
            properties: { sessionId: session.id, message: result.data.message },
            timestamp: Date.now(),
          });
        }
      }
    }

    const assistantMessage: SessionMessage = {
      id: assistantMessageId,
      sessionID: session.id,
      role: 'assistant',
      parts: assistantParts,
      createdAt: Date.now(),
    };
    messages.push(assistantMessage);

    sendEvent('message.added', { message: assistantMessage });
    eventBus.publish({
      type: 'message.added',
      properties: { sessionId: session.id, message: assistantMessage },
      timestamp: Date.now(),
    });

    session.status = 'idle';
    session.updatedAt = Date.now();
    await storageManager.saveSession(session);

    sendEvent('session.status', { sessionId: session.id, status: 'idle' });
    eventBus.publish({
      type: 'session.status',
      properties: { sessionId: session.id, status: 'idle' },
      timestamp: Date.now(),
    });

    res.end();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('SDK error:', error);
    session.status = 'idle';
    session.updatedAt = Date.now();
    await storageManager.saveSession(session);

    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    res.end(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`);
  }

  req.on('close', () => {
    if (session.status === 'busy') {
      session.status = 'idle';
      session.updatedAt = Date.now();
      storageManager.saveSession(session).catch(console.error); // eslint-disable-line no-console
      eventBus.publish({
        type: 'session.status',
        properties: { sessionId: session.id, status: 'idle' },
        timestamp: Date.now(),
      });
    }
  });
});

function convertSdkEventToMessage(
  event: ServerGeminiStreamEvent,
  messageId: string,
  sessionId: string,
  parts: Part[],
): {
  type: string;
  data: { message: SessionMessage } | { error: string };
} | null {
  switch (event.type) {
    case GeminiEventType.Content: {
      const text = event.value;
      if (
        text &&
        !text.startsWith('{') &&
        !text.startsWith('[') &&
        text.length < 1000
      ) {
        parts.push({ type: 'text', text });
        return {
          type: 'message.added',
          data: {
            message: {
              id: messageId,
              sessionID: sessionId,
              role: 'assistant',
              parts: [...parts],
              createdAt: Date.now(),
            },
          },
        };
      }
      return null;
    }
    case GeminiEventType.ToolCallRequest: {
      const toolCall = event.value as {
        name: string;
        args: Record<string, unknown>;
        callId?: string;
      };
      const toolPart: ToolCallPart = {
        type: 'tool',
        tool: toolCall.name,
        callId: toolCall.callId,
        state: {
          status: 'running',
          input: toolCall.args,
        },
      };
      parts.push(toolPart as unknown as Part);
      return {
        type: 'message.added',
        data: {
          message: {
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [...parts],
            createdAt: Date.now(),
          },
        },
      };
    }
    case GeminiEventType.ToolCallResponse: {
      const response = event.value as {
        callId?: string;
        output?: string;
        error?: string;
      };
      let toolPartIndex = -1;

      if (response.callId) {
        toolPartIndex = parts.findIndex(
          (p) => p.type === 'tool' && p.callId === response.callId,
        );
      }

      if (toolPartIndex < 0) {
        toolPartIndex = parts.findIndex(
          (p) => p.type === 'tool' && p.state?.status === 'running',
        );
      }

      if (toolPartIndex >= 0) {
        const toolPart = parts[toolPartIndex];
        toolPart.state = {
          status: response.error ? 'error' : 'completed',
          input: toolPart.state?.input,
          output: response.output,
          time: { start: Date.now(), end: Date.now() },
        };
        if (response.error) {
          toolPart.state.metadata = { error: response.error };
        }
      }
      return {
        type: 'message.updated',
        data: {
          message: {
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [...parts],
            createdAt: Date.now(),
          },
        },
      };
    }
    case GeminiEventType.Thought: {
      return null;
    }
    case GeminiEventType.Finished:
      return null;
    case GeminiEventType.Error:
      return {
        type: 'error',
        data: { error: String(event.value) },
      };
    default:
      return null;
  }
}

router.get('/:id/status', (req: Request, res: Response) => {
  const session = storageManager.getSession(req.params['id']);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ status: session.status });
});

router.post('/:id/abort', (req: Request, res: Response) => {
  const session = storageManager.getSession(req.params['id']);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
