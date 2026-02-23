# LSP Warmup Feature

## Overview

The LSP warmup feature preloads language servers by opening representative
project files, triggering faster initialization and project analysis. This
results in quicker response times for subsequent LSP operations.

## Supported Languages

- ✅ **TypeScript/JavaScript** (`.ts`, `.tsx`, `.js`, `.jsx`)
- ✅ **Python** (`.py`)

## Usage

### Manual Warmup via LSP Tool

Use the LSP tool with the `warmup` operation:

```typescript
// Warm up all LSP servers
lsp operation: warmup

// Warm up a specific server
lsp operation: warmup serverName: "typescript-language-server"
```

### Programmatic Usage

```typescript
// Via NativeLspService
await lspService.warmup(); // Warm up all servers
await lspService.warmup('pylsp'); // Warm up specific server

// Via LspClient
await lspClient.warmup(); // Warm up all servers
await lspClient.warmup('typescript-language-server'); // Warm up specific server
```

## How It Works

1. **File Discovery**: Finds representative project files:
   - TypeScript: First `.ts`/`.tsx`/`.js`/`.jsx` file (excluding `node_modules`,
     `dist`, etc.)
   - Python: First `.py` file (excluding `node_modules`, `__pycache__`, `.venv`,
     etc.)

2. **Server Trigger**: Opens the file via LSP `textDocument/didOpen`
   notification

3. **Project Analysis**: Language server analyzes the file and builds project
   context

4. **Warm State**: Server marked as "warmed up" for faster subsequent operations

## Implementation Details

### Files Modified

- `packages/core/src/lsp/LspServerManager.ts`
  - `findFirstPythonFile()` - Discover Python files
  - `warmupPythonServer()` - Python server warmup
  - `warmupServer()` - Public API for warmup
  - `isPythonServer()` - Python server detection

- `packages/core/src/lsp/NativeLspService.ts`
  - `warmup()` - Service-level warmup method

- `packages/core/src/lsp/types.ts`
  - `LspClient.warmup()` - Interface method

- `packages/core/src/lsp/NativeLspClient.ts`
  - `warmup()` - Client implementation

- `packages/core/src/tools/lsp.ts`
  - `warmup` operation added to `LspOperation` type
  - `executeWarmup()` - Tool execution handler

### Configuration

Warmup uses the existing LSP configuration. No additional setup required.

## Benefits

- **Faster First Response**: Language servers pre-loaded before first use
- **Better UX**: Reduced latency for initial LSP operations
- **Project Context**: Servers build full project understanding upfront
- **Manual Control**: Users can trigger warmup when needed

## Future Enhancements

- Auto-warmup on session start (configurable)
- Additional language support (Go, Rust, Java, etc.)
- Warmup progress indicators
- Selective warmup (specific files/projects)
