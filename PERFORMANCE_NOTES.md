/\*\*

- Performance optimization analysis for Gemini CLI startup
-
- Based on profiling, the main bottlenecks are:
-
- 1.  **Module Loading (0-1600ms)** - NO OUTPUT
- - Large bundle size
- - Many synchronous imports at top level
- - React/Ink loaded before needed
-
- 2.  **Duplicate Work (1682-1683ms)**
- - GEMINI.md files read TWICE
- - Memory discovery runs multiple times
- - Config loaded twice (partial + full)
-
- 3.  **Blocking Operations**
- - File system scans (cleanup, checkpoints)
- - Extension loading (preloadExtensionUserSettings)
- - Trusted folders loading
-
- Recommendations from qwen-code:
- - Use ESBuild with code splitting
- - Lazy load ALL non-critical modules
- - Cache GEMINI.md discovery results
- - Defer extension loading until AFTER UI render
- - Use worker threads for file I/O
-
- Current implementation already does:
- ✓ Lazy auth initialization
- ✓ Background theme setup
- ✓ Deferred cleanup
-
- Still needs:
- ✗ Module lazy loading (dynamic imports for heavy deps)
- ✗ Cache memory discovery
- ✗ Defer extension loading \*/

export const PROFILING_NOTES = { totalTime: '6000-9000ms', moduleLoading:
'~1600ms (blocking)', memoryDiscovery: '~100ms (duplicated)', lspInit: '~50ms',
extensionLoading: '~200ms', configLoading: '~300ms', authCheck: '~500ms',
uiRender: '~200ms', };
