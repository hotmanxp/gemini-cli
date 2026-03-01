# Gemini CLI 语言支持扩展

> 更新日期：2026-02-25  
> 新增语言：10 种

---

## 概述

Gemini CLI 现已支持 **16 种编程语言**，新增 10 种最常用的语言：

### 新增语言 (10 种)

| 语言           | LSP 服务器             | 文件扩展名                 | 安装命令                                | 自动安装 |
| -------------- | ---------------------- | -------------------------- | --------------------------------------- | -------- |
| **Vue**        | vue-language-server    | `.vue`                     | `npm install -g @vue/language-server`   | ✅       |
| **Svelte**     | svelte-language-server | `.svelte`                  | `npm install -g svelte-language-server` | ✅       |
| **C/C++**      | clangd                 | `.c`, `.cpp`, `.h`, `.hpp` | 系统包管理器                            | ❌       |
| **PHP**        | intelephense           | `.php`, `.phtml`           | `npm install -g intelephense`           | ✅       |
| **Ruby**       | ruby-lsp               | `.rb`, `.erb`, `Gemfile`   | `gem install ruby-lsp`                  | ❌       |
| **YAML**       | yaml-language-server   | `.yaml`, `.yml`            | `npm install -g yaml-language-server`   | ✅       |
| **Bash/Shell** | bash-language-server   | `.sh`, `.bash`, `.zsh`     | `npm install -g bash-language-server`   | ✅       |
| **Terraform**  | terraform-ls           | `.tf`, `.tfvars`           | `brew install terraform-ls`             | ❌       |
| **SQL**        | sql-language-server    | `.sql`, `.dsql`            | `npm install -g sql-language-server`    | ✅       |
| **Markdown**   | markdownlint           | `.md`, `.markdown`         | `npm install -g markdownlint-cli`       | ✅       |

### 原有语言 (6 种)

| 语言                  | LSP 服务器                 | 文件扩展名                   |
| --------------------- | -------------------------- | ---------------------------- |
| TypeScript/JavaScript | typescript-language-server | `.ts`, `.tsx`, `.js`, `.jsx` |
| Python                | pyright/pylsp              | `.py`, `.pyi`                |
| Java                  | jdtls                      | `.java`                      |
| Go                    | gopls                      | `.go`                        |
| Rust                  | rust-analyzer              | `.rs`                        |

---

## 快速开始

### 1. 自动检测

Gemini CLI 会自动检测项目中的文件类型，并启动相应的 LSP 服务器。

```bash
# 在项目根目录运行
gemini

# 自动检测到的语言将启动对应的 LSP 服务器
```

### 2. 手动配置

创建 `.lsp.json` 文件：

```json
{
  "vue": {
    "command": "vue-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true
    }
  },
  "cpp": {
    "command": "clangd",
    "args": ["--background-index", "--clang-tidy"]
  },
  "yaml": {
    "command": "yaml-language-server",
    "args": ["--stdio"],
    "autoInstall": {
      "enabled": true
    }
  }
}
```

### 3. 安装 LSP 服务器

#### 自动安装（推荐）

启用自动安装后，缺失的 LSP 服务器会自动安装：

```json
{
  "lsp": {
    "autoInstall": {
      "enabled": true,
      "allowedPackageManagers": ["npm", "yarn", "pnpm", "pip"]
    }
  }
}
```

#### 手动安装

**Vue**:

```bash
npm install -g @vue/language-server
```

**Svelte**:

```bash
npm install -g svelte-language-server
```

**C/C++**:

```bash
# Ubuntu/Debian
sudo apt install clangd

# macOS
brew install llvm

# Windows
# 下载 https://releases.llvm.org
```

**PHP**:

```bash
npm install -g intelephense
```

**Ruby**:

```bash
gem install ruby-lsp
```

**YAML**:

```bash
npm install -g yaml-language-server
```

**Bash/Shell**:

```bash
npm install -g bash-language-server
```

**Terraform**:

```bash
# macOS
brew install terraform-ls

# 或其他安装方式
# https://github.com/hashicorp/terraform-ls
```

**SQL**:

```bash
npm install -g sql-language-server
```

**Markdown**:

```bash
npm install -g markdownlint-cli
```

---

## 语言特性

### Vue

**支持的功能**：

- 模板语法高亮
- 组件属性提示
- TypeScript/JavaScript 支持
- CSS/SCSS 支持
- 跳转到定义

**文件类型**：

- `.vue` - Vue 单文件组件

**配置示例**：

```json
{
  "vue": {
    "command": "vue-language-server",
    "args": ["--stdio"],
    "initializationOptions": {
      "vue": {
        "hybridMode": false
      }
    }
  }
}
```

### Svelte

**支持的功能**：

- Svelte 模板语法
- TypeScript 支持
- CSS 作用域
- 组件跳转

**文件类型**：

- `.svelte` - Svelte 组件

**配置示例**：

```json
{
  "svelte": {
    "command": "svelte-language-server",
    "args": ["--stdio"]
  }
}
```

### C/C++

**支持的功能**：

- 代码补全
- 跳转到定义
- 查找引用
- 诊断检查
- Clang-Tidy 集成

**文件类型**：

- `.c` - C 源文件
- `.cpp`, `.cc`, `.cxx` - C++ 源文件
- `.h`, `.hpp` - 头文件

**配置示例**：

```json
{
  "cpp": {
    "command": "clangd",
    "args": [
      "--background-index",
      "--clang-tidy",
      "--completion-style=detailed"
    ]
  }
}
```

### PHP

**支持的功能**：

- 代码补全
- 类型推断
- 命名空间解析
- 重构支持

**文件类型**：

- `.php` - PHP 源文件
- `.php4`, `.php5` - 旧版本 PHP
- `.phtml` - PHP 模板

**配置示例**：

```json
{
  "php": {
    "command": "intelephense",
    "args": ["--stdio"],
    "initializationOptions": {
      "licenceKey": "YOUR_KEY" // 可选，用于高级功能
    }
  }
}
```

### Ruby

**支持的功能**：

- 代码补全
- 诊断检查
- 格式化
- 文档悬停

**文件类型**：

- `.rb` - Ruby 源文件
- `.erb` - Embedded Ruby 模板
- `Gemfile` - Bundler 依赖
- `Rakefile` - Rake 构建文件

**配置示例**：

```json
{
  "ruby": {
    "command": "ruby-lsp",
    "args": []
  }
}
```

### YAML

**支持的功能**：

- JSON Schema 验证
- 自动补全
- 悬停文档
- 诊断检查

**文件类型**：

- `.yaml`, `.yml` - YAML 文件

**配置示例**：

```json
{
  "yaml": {
    "command": "yaml-language-server",
    "args": ["--stdio"],
    "initializationOptions": {
      "schemas": {
        "https://json.schemastore.org/github-workflow.json": ".github/workflows/*.yml"
      }
    }
  }
}
```

### Bash/Shell

**支持的功能**：

- 语法检查
- 代码补全
- 跳转到定义
- 悬停文档

**文件类型**：

- `.sh` - Shell 脚本
- `.bash` - Bash 脚本
- `.zsh` - Zsh 脚本
- `.bashrc`, `.bash_profile` - Bash 配置文件

**配置示例**：

```json
{
  "bash": {
    "command": "bash-language-server",
    "args": ["start"]
  }
}
```

### Terraform

**支持的功能**：

- HCL 语法支持
- 资源补全
- 验证检查
- 跳转到定义

**文件类型**：

- `.tf` - Terraform 配置
- `.tfvars` - 变量值

**配置示例**：

```json
{
  "terraform": {
    "command": "terraform-ls",
    "args": ["serve"]
  }
}
```

### SQL

**支持的功能**：

- 语法高亮
- 代码补全
- 诊断检查
- 格式化

**文件类型**：

- `.sql` - SQL 查询文件
- `.dsql` - 分布式 SQL

**配置示例**：

```json
{
  "sql": {
    "command": "sql-language-server",
    "args": ["up", "--stdio"],
    "initializationOptions": {
      "dialect": "postgresql"
    }
  }
}
```

### Markdown

**支持的功能**：

- Markdown 语法检查
- 链接验证
- 格式化建议
- Lint 规则

**文件类型**：

- `.md` - Markdown 文档
- `.markdown` - Markdown 文档
- `.mdown` - Markdown 文档

**配置示例**：

```json
{
  "markdown": {
    "command": "markdownlint",
    "args": ["--stdio"]
  }
}
```

---

## 项目示例

### Vue 项目

```bash
my-vue-app/
├── src/
│   ├── components/
│   │   └── HelloWorld.vue
│   ├── App.vue
│   └── main.ts
├── package.json
└── .lsp.json
```

**.lsp.json**:

```json
{
  "vue": {
    "command": "vue-language-server",
    "autoInstall": {
      "enabled": true
    }
  },
  "typescript": {
    "command": "typescript-language-server",
    "autoInstall": {
      "enabled": true
    }
  }
}
```

### C++ 项目

```bash
my-cpp-project/
├── src/
│   ├── main.cpp
│   └── utils.h
├── include/
│   └── config.h
├── CMakeLists.txt
└── .lsp.json
```

**.lsp.json**:

```json
{
  "cpp": {
    "command": "clangd",
    "args": ["--background-index", "--clang-tidy"]
  }
}
```

### Ruby on Rails 项目

```bash
my-rails-app/
├── app/
│   ├── controllers/
│   ├── models/
│   └── views/
├── Gemfile
├── config.ru
└── .lsp.json
```

**.lsp.json**:

```json
{
  "ruby": {
    "command": "ruby-lsp"
  },
  "erb": {
    "command": "ruby-lsp"
  }
}
```

### Terraform 项目

```bash
terraform-infra/
├── modules/
│   └── vpc/
│       └── main.tf
├── environments/
│   └── production/
│       ├── main.tf
│       └── variables.tf
└── .lsp.json
```

**.lsp.json**:

```json
{
  "terraform": {
    "command": "terraform-ls",
    "args": ["serve"]
  }
}
```

### 多语言项目

```bash
fullstack-app/
├── frontend/
│   ├── src/
│   │   ├── components/  # Vue
│   │   └── styles/      # CSS/SCSS
│   └── package.json
├── backend/
│   ├── src/             # Python
│   └── requirements.txt
├── infrastructure/
│   └── main.tf          # Terraform
├── scripts/
│   └── deploy.sh        # Bash
└── docs/
    └── README.md        # Markdown
```

**.lsp.json**:

```json
{
  "vue": {
    "command": "vue-language-server",
    "autoInstall": true
  },
  "python": {
    "command": "pyright",
    "autoInstall": true
  },
  "terraform": {
    "command": "terraform-ls"
  },
  "bash": {
    "command": "bash-language-server",
    "autoInstall": true
  },
  "markdown": {
    "command": "markdownlint",
    "autoInstall": true
  },
  "yaml": {
    "command": "yaml-language-server",
    "autoInstall": true
  }
}
```

---

## 故障排除

### 问题 1: LSP 服务器未启动

**症状**: 打开文件后没有 LSP 功能

**解决方案**:

1. 检查 `.lsp.json` 配置是否正确
2. 运行 `gemini lsp status` 查看服务器状态
3. 手动安装 LSP 服务器

### 问题 2: 自动安装失败

**症状**: 提示自动安装失败

**解决方案**:

1. 检查包管理器是否可用：`npm --version`
2. 检查网络连接
3. 手动安装：`npm install -g <package-name>`

### 问题 3: C/C++ clangd 未找到

**症状**: clangd 命令不存在

**解决方案**:

```bash
# Ubuntu/Debian
sudo apt install clangd

# macOS
brew install llvm

# Windows
# 从 https://releases.llvm.org 下载
```

### 问题 4: Ruby-lsp 无法启动

**症状**: ruby-lsp 命令不存在

**解决方案**:

```bash
# 确保已安装 Ruby
ruby --version

# 安装 ruby-lsp
gem install ruby-lsp

# 如果权限错误
gem install --user-install ruby-lsp
```

---

## 性能优化

### 1. 按需启动

只为项目实际使用的语言启用 LSP：

```json
{
  "vue": {
    "command": "vue-language-server"
  }
  // 不需要的语言不要配置
}
```

### 2. 使用自动安装

启用自动安装，减少手动配置：

```json
{
  "lsp": {
    "autoInstall": {
      "enabled": true
    }
  }
}
```

### 3. 共享服务器

多个项目共享同一个 LSP 服务器实例：

```bash
# LSP 服务器会在第一个项目启动
# 后续项目复用该服务器
```

---

## 贡献新语言

如果你想添加新的语言支持：

1. 在 `languages.ts` 中添加配置
2. 在 `LspInstaller.ts` 中添加安装信息
3. 在 `LspConfigLoader.ts` 中添加预设
4. 更新本文档

### 模板

```typescript
// languages.ts
export const myLanguageConfig: LspServerConfig = {
  languageId: 'my-language',
  extensions: ['.myext'],
  command: 'my-language-server',
  args: ['--stdio'],
};

// 添加到 supportedLanguages 数组
export const supportedLanguages: LspServerConfig[] = [
  // ... existing
  myLanguageConfig,
];
```

---

## 总结

现在 Gemini CLI 支持 **16 种编程语言**：

- ✅ TypeScript/JavaScript
- ✅ Python
- ✅ Java
- ✅ Go
- ✅ Rust
- ✅ **Vue** (新增)
- ✅ **Svelte** (新增)
- ✅ **C/C++** (新增)
- ✅ **PHP** (新增)
- ✅ **Ruby** (新增)
- ✅ **YAML** (新增)
- ✅ **Bash/Shell** (新增)
- ✅ **Terraform** (新增)
- ✅ **SQL** (新增)
- ✅ **Markdown** (新增)

其中 **8 种语言支持自动安装**，让开发更加便捷！
