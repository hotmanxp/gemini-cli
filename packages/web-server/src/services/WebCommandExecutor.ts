import type { CommandContext, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import type {
  CommandActionReturn,
  MessageActionReturn,
} from '@google/gemini-cli-core';

function createMessageAction(
  content: string,
  messageType: 'info' | 'error' = 'info',
): MessageActionReturn {
  return {
    type: 'message',
    messageType,
    content,
  };
}

function createSubmitPromptAction(content: string): CommandActionReturn {
  return {
    type: 'submit_prompt',
    content,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const webCommandActions: Record<string, any> = {
  help: () => {
    return createMessageAction(`## Gemini CLI Commands

### Session Management
- \`/new\` - Start a new chat session
- \`/clear\` - Clear the current chat conversation
- \`/resume\` - Resume a previous chat session
- \`/chat\` - Manage chat sessions
- \`/restore\` - Restore files to state before tool execution

### Configuration
- \`/settings\` - Open settings panel
- \`/model\` - Show or change the current model
- \`/theme\` - Change color theme
- \`/profile\` - Manage profiles

### Information
- \`/help\` - Show this help message
- \`/stats\` - Show token and cost statistics
- \`/about\` - Show information about Gemini CLI
- \`/privacy\` - Show privacy information
- \`/policies\` - Show policy information
- \`/docs\` - Open documentation

### Tools & Extensions
- \`/tools\` - Manage available tools
- \`/skills\` - Manage agent skills
- \`/extensions\` - Manage extensions
- \`/mcp\` - Manage MCP servers
- \`/hooks\` - Manage lifecycle hooks

### Other
- \`/compress\` - Compress conversation context
- \`/copy\` - Copy last output to clipboard
- \`/corgi\` - Toggle corgi mode
- \`/vim\` - Toggle vim mode
- \`/agents\` - Manage agent configurations
- \`/auth\` - Authentication settings
- \`/bug\` - Report a bug or issue
- \`/upgrade\` - Check for upgrades

Use \`/command\` or \`/\` to see all available commands.`);
  },

  about: () => {
    return createMessageAction(`## About Gemini CLI

**Version**: 0.36.0

Gemini CLI is a command-line interface for Google's Gemini AI. It provides an interactive REPL for conversing with Gemini, with support for:

- Multi-modal conversations (text, images, files)
- Tool execution and code writing
- Session management and context
- Extensible through skills and MCP servers

For more information, visit the documentation.`);
  },

  stats: () => {
    return createMessageAction(`## Session Statistics

Token usage and cost information will be displayed here.

Use the StatsBar at the top of the chat to see current session stats.`);
  },

  privacy: () => {
    return createMessageAction(`## Privacy Policy

Gemini CLI processes your conversations with Google's Gemini AI. Your prompts and AI responses may be logged for quality and debugging purposes.

**Data Handling**:
- Conversations are processed by Google's AI services
- Session data is stored locally on your machine
- No personal data is shared with third parties

For more information, visit the official privacy documentation.`);
  },

  policies: () => {
    return createMessageAction(`## Active Policies

The following policies are currently active:

1. **Content Safety** - All content is processed through Google's safety filters
2. **Data Retention** - Conversation data is retained according to Google's data policies
3. **Tool Execution** - File system operations require explicit user confirmation

Use \`/permissions\` to manage folder access permissions.`);
  },

  bug: (_context: CommandContext, _args: string) => {
    return createMessageAction(`## Report a Bug

To report a bug, please:
1. Visit the Gemini CLI GitHub repository
2. Create an issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details (OS, Node version, etc.)

Thank you for helping improve Gemini CLI!`);
  },

  docs: () => {
    return createSubmitPromptAction(
      `Please open the Gemini CLI documentation at https://github.com/google/gemini-cli`,
    );
  },

  clear: (_context: CommandContext, _args: string) => {
    return createMessageAction('__CLEAR_CHAT__');
  },

  settings: () => {
    return createMessageAction('__OPEN_SETTINGS__');
  },

  model: () => {
    return createMessageAction('__OPEN_MODEL_SELECTION__');
  },

  chat: () => {
    return createMessageAction('__OPEN_SESSION_BROWSER__');
  },

  new: () => {
    return createMessageAction('__NEW_SESSION__');
  },

  resume: () => {
    return createMessageAction('__RESUME_SESSION__');
  },

  compress: () => {
    return createMessageAction('__COMPRESS_CONTEXT__');
  },

  copy: () => {
    return createMessageAction('Last output has been copied to clipboard.');
  },

  corgi: () => {
    return createMessageAction('Corgi mode is not available in web UI.');
  },

  vim: () => {
    return createMessageAction('Vim mode is not available in web UI.');
  },

  shells: () => {
    return createMessageAction('Shell sessions are not available in web UI.');
  },

  commands: () => {
    return createSubmitPromptAction('/help');
  },

  footer: () => {
    return createMessageAction(`Gemini CLI v0.36.0 | Type /help for commands`);
  },

  shortcuts: () => {
    return createMessageAction(`## Keyboard Shortcuts

- \`/\` - Open command palette
- \`@\` - Reference files
- \`↑↓\` - Navigate suggestions
- \`Enter\` - Select suggestion
- \`Esc\` - Dismiss suggestions
- \`Ctrl+Enter\` - Send message`);
  },

  tools: () => {
    return createMessageAction(`## Available Tools

Gemini CLI supports the following tools:

- **Read** - Read file contents
- **Write** - Create or overwrite files
- **Edit** - Make targeted edits to files
- **Bash** - Execute shell commands
- **Grep** - Search file contents
- **Glob** - Find files by pattern

Tools are executed by the AI and require appropriate permissions.`);
  },

  skills: () => {
    return createMessageAction(`## Agent Skills

Skills extend Gemini CLI's capabilities. Use \`/skills\` to manage installed skills.

Available skill categories:
- Code generation
- Testing
- Documentation
- Code review
- Refactoring

Skills can be enabled/disabled per session.`);
  },

  extensions: () => {
    return createMessageAction(`## Extensions

Extensions provide additional functionality to Gemini CLI.

Use \`/extensions\` to:
- Install new extensions
- Enable/disable extensions
- Update extensions
- View extension settings

Browse available extensions in the marketplace.`);
  },

  agents: () => {
    return createMessageAction(`## Agent Configurations

Agents are specialized AI assistants optimized for specific tasks.

Use \`/agents\` to:
- List available agents
- Select an agent
- Configure agent settings
- Create custom agents

Different agents excel at different tasks (coding, writing, analysis, etc.)`);
  },

  auth: () => {
    return createMessageAction(`## Authentication

Gemini CLI supports multiple authentication methods:

- **Google Account** - Sign in with your Google account
- **API Key** - Use a Gemini API key
- **Vertex AI** - Enterprise authentication

Current authentication status: Active

Use \`/auth\` to manage authentication settings.`);
  },

  permissions: () => {
    return createMessageAction(`## Folder Permissions

Gemini CLI requires explicit permission to access folders.

Use \`/permissions\` to:
- Grant folder access
- Revoke folder access
- View currently trusted folders

For security, always verify folder access requests.`);
  },

  theme: () => {
    return createMessageAction(
      'Theme selection is not available in web UI. The dark theme is always active.',
    );
  },

  profile: () => {
    return createMessageAction(
      'Profile management is not available in web UI.',
    );
  },

  directory: () => {
    return createMessageAction(
      'Directory management is not available in web UI. The current working directory is used.',
    );
  },

  editor: () => {
    return createMessageAction(
      'External editor integration is not available in web UI.',
    );
  },

  hooks: () => {
    return createMessageAction(
      'Lifecycle hooks management is not available in web UI.',
    );
  },

  init: () => {
    return createMessageAction(
      'Project initialization is not available in web UI.',
    );
  },

  memory: () => {
    return createMessageAction(
      'Memory management is not available in web UI. Context is maintained automatically.',
    );
  },

  plan: () => {
    return createMessageAction('Plan mode is not available in web UI.');
  },

  rewind: () => {
    return createMessageAction(
      'Conversation rewind is not available in web UI. Start a new session for fresh context.',
    );
  },

  restore: () => {
    return createMessageAction('File restore is not available in web UI.');
  },

  mcp: () => {
    return createMessageAction(
      'MCP server management is not available in web UI.',
    );
  },

  ide: () => {
    return createMessageAction('IDE integration is not available in web UI.');
  },

  upgrade: () => {
    return createMessageAction(
      'Upgrade check is not available in web UI. Use the CLI version for upgrades.',
    );
  },

  quit: () => {
    return createMessageAction(
      'Quit is not available in web UI. Close the browser tab to exit.',
    );
  },
};

export function createWebCommand(
  name: string,
  baseCommand: Omit<SlashCommand, 'action'>,
): SlashCommand {
  const actionFn = webCommandActions[name];
  if (actionFn) {
    return {
      ...baseCommand,
      action: actionFn,
    };
  }
  return {
    ...baseCommand,
    action: () =>
      createMessageAction(`Command \`/${name}\` is not available in web UI.`),
  };
}
