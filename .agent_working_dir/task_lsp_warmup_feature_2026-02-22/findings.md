# Findings & Decisions

## Requirements

- Investigate if current LSP implementation supports warmup/preloading
- If not, implement warmup feature
- Support only TypeScript and Python projects initially
- Warmup should prepare LSP servers for faster response times

## Research Findings

### Current LSP Architecture

1. **Two LSP implementations exist:**
   - **Legacy LSP** (`packages/core/src/services/lsp/`): `LspService`,
     `LspClient`, `LspServerManager` - simpler implementation
   - **Native LSP** (`packages/core/src/lsp/`): `NativeLspService`,
     `NativeLspClient`, `LspServerManager` - full-featured implementation

2. **Warmup feature ALREADY EXISTS in Native LSP:**
   - Location: `packages/core/src/lsp/LspServerManager.ts`
   - Method: `warmupTypescriptServer(handle, force?)`
   - Constant: `DEFAULT_LSP_WARMUP_DELAY_MS = 150` (in `constants.ts`)
   - Current implementation: Opens first TypeScript file to trigger server build

3. **Warmup Usage:**
   - Called from `NativeLspService.ts` before various LSP operations
   - Only supports TypeScript/JavaScript currently
   - No Python warmup implementation exists

4. **LSP Tool Integration:**
   - `packages/core/src/tools/lsp.ts` - Main LSP tool used by the CLI
   - Uses `Config.getLspClient()` to get the active client
   - No explicit warmup method exposed in the tool API

### Missing Features

1. ❌ No public warmup API/tool operation
2. ❌ No Python project warmup support
3. ❌ No automatic warmup on session start
4. ❌ Warmup only for TypeScript, not Python

## Technical Decisions

| Decision                             | Rationale                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Implement Python warmup + public API | User confirmed: implement Python project warmup support and expose warmup as a public LSP tool operation |

## Implementation Plan

### 1. LspServerManager.ts Changes

- Add `findFirstPythonFile()` - Find representative .py file
- Add `warmupPythonServer(handle, force?)` - Open .py file to trigger server
  build
- Add `warmupServer(serverName?)` - Public API for manual warmup
- Add `warmupAll()` - Auto warmup all servers

### 2. NativeLspService.ts Changes

- Add `warmup(serverName?)` method to service API

### 3. LSP Tool Changes (lsp.ts)

- Add `warmup` operation to `LspOperation` type
- Add `serverName` optional parameter
- Handle warmup execution in switch statement

### 4. Config Integration

- Add optional auto-warmup on session start (configurable)

## Issues Encountered

- [ ] No issues yet

## Resources

- LSP tools location: `packages/core/src/tools/`
- LSP test file: `integration-tests/lsp.test.ts`

## Session Log

- **2026-02-22**: Task started - investigating LSP warmup capabilities
