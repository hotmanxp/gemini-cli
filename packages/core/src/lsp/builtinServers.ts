/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in LSP server definitions synced from OpenCode and oh-my-opencode.
 * Provides support for 40+ programming languages.
 */

import type { LspServerConfig } from './types.js';

/**
 * Installation hints for LSP servers.
 * Based on oh-my-opencode's LSP_INSTALL_HINTS.
 */
export const LSP_INSTALL_HINTS: Record<string, string> = {
  typescript: 'npm install -g typescript-language-server typescript',
  deno: 'Install Deno from https://deno.land',
  vue: 'npm install -g @vue/language-server',
  eslint: 'npm install -g vscode-langservers-extracted',
  oxlint: 'npm install -g oxlint',
  biome: 'npm install -g @biomejs/biome',
  gopls: 'go install golang.org/x/tools/gopls@latest',
  'ruby-lsp': 'gem install ruby-lsp',
  basedpyright: 'pip install basedpyright',
  pyright: 'pip install pyright',
  pylsp: 'pip install python-lsp-server',
  ty: 'pip install ty',
  ruff: 'pip install ruff',
  'elixir-ls': 'See https://github.com/elixir-lsp/elixir-ls',
  zls: 'See https://github.com/zigtools/zls',
  csharp: 'dotnet tool install -g csharp-ls',
  fsharp: 'dotnet tool install -g fsautocomplete',
  'sourcekit-lsp': 'Included with Xcode or Swift toolchain',
  rust: 'rustup component add rust-analyzer',
  clangd: 'See https://clangd.llvm.org/installation',
  svelte: 'npm install -g svelte-language-server',
  astro: 'npm install -g @astrojs/language-server',
  'bash-ls': 'npm install -g bash-language-server',
  bash: 'npm install -g bash-language-server',
  jdtls: 'See https://github.com/eclipse-jdtls/eclipse.jdt.ls',
  'yaml-ls': 'npm install -g yaml-language-server',
  'lua-ls': 'See https://github.com/LuaLS/lua-language-server',
  php: 'npm install -g intelephense',
  dart: 'Included with Dart SDK',
  'terraform-ls': 'See https://github.com/hashicorp/terraform-ls',
  terraform: 'See https://github.com/hashicorp/terraform-ls',
  prisma: 'npm install -g prisma',
  'ocaml-lsp': 'opam install ocaml-lsp-server',
  texlab: 'See https://github.com/latex-lsp/texlab',
  dockerfile: 'npm install -g dockerfile-language-server-nodejs',
  gleam: 'See https://gleam.run/getting-started/installing/',
  'clojure-lsp': 'See https://clojure-lsp.io/installation/',
  nixd: 'nix profile install nixpkgs#nixd',
  tinymist: 'See https://github.com/Myriad-Dreamin/tinymist',
  'haskell-language-server': 'ghcup install hls',
  'kotlin-ls': 'See https://github.com/Kotlin/kotlin-lsp',
  sql: 'npm install -g sql-language-server',
  markdownlint: 'npm install -g markdownlint-cli',
  json: 'npm install -g vscode-json-languageserver',
  css: 'npm install -g vscode-css-languageserver-bin',
  html: 'npm install -g vscode-html-languageserver-bin',
};

/**
 * Built-in LSP server definitions.
 * Synced with OpenCode's server.ts and oh-my-opencode's server-definitions.ts.
 * https://github.com/sst/opencode/blob/dev/packages/opencode/src/lsp/server.ts
 * https://github.com/your-org/oh-my-opencode/blob/main/src/tools/lsp/server-definitions.ts
 */
export const BUILTIN_SERVERS: Record<
  string,
  Omit<LspServerConfig, 'name' | 'languages' | 'rootUri' | 'workspaceFolder'>
> = {
  // TypeScript/JavaScript
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },
  deno: {
    command: 'deno',
    args: ['lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Vue
  vue: {
    command: 'vue-language-server',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // ESLint
  eslint: {
    command: 'vscode-eslint-language-server',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Oxlint
  oxlint: {
    command: 'oxlint',
    args: ['--lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Biome
  biome: {
    command: 'biome',
    args: ['lsp-proxy', '--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Go
  gopls: {
    command: 'gopls',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Ruby
  'ruby-lsp': {
    command: 'rubocop',
    args: ['--lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Python
  python: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
    initializationOptions: {
      // Auto-detect virtual environment
      pythonPath: undefined, // Will be set dynamically
    },
  },
  pyright: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
    initializationOptions: {
      // Auto-detect virtual environment
      pythonPath: undefined, // Will be set dynamically
    },
  },
  basedpyright: {
    command: 'basedpyright-langserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },
  pylsp: {
    command: 'pylsp',
    args: ['--check-parent-process', '--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },
  ruff: {
    command: 'ruff',
    args: ['server'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Elixir
  'elixir-ls': {
    command: 'elixir-ls',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Zig
  zls: {
    command: 'zls',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // C#
  csharp: {
    command: 'csharp-ls',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // F#
  fsharp: {
    command: 'fsautocomplete',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Swift
  'sourcekit-lsp': {
    command: 'sourcekit-lsp',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Rust
  rust: {
    command: 'rust-analyzer',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // C/C++
  clangd: {
    command: 'clangd',
    args: ['--background-index', '--clang-tidy'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Svelte
  svelte: {
    command: 'svelteserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Astro
  astro: {
    command: 'astro-ls',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Bash/Shell
  bash: {
    command: 'bash-language-server',
    args: ['start'],
    transport: 'stdio' as const,
    trustRequired: true,
  },
  'bash-ls': {
    command: 'bash-language-server',
    args: ['start'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Java
  jdtls: {
    command: 'jdtls',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // YAML
  yaml: {
    command: 'yaml-language-server',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Lua
  'lua-ls': {
    command: 'lua-language-server',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // PHP
  php: {
    command: 'intelephense',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Dart
  dart: {
    command: 'dart',
    args: ['language-server', '--lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Terraform
  terraform: {
    command: 'terraform-ls',
    args: ['serve'],
    transport: 'stdio' as const,
    trustRequired: true,
  },
  'terraform-ls': {
    command: 'terraform-ls',
    args: ['serve'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Prisma
  prisma: {
    command: 'prisma',
    args: ['language-server'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // OCaml
  'ocaml-lsp': {
    command: 'ocamllsp',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // LaTeX
  texlab: {
    command: 'texlab',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Dockerfile
  dockerfile: {
    command: 'docker-langserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Gleam
  gleam: {
    command: 'gleam',
    args: ['lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Clojure
  'clojure-lsp': {
    command: 'clojure-lsp',
    args: ['listen'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Nix
  nixd: {
    command: 'nixd',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Typst
  tinymist: {
    command: 'tinymist',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Haskell
  'haskell-language-server': {
    command: 'haskell-language-server-wrapper',
    args: ['--lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Kotlin
  'kotlin-ls': {
    command: 'kotlin-lsp',
    args: [],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // SQL
  sql: {
    command: 'sql-language-server',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // Markdown
  markdownlint: {
    command: 'markdownlint-cli',
    args: ['--lsp'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // HTML
  html: {
    command: 'html-languageserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },

  // CSS
  css: {
    command: 'css-languageserver',
    args: ['--stdio'],
    transport: 'stdio' as const,
    trustRequired: true,
  },
};

/**
 * Extension to language ID mapping.
 * Synced with oh-my-opencode's EXT_TO_LANG.
 */
export const EXT_TO_LANG: Record<string, string> = {
  // Web
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascriptreact',
  tsx: 'typescriptreact',
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',

  // Systems
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  'c++': 'cpp',
  h: 'c',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  'h++': 'cpp',
  rs: 'rust',
  go: 'go',
  zig: 'zig',
  zon: 'zig',

  // Backend
  py: 'python',
  pyi: 'python',
  pyw: 'python',
  java: 'java',
  cs: 'csharp',
  fs: 'fsharp',
  fsi: 'fsharp',
  fsx: 'fsharp',
  fsscript: 'fsharp',
  rb: 'ruby',
  rake: 'ruby',
  gemspec: 'ruby',
  ru: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',

  // Functional
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  hs: 'haskell',
  lhs: 'haskell',
  ml: 'ocaml',
  mli: 'ocaml',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  edn: 'clojure',

  // Data & Config
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  toml: 'toml',

  // Shell
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  ksh: 'shellscript',
  fish: 'fish',

  // Infrastructure
  tf: 'terraform',
  tfvars: 'terraform-vars',
  hcl: 'hcl',
  nix: 'nix',
  dockerfile: 'dockerfile',

  // Database
  sql: 'sql',

  // Documentation
  md: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
  bib: 'bibtex',
  typ: 'typst',
  typc: 'typst',

  // GraphQL
  graphql: 'graphql',
  gql: 'graphql',

  // Prisma
  prisma: 'prisma',

  // Gleam
  gleam: 'gleam',
};

/**
 * Language to extension mapping (reverse of EXT_TO_LANG).
 */
export const LANG_TO_EXTENSIONS: Record<string, string[]> = {};

// Build reverse mapping
for (const [ext, lang] of Object.entries(EXT_TO_LANG)) {
  if (!LANG_TO_EXTENSIONS[lang]) {
    LANG_TO_EXTENSIONS[lang] = [];
  }
  LANG_TO_EXTENSIONS[lang].push(`.${ext}`);
}

/**
 * Get server extensions for a language.
 */
export function getExtensionsForLanguage(language: string): string[] {
  return LANG_TO_EXTENSIONS[language] || [];
}

/**
 * Get language for a file extension.
 */
export function getLanguageForExtension(extension: string): string | null {
  const normalized = extension.startsWith('.')
    ? extension.slice(1)
    : extension;
  return EXT_TO_LANG[normalized.toLowerCase()] || null;
}

/**
 * Get built-in server config by language ID.
 */
export function getBuiltinServerConfig(
  language: string,
): LspServerConfig | null {
  const server = BUILTIN_SERVERS[language];
  if (!server) {
    return null;
  }

  const extensions = getExtensionsForLanguage(language);
  const languages = extensions.length > 0 ? [language] : [language];

  return {
    name: language,
    languages,
    ...server,
  } as LspServerConfig;
}

/**
 * Get all available language IDs.
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(BUILTIN_SERVERS);
}
