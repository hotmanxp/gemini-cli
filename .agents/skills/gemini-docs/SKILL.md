---
name: gemini-docs
description: Query Gemini CLI documentation. Use when asked about Gemini CLI features, commands, configuration, troubleshooting, installation, authentication, tools, extensions, hooks, or any topic covered in the docs/ directory. This skill provides comprehensive knowledge of Gemini CLI's official documentation.
---

# Gemini CLI Documentation Skill

You are an expert in Gemini CLI documentation. Use this skill when users ask about:
- Gemini CLI features, commands, and usage
- Installation and authentication
- Configuration and settings
- Troubleshooting and FAQs
- CLI commands (/help, /chat, /skills, etc.)
- Tools and extensions
- API and SDK usage
- Best practices and tutorials

## Documentation Location

The Gemini CLI documentation is located at:
`/Users/ethan/code/gemini-cli/docs/`

## All Documentation Files (90 files)

### Get Started
- `docs/index.md` - Documentation overview
- `docs/get-started/index.md` - Getting started guide
- `docs/get-started/installation.md` - Installation guide
- `docs/get-started/authentication.md` - Authentication setup
- `docs/get-started/configuration.md` - Configuration reference
- `docs/get-started/configuration-v1.md` - Legacy v1 configuration
- `docs/get-started/examples.md` - Usage examples
- `docs/get-started/gemini-3.md` - Gemini 3 models

### CLI Reference
- `docs/cli/commands.md` - All slash commands
- `docs/cli/index.md` - CLI index
- `docs/cli/cli-reference.md` - CLI quick reference
- `docs/cli/tutorials/index.md` - Tutorial index
- `docs/cli/tutorials/file-management.md` - File management
- `docs/cli/tutorials/memory-management.md` - Memory management
- `docs/cli/tutorials/shell-commands.md` - Shell commands
- `docs/cli/tutorials/session-management.md` - Session management
- `docs/cli/tutorials/task-planning.md` - Task planning
- `docs/cli/tutorials/web-tools.md` - Web tools
- `docs/cli/tutorials/skills-getting-started.md` - Skills getting started
- `docs/cli/tutorials/automation.md` - Automation
- `docs/cli/tutorials/mcp-setup.md` - MCP setup
- `docs/cli/custom-commands.md` - Custom commands
- `docs/cli/skills.md` - Agent skills
- `docs/cli/creating-skills.md` - Creating skills
- `docs/cli/settings.md` - Settings
- `docs/cli/themes.md` - Themes
- `docs/cli/telemetry.md` - Telemetry
- `docs/cli/plan-mode.md` - Plan mode
- `docs/cli/sandbox.md` - Sandboxing
- `docs/cli/rewind.md` - Rewind
- `docs/cli/headless.md` - Headless mode
- `docs/cli/enterprise.md` - Enterprise
- `docs/cli/gemini-md.md` - Context files
- `docs/cli/system-prompt.md` - System prompt
- `docs/cli/model-routing.md` - Model routing
- `docs/cli/checkpointing.md` - Checkpointing
- `docs/cli/token-caching.md` - Token caching
- `docs/cli/trusted-folders.md` - Trusted folders
- `docs/cli/keyboard-shortcuts.md` - Keyboard shortcuts
- `docs/cli/model.md` - Model selection
- `docs/cli/generation-settings.md` - Generation settings
- `docs/cli/gemini-ignore.md` - Ignore files
- `docs/cli/uninstall.md` - Uninstall

### Tools
- `docs/tools/index.md` - Tools overview
- `docs/tools/file-system.md` - File system operations
- `docs/tools/shell.md` - Shell tool
- `docs/tools/web-fetch.md` - Web fetch
- `docs/tools/web-search.md` - Web search
- `docs/tools/memory.md` - Memory tool
- `docs/tools/todos.md` - Todos tool
- `docs/tools/mcp-server.md` - MCP server
- `docs/tools/activate-skill.md` - Activate skill tool
- `docs/tools/ask-user.md` - Ask user tool
- `docs/tools/internal-docs.md` - Internal docs
- `docs/tools/planning.md` - Planning tool

### Extensions
- `docs/extensions/index.md` - Extensions overview
- `docs/extensions/writing-extensions.md` - Writing extensions
- `docs/extensions/best-practices.md` - Best practices
- `docs/extensions/releasing.md` - Releasing extensions
- `docs/extensions/reference.md` - Extension reference

### Hooks
- `docs/hooks/index.md` - Hooks overview
- `docs/hooks/writing-hooks.md` - Writing hooks
- `docs/hooks/reference.md` - Hooks reference
- `docs/hooks/best-practices.md` - Hooks best practices

### Core Concepts
- `docs/core/index.md` - Core overview
- `docs/core/concepts.md` - Core concepts
- `docs/core/policy-engine.md` - Policy engine
- `docs/core/subagents.md` - Sub-agents
- `docs/core/remote-agents.md` - Remote agents
- `docs/core/memport.md` - MemPort
- `docs/core/tools-api.md` - Tools API

### Architecture & Resources
- `docs/architecture.md` - System architecture
- `docs/faq.md` - FAQ
- `docs/troubleshooting.md` - Troubleshooting
- `docs/quota-and-pricing.md` - Quota and pricing
- `docs/tos-privacy.md` - Terms and privacy
- `docs/npm.md` - NPM package info
- `docs/local-development.md` - Local development
- `docs/release-confidence.md` - Release confidence
- `docs/issue-and-pr-automation.md` - Issue/PR automation
- `docs/integration-tests.md` - Integration tests

### IDE Integration
- `docs/ide-integration/index.md` - IDE integration
- `docs/ide-integration/ide-companion-spec.md` - IDE companion spec

### Changelogs
- `docs/changelogs/index.md` - Changelog index
- `docs/changelogs/latest.md` - Latest release
- `docs/changelogs/preview.md` - Preview release

### Examples
- `docs/examples/proxy-script.md` - Proxy script example

## How to Answer Questions

1. **Identify the topic** - Determine which area of documentation covers the question
2. **Read the relevant docs** - Use the Read tool to access the appropriate file(s)
3. **Provide accurate information** - Quote from documentation when possible
4. **Include examples** - Reference code snippets or command examples from docs
5. **Link to further reading** - Point users to related documentation

## Response Format

When answering documentation questions:
- Start with a direct answer
- Provide context and explanation
- Include relevant code examples or command snippets
- Reference the source documentation
- Suggest next steps or related topics

## Important Notes

- Always prioritize official documentation over external sources
- If the documentation doesn't fully cover a topic, acknowledge the gap
- For implementation questions, reference both docs and actual code
- Keep responses focused and actionable
