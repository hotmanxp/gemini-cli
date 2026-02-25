/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LSP Server Installation Module
 * 
 * Provides automatic installation and detection of LSP servers.
 * Based on OpenCode's auto-install implementation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn as spawnProcess } from 'node:child_process';
import { LSP_INSTALL_HINTS } from './builtinServers.js';
import { debugLogger } from '../utils/debugLogger.js';

/**
 * Get environment variable safely
 */
function getEnvVar(name: string): string | undefined {
  return process.env[name as keyof typeof process.env];
}

/**
 * Check if a command is available in PATH or global bin directory
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  // Check if it's an absolute path
  if (command.includes(path.sep) || command.includes('/')) {
    return fileExists(command);
  }

  // Check in PATH
  const pathEnv = getEnvVar('PATH') ?? '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const paths = pathEnv.split(pathSeparator);

  const isWindows = process.platform === 'win32';
  const extensions = isWindows
    ? ['', '.exe', '.cmd', '.bat', '.ps1']
    : [''];

  for (const p of paths) {
    for (const ext of extensions) {
      const fullPath = path.join(p, command + ext);
      if (await fileExists(fullPath)) {
        return true;
      }
    }
  }

  // Check in global bin directory
  const globalBin = path.join(
    getEnvVar('HOME') ?? getEnvVar('USERPROFILE') ?? '',
    '.gemini',
    'lsp-servers',
    'bin',
  );
  for (const ext of extensions) {
    const fullPath = path.join(globalBin, command + ext);
    if (await fileExists(fullPath)) {
      debugLogger.log(`Command ${command} found in global bin: ${fullPath}`);
      return true;
    }
  }

  return false;
}

/**
 * Check if a file exists and is accessible
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Install options for LSP servers
 */
export interface InstallOptions {
  /** Package name to install */
  packageName: string;
  /** Command to check after installation */
  checkCommand: string;
  /** Installation command (e.g., 'npm install -g') */
  installCommand: string[];
  /** Optional: additional arguments for install command */
  installArgs?: string[];
  /** Optional: environment variables for installation */
  env?: Record<string, string>;
  /** Optional: working directory for installation */
  cwd?: string;
}

/**
 * Result of installation attempt
 */
export interface InstallResult {
  /** Whether installation was successful */
  success: boolean;
  /** Error message if installation failed */
  error?: string;
  /** Whether package was already installed */
  alreadyInstalled: boolean;
}

/**
 * Install an LSP server using npm/pip/go/etc.
 */
export async function installLspServer(
  serverName: string,
  options: InstallOptions
): Promise<InstallResult> {
  const {
    packageName,
    checkCommand,
    installCommand,
    installArgs = [],
    env = {},
    cwd,
  } = options;

  // Check if already installed
  const alreadyInstalled = await isCommandAvailable(checkCommand);
  if (alreadyInstalled) {
    debugLogger.log(`LSP server ${serverName} (${checkCommand}) is already installed`);
    return { success: true, alreadyInstalled: true };
  }

  // Check if auto-install is disabled
  if (getEnvVar('GEMINI_CLI_DISABLE_LSP_AUTO_INSTALL') === '1') {
    debugLogger.warn(
      `Auto-installation disabled. Please install ${serverName} manually: ${LSP_INSTALL_HINTS[serverName] ?? 'See documentation'}`
    );
    return {
      success: false,
      error: 'Auto-installation is disabled',
      alreadyInstalled: false,
    };
  }

  debugLogger.log(`Installing LSP server ${serverName} (${packageName})...`);
  debugLogger.log(`Install command: ${installCommand.join(' ')} ${packageName} ${installArgs.join(' ')}`);

  try {
    const installEnv = {
      ...process.env,
      ...env,
    };

    // Run installation command
    const [cmd, ...args] = [...installCommand, packageName, ...installArgs];
    debugLogger.log(`Running: ${cmd} ${args.join(' ')}`);
    const result = await runCommand(cmd, args, {
      env: installEnv,
      cwd,
    });

    if (result.success) {
      // Verify installation
      const installed = await isCommandAvailable(checkCommand);
      if (installed) {
        debugLogger.log(`Successfully installed ${serverName}`);
        return { success: true, alreadyInstalled: false };
      } else {
        debugLogger.warn(
          `Installation completed but ${checkCommand} not found in PATH`
        );
        return {
          success: false,
          error: 'Package installed but command not found',
          alreadyInstalled: false,
        };
      }
    } else {
      debugLogger.error(`Failed to install ${serverName}: ${result.error}`);
      return {
        success: false,
        error: result.error,
        alreadyInstalled: false,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLogger.error(`Installation of ${serverName} failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
      alreadyInstalled: false,
    };
  }
}

/**
 * Run a shell command and return the result
 */
async function runCommand(
  cmd: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; cwd?: string } = {}
): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawnProcess(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env,
      cwd: options.cwd,
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
      debugLogger.log(`[stdout] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      debugLogger.log(`[stderr] ${data.toString().trim()}`);
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        stdout,
        stderr,
        error: error.message,
      });
    });

    child.on('exit', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        error: code !== 0 ? `Exit code ${code}` : undefined,
      });
    });
  });
}

/**
 * Predefined installation configurations for common LSP servers
 */
export const INSTALL_CONFIGS: Record<
  string,
  Omit<InstallOptions, 'packageName' | 'checkCommand'>
> = {
  // npm packages
  typescript: {
    installCommand: ['npm', 'install', '-g'],
  },
  vue: {
    installCommand: ['npm', 'install', '-g'],
  },
  svelte: {
    installCommand: ['npm', 'install', '-g'],
  },
  yaml: {
    installCommand: ['npm', 'install', '-g'],
  },
  bash: {
    installCommand: ['npm', 'install', '-g'],
  },
  sql: {
    installCommand: ['npm', 'install', '-g'],
  },
  markdownlint: {
    installCommand: ['npm', 'install', '-g'],
  },
  json: {
    installCommand: ['npm', 'install', '-g'],
  },
  css: {
    installCommand: ['npm', 'install', '-g'],
  },
  html: {
    installCommand: ['npm', 'install', '-g'],
  },
  eslint: {
    installCommand: ['npm', 'install', '-g'],
  },
  oxlint: {
    installCommand: ['npm', 'install', '-g'],
  },
  biome: {
    installCommand: ['npm', 'install', '-g'],
  },
  astro: {
    installCommand: ['npm', 'install', '-g'],
  },
  dockerfile: {
    installCommand: ['npm', 'install', '-g'],
  },
 intelephense: {
    installCommand: ['npm', 'install', '-g'],
  },

  // pip packages
  python: {
    installCommand: ['pip', 'install', '--user'],
  },
  pyright: {
    installCommand: ['pip', 'install', '--user'],
  },
  pylsp: {
    installCommand: ['pip', 'install', '--user'],
  },
  ruff: {
    installCommand: ['pip', 'install', '--user'],
  },

  // go packages
  gopls: {
    installCommand: ['go', 'install', 'golang.org/x/tools/gopls@latest'],
  },

  // dotnet tools
  csharp: {
    installCommand: ['dotnet', 'tool', 'install', '-g'],
  },
  fsharp: {
    installCommand: ['dotnet', 'tool', 'install', '-g'],
  },
};

/**
 * Get installation configuration for an LSP server
 */
export function getInstallConfig(serverName: string): InstallOptions | null {
  const baseConfig = INSTALL_CONFIGS[serverName];
  if (!baseConfig) {
    return null;
  }

  // Map server name to package name and check command
  const mappings: Record<string, { packageName: string; checkCommand: string }> =
    {
      typescript: {
        packageName: 'typescript-language-server',
        checkCommand: 'typescript-language-server',
      },
      vue: {
        packageName: '@vue/language-server',
        checkCommand: 'vue-language-server',
      },
      svelte: {
        packageName: 'svelte-language-server',
        checkCommand: 'svelteserver',
      },
      yaml: {
        packageName: 'yaml-language-server',
        checkCommand: 'yaml-language-server',
      },
      bash: {
        packageName: 'bash-language-server',
        checkCommand: 'bash-language-server',
      },
      sql: {
        packageName: 'sql-language-server',
        checkCommand: 'sql-language-server',
      },
      markdownlint: {
        packageName: 'markdownlint-cli',
        checkCommand: 'markdownlint',
      },
      json: {
        packageName: 'vscode-json-languageserver',
        checkCommand: 'vscode-json-languageserver',
      },
      css: {
        packageName: 'vscode-css-languageserver-bin',
        checkCommand: 'vscode-css-languageserver-bin',
      },
      html: {
        packageName: 'vscode-html-languageserver-bin',
        checkCommand: 'html-languageserver',
      },
      eslint: {
        packageName: 'vscode-langservers-extracted',
        checkCommand: 'vscode-eslint-language-server',
      },
      oxlint: {
        packageName: 'oxlint',
        checkCommand: 'oxlint',
      },
      biome: {
        packageName: '@biomejs/biome',
        checkCommand: 'biome',
      },
      astro: {
        packageName: '@astrojs/language-server',
        checkCommand: 'astro-ls',
      },
      dockerfile: {
        packageName: 'dockerfile-language-server-nodejs',
        checkCommand: 'docker-langserver',
      },
      intelephense: {
        packageName: 'intelephense',
        checkCommand: 'intelephense',
      },
      python: {
        packageName: 'python-lsp-server',
        checkCommand: 'pylsp',
      },
      pyright: {
        packageName: 'pyright',
        checkCommand: 'pyright-langserver',
      },
      pylsp: {
        packageName: 'python-lsp-server',
        checkCommand: 'pylsp',
      },
      ruff: {
        packageName: 'ruff',
        checkCommand: 'ruff',
      },
      gopls: {
        packageName: 'golang.org/x/tools/gopls@latest',
        checkCommand: 'gopls',
      },
      csharp: {
        packageName: 'csharp-ls',
        checkCommand: 'csharp-ls',
      },
      fsharp: {
        packageName: 'fsautocomplete',
        checkCommand: 'fsautocomplete',
      },
    };

  const mapping = mappings[serverName];
  if (!mapping) {
    return null;
  }

  return {
    packageName: mapping.packageName,
    checkCommand: mapping.checkCommand,
    ...baseConfig,
  };
}

/**
 * Try to auto-install an LSP server if it's not available
 */
export async function tryAutoInstallLspServer(
  serverName: string,
  command: string
): Promise<{ installed: boolean; error?: string }> {
  // Check if already available
  if (await isCommandAvailable(command)) {
    return { installed: true };
  }

  // Get install config
  const config = getInstallConfig(serverName);
  if (!config) {
    return {
      installed: false,
      error: `No auto-install configuration for ${serverName}`,
    };
  }

  // Try to install
  const result = await installLspServer(serverName, {
    ...config,
    packageName: config.packageName,
    checkCommand: config.checkCommand,
  });

  if (result.success) {
    return { installed: true };
  } else {
    return {
      installed: false,
      error: result.error ?? 'Installation failed',
    };
  }
}

/**
 * Get installation hint for an LSP server
 */
export function getInstallationHint(serverName: string): string {
  return (
    LSP_INSTALL_HINTS[serverName] ??
    `Please install ${serverName} LSP server manually`
  );
}
