# LSP 自动下载功能使用指南

## 概述

Gemini
CLI 现在支持选择性自动下载 LSP 服务器。当检测到所需的 LSP 服务器未安装时，系统可以自动通过 npm/yarn/pnpm/pip 安装。

## 快速开始

### 1. 基础配置

在项目根目录创建 `.lsp.json` 文件：

```json
{
  "typescript": {
    "command": "typescript-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true,
      "packageManager": "npm",
      "packages": ["typescript-language-server", "typescript"]
    }
  },
  "python": {
    "command": "pyright",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true,
      "packageManager": "pip",
      "packages": ["pyright"]
    }
  }
}
```

### 2. 全局配置

在用户配置文件中启用全局自动下载：

```json
{
  "lsp": {
    "autoInstall": {
      "enabled": true,
      "allowedPackageManagers": ["npm", "yarn", "pnpm", "pip"],
      "timeout": 120000,
      "skipConfirmation": false
    }
  }
}
```

## 配置选项

### 全局配置 (`lsp.autoInstall`)

| 选项                     | 类型    | 默认值                           | 说明                 |
| ------------------------ | ------- | -------------------------------- | -------------------- |
| `enabled`                | boolean | `false`                          | 是否启用自动下载     |
| `allowedPackageManagers` | array   | `["npm", "yarn", "pnpm", "pip"]` | 允许的包管理器       |
| `timeout`                | number  | `120000`                         | 安装超时时间（毫秒） |
| `skipConfirmation`       | boolean | `false`                          | 跳过确认提示         |

### 服务器级别配置 (`autoInstall`)

| 选项             | 类型    | 默认值         | 说明                       |
| ---------------- | ------- | -------------- | -------------------------- |
| `enabled`        | boolean | 继承全局       | 是否为该服务器启用自动下载 |
| `packageManager` | string  | 自动检测       | 使用的包管理器             |
| `packages`       | array   | 根据服务器推断 | 要安装的包列表             |

## 支持的 LSP 服务器

### 自动可安装 (npm)

- `typescript-language-server` - TypeScript/JavaScript
- `vue-language-server` - Vue
- `svelte-language-server` - Svelte
- `yaml-language-server` - YAML
- `bash-language-server` - Bash/Shell
- `intelephense` - PHP
- `dockerfile-language-server-nodejs` - Dockerfile
- `sql-language-server` - SQL
- `vscode-eslint-language-server` - ESLint
- `prisma` - Prisma

### 自动可安装 (pip)

- `pylsp` - Python (python-lsp-server)
- `pyright-langserver` - Python (pyright)

### 需要手动安装

以下服务器需要手动安装（提供安装提示）：

- `clangd` - C/C++ (系统包管理器)
- `rust-analyzer` - Rust (rustup)
- `gopls` - Go (go install)
- `jdtls` - Java (Eclipse JDTLS)
- `ruby-lsp` - Ruby (gem)
- `zls` - Zig (GitHub releases)
- `elixir-ls` - Elixir (Mix)
- `lua-language-server` - Lua (GitHub releases)
- `terraform-ls` - Terraform (HashiCorp)
- `kotlin-lsp` - Kotlin (GitHub releases)
- `dart` - Dart (Dart SDK)
- `texlab` - LaTeX (GitHub releases)
- `ocamllsp` - OCaml (opam)
- `clojure-lsp` - Clojure (GitHub releases)
- `nixd` - Nix (nix profile)
- `haskell-language-server` - Haskell (ghcup)

## 使用示例

### 示例 1：TypeScript 项目

```json
{
  "typescript": {
    "command": "typescript-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true
    }
  }
}
```

系统会自动安装：`npm install -g typescript-language-server typescript`

### 示例 2：多语言项目

```json
{
  "typescript": {
    "command": "typescript-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true,
      "packageManager": "npm"
    }
  },
  "python": {
    "command": "pyright",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true,
      "packageManager": "pip"
    }
  },
  "vue": {
    "command": "vue-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true,
      "packages": ["@vue/language-server"]
    }
  }
}
```

### 示例 3：禁用特定服务器的自动安装

```json
{
  "typescript": {
    "command": "typescript-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true
    }
  },
  "clangd": {
    "command": "clangd",
    "args": ["--background-index", "--clang-tidy"],
    "autoInstall": {
      "enabled": false
    }
  }
}
```

## 命令行使用

### 手动安装 LSP 服务器

```bash
# 安装 TypeScript LSP
gemini lsp install typescript-language-server

# 安装 Python LSP
gemini lsp install pyright

# 查看所有可安装的服务器
gemini lsp install --list
```

### 检查安装状态

```bash
# 检查所有 LSP 服务器
gemini lsp status

# 检查特定服务器
gemini lsp status --server typescript-language-server
```

## 安全注意事项

### 1. 包管理器验证

自动安装仅支持以下包管理器：

- npm
- yarn
- pnpm
- pip

### 2. 确认提示

默认情况下，首次安装会提示确认：

```
LSP server 'typescript-language-server' is not installed.
Install command: npm install -g typescript-language-server typescript
Proceed with installation? (y/N)
```

设置 `skipConfirmation: true` 可跳过提示。

### 3. 超时保护

安装命令有 2 分钟超时限制，防止挂起。

### 4. 路径安全

系统会验证安装的二进制文件路径，确保在工作区或全局 bin 目录中。

## 故障排除

### 问题 1：自动安装失败

**症状**：LSP 服务器启动失败，提示命令不存在

**解决方案**：

1. 检查包管理器是否可用：`npm --version` 或 `pip --version`
2. 手动安装：`npm install -g typescript-language-server`
3. 检查 PATH 环境变量

### 问题 2：安装超时

**症状**：安装命令执行超时

**解决方案**：

1. 增加超时时间：`"timeout": 300000` (5 分钟)
2. 检查网络连接
3. 使用镜像源：
   ```bash
   npm config set registry https://registry.npmmirror.com
   ```

### 问题 3：权限错误

**症状**：EACCES permission denied

**解决方案**：

1. 使用 sudo（不推荐）
2. 修复 npm 权限：
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

## API 参考

### LspInstaller 模块

```typescript
import {
  autoInstallLspServer,
  checkLspServerInstallation,
  getInstallHint,
  LSP_INSTALL_HINTS,
} from './lsp/LspInstaller.js';

// 检查是否安装
const { installed, hint } = checkLspServerInstallation(
  'typescript-language-server',
);

// 自动安装
const result = await autoInstallLspServer('typescript-language-server', {
  enabled: true,
  allowedPackageManagers: ['npm'],
  timeout: 120000,
});

if (result.success) {
  console.log('Installation successful');
} else {
  console.error('Installation failed:', result.error);
}

// 获取安装提示
const hint = getInstallHint('clangd');
// 输出：Install via your package manager (apt, brew, etc.)
```

## 最佳实践

1. **项目级别配置**：在 `.lsp.json` 中声明项目需要的 LSP 服务器
2. **版本锁定**：使用 `package.json` 锁定 LSP 服务器版本
3. **CI/CD 集成**：在 CI 环境中预安装所需的 LSP 服务器
4. **团队协作**：将 `.lsp.json` 提交到版本控制

## 未来计划

- [ ] 支持更多包管理器（cargo, go modules）
- [ ] 自动检测项目依赖并推荐 LSP 服务器
- [ ] LSP 服务器版本管理
- [ ] 离线安装包缓存
