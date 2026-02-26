/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * JDTLS (Java Language Server) Installation Module
 *
 * Provides automatic download and installation of JDTLS.
 * Based on OpenCode's JDTLS implementation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn as spawnProcess } from 'node:child_process';
import { debugLogger } from '../utils/debugLogger.js';

/**
 * JDTLS installation result
 */
export interface JdtlsInstallResult {
  /** Whether installation was successful */
  success: boolean;
  /** Installation directory */
  installDir?: string;
  /** Launcher JAR path */
  launcherJar?: string;
  /** Config directory */
  configDir?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * JDTLS spawn result
 */
export interface JdtlsSpawnResult {
  /** Process handle */
  process: ReturnType<typeof spawnProcess>;
  /** Data directory (temporary) */
  dataDir: string;
}

/**
 * Global bin directory for LSP servers
 */
function getGlobalBinDir(): string {
  return path.join(
    process.env['HOME'] ?? process.env['USERPROFILE'] ?? os.homedir(),
    '.gemini',
    'lsp-servers',
  );
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
 * Check if a directory exists
 */
async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get Java version from 'java -version' output
 */
export async function getJavaVersion(): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawnProcess('java', ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', () => {
      resolve(null);
    });

    child.on('exit', () => {
      // Parse version from stderr (java -version outputs to stderr)
      // Example: 'openjdk version "21.0.1" 2023-10-17' or '"21" 2023-03-21'
      const match = /"(\d+)(?:\.\d+)*"/.exec(stderr);
      if (match) {
        const version = parseInt(match[1], 10);
        if (!isNaN(version)) {
          resolve(version);
          return;
        }
      }
      resolve(null);
    });
  });
}

/**
 * Check if Java is available and meets minimum version requirement
 */
export async function checkJavaPrerequisites(minVersion = 21): Promise<{
  available: boolean;
  version?: number;
  error?: string;
}> {
  const javaPath = await findJava();
  if (!javaPath) {
    return {
      available: false,
      error: 'Java is not installed. Please install Java 21 or newer.',
    };
  }

  const version = await getJavaVersion();
  if (!version) {
    return {
      available: false,
      error: 'Failed to detect Java version.',
    };
  }

  if (version < minVersion) {
    return {
      available: false,
      version,
      error: `Java ${minVersion} or newer is required. Found: Java ${version}`,
    };
  }

  return {
    available: true,
    version,
  };
}

/**
 * Find Java executable in PATH
 */
async function findJava(): Promise<string | null> {
  const pathEnv = process.env['PATH'] ?? '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const paths = pathEnv.split(pathSeparator);

  const isWindows = process.platform === 'win32';
  const extensions = isWindows ? ['.exe', '.cmd', '.bat'] : [''];

  for (const p of paths) {
    for (const ext of extensions) {
      const fullPath = path.join(p, 'java' + ext);
      if (await fileExists(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Get JDTLS installation directory
 */
function getJdtlsInstallDir(): string {
  return path.join(getGlobalBinDir(), 'jdtls');
}

/**
 * Get JDTLS config directory based on platform
 */
function getJdtlsConfigDir(installDir: string): string {
  const configDirMap: Record<string, string> = {
    darwin: 'config_mac',
    linux: 'config_linux',
    win32: 'config_win',
  };
  const platform = process.platform as keyof typeof configDirMap;
  return path.join(installDir, configDirMap[platform] ?? 'config_linux');
}

/**
 * Download JDTLS from Eclipse
 */
async function downloadJdtls(installDir: string): Promise<{
  success: boolean;
  error?: string;
}> {
  debugLogger.log('Downloading JDTLS LSP server...');

  try {
    // Create install directory
    await fs.promises.mkdir(installDir, { recursive: true });

    const releaseUrl =
      'https://www.eclipse.org/downloads/download.php?file=/jdtls/snapshots/jdt-language-server-latest.tar.gz';
    const archiveName = 'release.tar.gz';
    const archivePath = path.join(installDir, archiveName);

    debugLogger.log(`Downloading from: ${releaseUrl}`);
    debugLogger.log(`Saving to: ${archivePath}`);

    // Download using curl
    const curlResult = await runCommand(
      'curl',
      ['-L', '-o', archivePath, releaseUrl],
      { cwd: installDir },
    );

    if (!curlResult.success) {
      return {
        success: false,
        error: `Failed to download JDTLS: ${curlResult.error}`,
      };
    }

    debugLogger.log('Extracting JDTLS archive...');

    // Extract archive
    const tarResult = await runCommand('tar', ['-xzf', archiveName], {
      cwd: installDir,
    });

    if (!tarResult.success) {
      return {
        success: false,
        error: `Failed to extract JDTLS: ${tarResult.error}`,
      };
    }

    // Clean up archive
    await fs.promises.unlink(archivePath).catch(() => {});

    debugLogger.log('JDTLS download and extraction completed successfully.');

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `JDTLS installation failed: ${errorMessage}`,
    };
  }
}

/**
 * Find launcher JAR in JDTLS plugins directory
 */
async function findLauncherJar(pluginsDir: string): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(pluginsDir);
    const launcherJar = entries.find(
      (name) =>
        name.startsWith('org.eclipse.equinox.launcher_') &&
        name.endsWith('.jar'),
    );
    if (launcherJar) {
      return path.join(pluginsDir, launcherJar);
    }
  } catch (error) {
    debugLogger.error('Failed to read JDTLS plugins directory:', error);
  }
  return null;
}

/**
 * Install JDTLS if not already installed
 */
export async function installJdtls(): Promise<JdtlsInstallResult> {
  const installDir = getJdtlsInstallDir();
  const pluginsDir = path.join(installDir, 'plugins');

  // Check if already installed
  const installed = await dirExists(pluginsDir);
  if (installed) {
    debugLogger.log('JDTLS is already installed.');
    const launcherJar = await findLauncherJar(pluginsDir);
    if (!launcherJar) {
      return {
        success: false,
        error: 'JDTLS plugins directory found but launcher JAR is missing.',
      };
    }
    return {
      success: true,
      installDir,
      launcherJar,
      configDir: getJdtlsConfigDir(installDir),
    };
  }

  // Check Java prerequisites
  const javaCheck = await checkJavaPrerequisites(21);
  if (!javaCheck.available) {
    return {
      success: false,
      error: javaCheck.error ?? 'Java 21 or newer is required.',
    };
  }

  debugLogger.log(`Java version: ${javaCheck.version}`);

  // Check if user manually placed release.tar.gz (offline installation support)
  const archivePath = path.join(installDir, 'release.tar.gz');
  const manualInstallAvailable = await fileExists(archivePath);

  if (manualInstallAvailable) {
    debugLogger.log('Found manually placed release.tar.gz, extracting...');
    const tarResult = await runCommand('tar', ['-xzf', 'release.tar.gz'], {
      cwd: installDir,
    });

    if (!tarResult.success) {
      return {
        success: false,
        error: `Failed to extract JDTLS: ${tarResult.error}`,
      };
    }

    // Clean up archive
    await fs.promises.unlink(archivePath).catch(() => {});
    debugLogger.log('JDTLS offline installation completed successfully.');
  } else {
    // Download and install JDTLS from network
    const installResult = await downloadJdtls(installDir);
    if (!installResult.success) {
      return installResult;
    }
  }

  // Find launcher JAR
  const launcherJar = await findLauncherJar(pluginsDir);
  if (!launcherJar) {
    return {
      success: false,
      error: 'Failed to locate JDTLS launcher JAR after installation.',
    };
  }

  return {
    success: true,
    installDir,
    launcherJar,
    configDir: getJdtlsConfigDir(installDir),
  };
}

/**
 * Spawn JDTLS process
 */
export async function spawnJdtls(
  workspaceRoot: string,
): Promise<JdtlsSpawnResult | null> {
  // Check/install JDTLS
  const installResult = await installJdtls();
  if (
    !installResult.success ||
    !installResult.launcherJar ||
    !installResult.configDir
  ) {
    debugLogger.error('Failed to install JDTLS:', installResult.error);
    return null;
  }

  // Create temporary data directory (unique per session)
  const dataDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'gemini-jdtls-data-'),
  );

  const { launcherJar, configDir } = installResult;

  debugLogger.log(`Starting JDTLS with data dir: ${dataDir}`);

  // Build JVM arguments
  const args = [
    '-jar',
    launcherJar,
    '-configuration',
    configDir,
    '-data',
    dataDir,
    '-Declipse.application=org.eclipse.jdt.ls.core.id1',
    '-Dosgi.bundles.defaultStartLevel=4',
    '-Declipse.product=org.eclipse.jdt.ls.core.product',
    '-Dlog.level=ALL',
    '--add-modules=ALL-SYSTEM',
    '--add-opens',
    'java.base/java.util=ALL-UNNAMED',
    '--add-opens',
    'java.base/java.lang=ALL-UNNAMED',
  ];

  const process = spawnProcess('java', args, {
    cwd: workspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  process.on('error', (error) => {
    debugLogger.error('JDTLS process error:', error);
  });

  process.on('exit', (code) => {
    debugLogger.log(`JDTLS exited with code: ${code}`);
    // Clean up data directory
    fs.promises.rm(dataDir, { recursive: true, force: true }).catch(() => {});
  });

  return { process, dataDir };
}

/**
 * Run a shell command and return the result
 */
async function runCommand(
  cmd: string,
  args: string[],
  options: { cwd?: string } = {},
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const child = spawnProcess(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
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
 * Get installation hint for JDTLS
 */
export function getJdtlsInstallationHint(): string {
  return `JDTLS (Java Language Server) installation:
1. Ensure Java 21 or newer is installed and in PATH
2. JDTLS will be automatically downloaded to ~/.gemini/lsp-servers/jdtls
3. Manual installation: Visit https://github.com/eclipse-jdtls/eclipse.jdt.ls`;
}
