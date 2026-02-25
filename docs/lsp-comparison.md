# OpenCode 原生 LSP vs oh-my-opencode 插件 LSP 对比分析

> 生成日期：2026-02-25  
> 分析对象：OpenCode 原生 LSP (`~/code/opencode/packages/opencode/src/lsp/`)  
> 对比对象：oh-my-opencode 插件 LSP (`~/code/oh-my-opencode/src/tools/lsp/`)

---

## 一、架构对比

### OpenCode 原生 LSP 架构

```
┌─────────────────────────────────────────────┐
│  LspTool (tool/lsp.ts)                     │
│  统一工具：operation 参数选择功能            │
│  - goToDefinition                           │
│  - findReferences                           │
│  - hover                                    │
│  - documentSymbol                           │
│  - workspaceSymbol                          │
│  - goToImplementation                       │
│  - prepareCallHierarchy                     │
│  - incomingCalls/outgoingCalls              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSP 命名空间 (lsp/index.ts)               │
│  • state(): 全局状态管理                    │
│  • getClients(): 按文件解析客户端           │
│  • touchFile(): 打开文件并等待诊断          │
│  • diagnostics(): 获取所有诊断              │
│  • definition/references/hover/etc()        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSPClient (lsp/client.ts)                 │
│  • vscode-jsonrpc MessageConnection        │
│  • 诊断通知监听 (publishDiagnostics)       │
│  • 文件版本控制 (didOpen/didChange)        │
│  • waitForDiagnostics(): 3s 超时等待        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSPServer (lsp/server.ts)                 │
│  • 30+ 内置服务器定义                       │
│  • 自动下载安装 (Flag 控制)                 │
│  • RootFunction: 项目根目录解析             │
└─────────────────────────────────────────────┘
```

### oh-my-opencode 插件 LSP 架构

```
┌─────────────────────────────────────────────┐
│  6 个独立工具                               │
│  - lsp_goto_definition                     │
│  - lsp_find_references                     │
│  - lsp_symbols                             │
│  - lsp_diagnostics                         │
│  - lsp_prepare_rename                      │
│  - lsp_rename                              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LspClientWrapper (lsp-client-wrapper.ts) │
│  • withLspClient() 入口                     │
│  • findWorkspaceRoot()                     │
│  • Server resolution + error formatting    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSPServerManager (lsp-server.ts)          │
│  • 单例管理所有 LSP 客户端                   │
│  • 引用计数、5 分钟空闲超时                  │
│  • 60s 初始化超时检测                       │
│  • 进程清理注册                             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSPClient (lsp-client.ts)                 │
│  • 文件追踪 (openedFiles Set)              │
│  • 文档版本控制                             │
│  • didOpen/didChange/didSave 通知          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSPClientTransport (lsp-client-transport)│
│  • vscode-jsonrpc MessageConnection        │
│  • stdin/stdout 字节流                      │
│  • 诊断结果存储                             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  LSPProcess (lsp-process.ts)               │
│  • Bun spawn (Unix) / Node (Windows)       │
│  • 流桥接                                   │
└─────────────────────────────────────────────┘
```

---

## 二、工具设计对比

| 维度 | OpenCode 原生 | oh-my-opencode 插件 |
|------|--------------|---------------------|
| **工具数量** | 1 个统一工具 (`lsp`) | 6 个独立工具 |
| **调用方式** | `lsp(operation="goToDefinition", ...)` | `lsp_goto_definition(...)` |
| **参数风格** | 统一参数 (operation, filePath, line, character) | 各工具独立参数 |
| **权限控制** | 需要用户确认 (`ctx.ask`) | 无权限确认 |
| **实验性标志** | `OPENCODE_EXPERIMENTAL_LSP_TOOL` | 始终可用 |

### OpenCode 原生工具特点

```typescript
// 统一工具，通过 operation 参数选择功能
export const LspTool = Tool.define("lsp", {
  parameters: z.object({
    operation: z.enum([
      "goToDefinition", "findReferences", "hover",
      "documentSymbol", "workspaceSymbol",
      "goToImplementation", "prepareCallHierarchy",
      "incomingCalls", "outgoingCalls"
    ]),
    filePath: z.string(),
    line: z.number().int().min(1),
    character: z.number().int().min(1),
  }),
  execute: async (args, ctx) => {
    // 需要用户权限确认
    await ctx.ask({ permission: "lsp", patterns: ["*"] })
    // ...
  }
})
```

### oh-my-opencode 插件工具特点

```typescript
// 独立工具定义
export const lsp_goto_definition = Tool.define("lsp_goto_definition", {
  parameters: z.object({
    filePath: z.string(),
    line: z.number().int().min(1),
    character: z.number().int().min(0), // 0-based
  }),
  execute: async (args) => {
    // 无需权限确认
    // ...
  }
})
```

---

## 三、服务器管理对比

### 服务器数量

| 类别 | OpenCode 原生 | oh-my-opencode 插件 |
|------|--------------|---------------------|
| **内置服务器** | 30+ | 40+ |
| **配置方式** | `config.lsp` | `.opencode/oh-my-opencode.jsonc` |
| **自动下载** | ✅ (Flag 控制) | ❌ (用户自行安装) |

### OpenCode 原生服务器管理

```typescript
// lsp/index.ts - 全局状态管理
const state = Instance.state(
  async () => {
    const clients: LSPClient.Info[] = []
    const servers: Record<string, LSPServer.Info> = {}
    const cfg = await Config.get()
    
    if (cfg.lsp === false) {
      log.info("all LSPs are disabled")
      return { broken: new Set(), servers, clients, spawning: new Map() }
    }
    
    // 加载内置服务器
    for (const server of Object.values(LSPServer)) {
      servers[server.id] = server
    }
    
    // 加载用户配置
    for (const [name, item] of Object.entries(cfg.lsp ?? {})) {
      // 用户自定义服务器覆盖
    }
  },
  async (state) => {
    // 清理：关闭所有客户端
    await Promise.all(state.clients.map((client) => client.shutdown()))
  }
)
```

**特点**：
- 使用 `Instance.state()` 全局单例
- 支持实验性标志 (`OPENCODE_EXPERIMENTAL_LSP_TY`)
- 自动下载缺失的 LSP 服务器 (可通过 `OPENCODE_DISABLE_LSP_DOWNLOAD` 禁用)
- `spawning` Map 防止重复启动

### oh-my-opencode 插件服务器管理

```typescript
// lsp-server.ts - LSPServerManager
export class LSPServerManager {
  private static instance: LSPServerManager
  private clients: Map<string, LSPClient> = new Map()
  private idleTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private refCounts: Map<string, number> = new Map()
  
  // 5 分钟空闲超时
  private static readonly IDLE_TIMEOUT = 5 * 60 * 1000
  
  // 60s 初始化超时
  private static readonly INIT_TIMEOUT = 60 * 1000
}
```

**特点**：
- 独立单例管理器
- 引用计数防止重复启动
- 5 分钟空闲自动关闭
- 60s 初始化超时保护
- 注册 exit/SIGINT/SIGTERM 处理器

---

## 四、诊断 (Diagnostics) 对比

### OpenCode 原生诊断

```typescript
// lsp/index.ts
export async function diagnostics() {
  const results: Record<string, LSPClient.Diagnostic[]> = {}
  for (const result of await runAll(async (client) => client.diagnostics)) {
    for (const [path, diagnostics] of result.entries()) {
      const arr = results[path] || []
      arr.push(...diagnostics)
      results[path] = arr
    }
  }
  return results
}

// lsp/client.ts - 诊断通知监听
connection.onNotification("textDocument/publishDiagnostics", (params) => {
  const filePath = Filesystem.normalizePath(fileURLToPath(params.uri))
  diagnostics.set(filePath, params.diagnostics)
  Bus.publish(Event.Diagnostics, { path: filePath, serverID: input.serverID })
})

// waitForDiagnostics - 3s 超时等待
async waitForDiagnostics(input: { path: string }) {
  return await withTimeout(
    new Promise<void>((resolve) => {
      unsub = Bus.subscribe(Event.Diagnostics, (event) => {
        if (event.properties.path === normalizedPath) {
          // 150ms 去抖动
          debounceTimer = setTimeout(resolve, DIAGNOSTICS_DEBOUNCE_MS)
        }
      })
    }),
    3000
  )
}
```

**特点**：
- 被动接收 `publishDiagnostics` 通知
- 使用 `Bus` 事件系统广播
- 150ms 去抖动
- 3s 超时等待

### oh-my-opencode 插件诊断

```typescript
// diagnostics-tool.ts
export const lsp_diagnostics = Tool.define("lsp_diagnostics", {
  parameters: z.object({
    filePath: z.string(),
    severity: z.enum(["error", "warning", "information", "hint", "all"]).optional(),
  }),
  execute: async (args) => {
    return await withLspClient(args.filePath, async (client, lspClient) => {
      // Pull 模式：主动请求
      const diagnostics = await client.connection.sendRequest(
        "textDocument/diagnostic",
        { textDocument: { uri: pathToFileURL(args.filePath).href } }
      )
      // 或回退到存储的诊断结果
    })
  }
})
```

**特点**：
- Pull 模式 (LSP 3.17 `textDocument/diagnostic`)
- 回退到存储的诊断结果
- 支持按 severity 过滤
- 无等待机制

---

## 五、关键差异总结

| 维度 | OpenCode 原生 | oh-my-opencode 插件 |
|------|--------------|---------------------|
| **设计哲学** | 统一工具，实验性标志 | 独立工具，始终可用 |
| **权限控制** | 需要用户确认 | 自动执行 |
| **诊断模式** | Push (通知监听) | Pull (主动请求) |
| **诊断等待** | 3s 超时 + 去抖动 | 无等待 |
| **服务器管理** | Instance.state 全局状态 | 独立单例管理器 |
| **空闲清理** | 无明确超时 | 5 分钟自动关闭 |
| **初始化超时** | 45s | 60s |
| **自动下载** | ✅ | ❌ |
| **Windows 兼容** | Bun spawn | Node child_process (避免 segfault) |
| **引用计数** | 无 | ✅ (防止重复启动) |
| **Hook 集成** | 有限 | 深度集成 (atlas, ultrawork 等) |

---

## 六、为什么 oh-my-opencode 保留自己的 LSP 实现？

### 1. 历史原因
- oh-my-opencode 的 LSP 实现早于 OpenCode 原生 LSP 工具
- 2026-01-16 的 commit `48167a69` 移除了重复工具，但保留了核心功能

### 2. 功能差异

| 功能 | OpenCode 原生 | oh-my-opencode 插件 |
|------|--------------|---------------------|
| `lsp_diagnostics` | ❌ (仅内部使用) | ✅ (独立工具) |
| `lsp_rename` | ❌ | ✅ |
| `lsp_prepare_rename` | ❌ | ✅ |
| `lsp_hover` | ✅ | ❌ (已移除) |
| `lsp_code_actions` | ✅ | ❌ (已移除) |

### 3. 集成深度
- oh-my-opencode 的 LSP 与插件的 hooks 深度集成：
  - `tool-output-truncator`: 截断诊断输出
  - `atlas`: 修改文件后提醒运行诊断
  - `keyword-detector` (ultrawork): 要求诊断验证
  - `event` (session.deleted): 清理临时目录客户端

### 4. 控制权
- 独立的进程管理 (引用计数、空闲超时)
- 自定义服务器解析逻辑
- 灵活的配置系统

---

## 七、未来趋势

根据 git 历史分析：

1. **逐步收敛**: oh-my-opencode 正在移除与 OpenCode 重复的工具
   - `lsp_hover`, `lsp_code_actions`, `lsp_code_action_resolve` 已移除
   - `lsp_document_symbols` + `lsp_workspace_symbols` → `lsp_symbols`

2. **保留差异化**: 保留 OpenCode 没有的核心功能
   - `lsp_diagnostics` (诊断获取)
   - `lsp_rename` (重命名)

3. **深度集成**: 加强与插件生态的集成
   - hooks 系统
   - ultrawork 模式
   - 会话管理

---

## 八、源码位置

### OpenCode 原生
- **LSP 核心**: `packages/opencode/src/lsp/`
  - `index.ts` - LSP 命名空间，全局状态
  - `client.ts` - LSPClient 创建
  - `server.ts` - 30+ 服务器定义
- **工具定义**: `packages/opencode/src/tool/lsp.ts`
- **工具描述**: `packages/opencode/src/tool/lsp.txt`

### oh-my-opencode 插件
- **工具目录**: `src/tools/lsp/`
- **管理器**: `src/tools/lsp/lsp-server.ts`
- **客户端**: `src/tools/lsp/lsp-client.ts`
- **传输层**: `src/tools/lsp/lsp-client-transport.ts`
- **进程管理**: `src/tools/lsp/lsp-process.ts`

---

## 八、OpenCode 自动下载机制详解

### 控制开关

```typescript
// src/flag/flag.ts
export const OPENCODE_DISABLE_LSP_DOWNLOAD = truthy("OPENCODE_DISABLE_LSP_DOWNLOAD")
```

**禁用方式**：设置环境变量 `OPENCODE_DISABLE_LSP_DOWNLOAD=1`

### 下载流程通用模式

```typescript
async spawn(root) {
  // 1. 首先检查二进制是否存在
  let bin = Bun.which("xxx-language-server")
  if (bin) {
    return { process: spawn(bin, ...) }
  }

  // 2. 检查是否禁用自动下载
  if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return

  // 3. 执行下载/安装
  log.info("installing xxx")
  // ... 下载逻辑

  // 4. 验证安装
  if (!(await Filesystem.exists(bin))) {
    log.error("Failed to install xxx")
    return
  }

  // 5. 启动服务器
  return { process: spawn(bin, ...) }
}
```

### 五种下载策略

#### 1. 包管理器安装 (npm/bun/gem/go/dotnet)

**适用服务器**：typescript, vue, pyright, svelte, astro, yaml-ls, bash, intelephense, gopls, rubocop, csharp-ls, fsautocomplete

```typescript
// Bun/npm install
await Bun.spawn([BunProc.which(), "install", "@vue/language-server"], {
  cwd: Global.Path.bin,
  env: { ...process.env, BUN_BE_BUN: "1" },
})

// Go install
const proc = Bun.spawn({
  cmd: ["go", "install", "golang.org/x/tools/gopls@latest"],
  env: { ...process.env, GOBIN: Global.Path.bin },
})

// Ruby gem install
const proc = Bun.spawn({
  cmd: ["gem", "install", "rubocop", "--bindir", Global.Path.bin],
})

// .NET tool install
const proc = Bun.spawn({
  cmd: ["dotnet", "tool", "install", "csharp-ls", "--tool-path", Global.Path.bin],
})
```

#### 2. GitHub Releases 下载 (ZIP/tar.gz)

**适用服务器**：clangd, zls, lua-ls, kotlin-ls, texlab, terraform-ls, tinymist

```typescript
// 1. 获取最新版本信息
const releaseResponse = await fetch("https://api.github.com/repos/clangd/clangd/releases/latest")
const release = await releaseResponse.json()

// 2. 平台映射
const tokens = { darwin: "mac", linux: "linux", win32: "windows" }
const token = tokens[platform]

// 3. 架构映射
const archMap = { arm64: "aarch64", x64: "x86_64", ia32: "x86" }

// 4. 匹配正确的资产
const asset = release.assets.find((item) => 
  item.name.includes(token) && item.name.includes(tag)
)

// 5. 下载 + 解压
const downloadResponse = await fetch(asset.browser_download_url)
await Filesystem.write(archive, Buffer.from(await downloadResponse.arrayBuffer()))
if (zip) await Archive.extractZip(archive, Global.Path.bin)
else await $`tar -xf ${archive}`.cwd(Global.Path.bin)

// 6. 创建符号链接
await fs.symlink(bin, path.join(Global.Path.bin, "clangd"))
```

#### 3. GitHub Archive 下载 (源码编译)

**适用服务器**：eslint, elixir-ls

```typescript
// ESLint 示例
const response = await fetch("https://github.com/microsoft/vscode-eslint/archive/refs/heads/main.zip")
await Filesystem.writeStream(zipPath, response.body)
await Archive.extractZip(zipPath, Global.Path.bin)
await fs.rename(extractedPath, finalPath)

// npm install + compile
await $`${npmCmd} install`.cwd(finalPath).quiet()
await $`${npmCmd} run compile`.cwd(finalPath).quiet()
```

#### 4. 官方下载源

**适用服务器**：jdtls (Eclipse), terraform-ls (HashiCorp)

```typescript
// JDTLS - Eclipse
const releaseURL = "https://www.eclipse.org/downloads/download.php?file=/jdtls/snapshots/jdt-language-server-latest.tar.gz"
await $`curl -L -o ${archiveName} '${releaseURL}'`.cwd(distPath)
await $`tar -xzf ${archiveName}`.cwd(distPath)

// terraform-ls - HashiCorp API
const releaseResponse = await fetch("https://api.releases.hashicorp.com/v1/releases/terraform-ls/latest")
const build = release.builds.find((b) => b.os === platform && b.arch === arch)
const downloadResponse = await fetch(build.url)
```

#### 5. JetBrains CDN

**适用服务器**：kotlin-ls

```typescript
const releaseURL = `https://download-cdn.jetbrains.com/kotlin-lsp/${version}/${assetName}`
await $`curl -L -o '${archivePath}' '${releaseURL}'`.quiet()
await Archive.extractZip(archivePath, distPath)
```

### 安装位置

所有服务器统一安装到：

```typescript
Global.Path.bin  // ~/.local/share/opencode/bin/
```

**目录结构示例**：
```
~/.local/share/opencode/bin/
├── clangd_19.1.7/bin/clangd
├── lua-language-server-x64-linux/bin/lua-language-server
├── node_modules/@vue/language-server/
├── vscode-eslint/server/out/eslintServer.js
├── gopls
└── zls
```

### 错误处理

```typescript
// 1. 检查 Flag
if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return

// 2. 检查依赖
if (!Bun.which("go")) {
  log.error("Go is required to install gopls")
  return
}

// 3. 下载失败
if (!response.ok) {
  log.error("Failed to download xxx", { url })
  return
}

// 4. 验证失败
if (!(await Filesystem.exists(bin))) {
  log.error("Failed to extract binary")
  return
}
```

---

## 九、oh-my-opencode 为什么没有自动下载？

### 设计哲学差异

| 维度 | OpenCode | oh-my-opencode |
|------|----------|----------------|
| **依赖管理** | 自动下载，用户无感 | 用户自行安装，明确控制 |
| **代码复杂度** | ~2000 行下载逻辑 | ~70 行检查逻辑 |
| **灵活性** | 固定安装路径 | 用户可选择 asdf, nvm, 系统包等 |
| **网络依赖** | 依赖 GitHub/官方源 | 无网络下载依赖 |

### 代码对比

**OpenCode**：每个服务器都有下载逻辑
```typescript
if (!bin) {
  if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
  const releaseResponse = await fetch("...")
  // ... 下载、解压、验证
}
```

**oh-my-opencode**：仅检查是否存在
```typescript
// server-installation.ts
export function isServerInstalled(command: string[]): boolean {
  // 仅检查 PATH 和常见目录
  // 提供安装提示，不自动下载
}
```

### oh-my-opencode 的安装提示

```typescript
// server-definitions.ts
export const LSP_INSTALL_HINTS: Record<string, string> = {
  typescript: "npm install -g typescript-language-server typescript",
  gopls: "go install golang.org/x/tools/gopls@latest",
  rust: "rustup component add rust-analyzer",
  clangd: "See https://clangd.llvm.org/installation",
  // ... 40+ 服务器提示
}
```

### 例外情况

oh-my-opencode **对部分工具实现了自动下载**：
- `ripgrep` - 代码搜索
- `ast-grep` - AST 搜索

**原因**：这两个工具是 oh-my-opencode 核心功能依赖，而 LSP 是可选功能。

---

## 十、未来趋势

根据 git 历史分析：

1. **逐步收敛**: oh-my-opencode 正在移除与 OpenCode 重复的工具
   - `lsp_hover`, `lsp_code_actions`, `lsp_code_action_resolve` 已移除
   - `lsp_document_symbols` + `lsp_workspace_symbols` → `lsp_symbols`

2. **保留差异化**: 保留 OpenCode 没有的核心功能
   - `lsp_diagnostics` (诊断获取)
   - `lsp_rename` (重命名)

3. **深度集成**: 加强与插件生态的集成
   - hooks 系统
   - ultrawork 模式
   - 会话管理

---

## 十一、源码位置

### OpenCode 原生
- **LSP 核心**: `packages/opencode/src/lsp/`
  - `index.ts` - LSP 命名空间，全局状态
  - `client.ts` - LSPClient 创建
  - `server.ts` - 30+ 服务器定义 (含自动下载逻辑)
- **工具定义**: `packages/opencode/src/tool/lsp.ts`
- **工具描述**: `packages/opencode/src/tool/lsp.txt`
- **Flag 定义**: `packages/opencode/src/flag/flag.ts`

### oh-my-opencode 插件
- **工具目录**: `src/tools/lsp/`
- **管理器**: `src/tools/lsp/lsp-server.ts`
- **客户端**: `src/tools/lsp/lsp-client.ts`
- **传输层**: `src/tools/lsp/lsp-client-transport.ts`
- **进程管理**: `src/tools/lsp/lsp-process.ts`
- **服务器定义**: `src/tools/lsp/server-definitions.ts` (40+ 服务器)
- **安装检查**: `src/tools/lsp/server-installation.ts`
- **文档**: `src/tools/lsp/AGENTS.md`

---

## 附录：服务器列表对比

## 附录：服务器列表对比

### OpenCode 原生 (30+)

| 语言 | 服务器 | 自动下载 |
|------|--------|----------|
| TypeScript | typescript | ✅ |
| Deno | deno | ❌ |
| Vue | vue | ✅ |
| ESLint | eslint | ✅ |
| Oxlint | oxlint | ❌ |
| Biome | biome | ❌ |
| Go | gopls | ✅ |
| Ruby | rubocop | ✅ |
| Python (实验) | ty | ✅ (Flag) |
| Python | pyright | ✅ |
| Elixir | elixir-ls | ✅ |
| Zig | zls | ✅ |
| C# | csharp | ✅ |
| F# | fsautocomplete | ✅ |
| Swift | sourcekit-lsp | ❌ |
| Rust | rust-analyzer | ❌ |
| C/C++ | clangd | ✅ |
| Svelte | svelte | ✅ |
| Astro | astro | ✅ |
| Java | jdtls | ✅ |
| Kotlin | kotlin-ls | ✅ |
| YAML | yaml-ls | ✅ |
| Lua | lua-ls | ✅ |
| PHP | php intelephense | ✅ |
| Prisma | prisma | ❌ |
| Dart | dart | ❌ |
| OCaml | ocaml-lsp | ❌ |
| Bash | bash | ✅ |
| Terraform | terraform-ls | ✅ |

### oh-my-opencode 插件 (40+)

额外支持：
- Haskell
- Nix
- Typst (LaTeX)
- Gleam
- Clojure
- Dockerfile
- HTML/CSS
- 更多...

(通过 `server-definitions.ts` 配置)
