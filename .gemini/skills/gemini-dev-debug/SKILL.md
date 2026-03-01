# Gemini CLI 开发调试技能

## 技能描述

提供系统化的开发调试方法论，基于实际 LSP 功能优化经验总结的最佳实践。帮助开发者高效定位和解决 TypeScript/Node.js 项目中的各类问题。

## 核心调试原则

### 1. 分阶段验证原则

**问题**: 直接测试最终功能导致问题定位困难

**解决方案**: 将调试过程分为明确的阶段，每阶段验证通过后再继续

```markdown
## 调试阶段

### 阶段 1: 编译验证
- [ ] TypeScript 编译通过
- [ ] 无类型错误
- [ ] 导出导入正确

### 阶段 2: 配置验证
- [ ] 配置文件语法正确
- [ ] 配置项拼写正确
- [ ] 配置值类型匹配

### 阶段 3: 启动验证
- [ ] 服务能正常启动
- [ ] 无启动时错误
- [ ] 日志输出正常

### 阶段 4: 功能验证
- [ ] 核心功能正常
- [ ] 边界情况处理
- [ ] 错误处理完善
```

### 2. 日志分级原则

**问题**: 日志不足或过多导致问题难以定位

**解决方案**: 使用 debugLogger 分级别记录关键信息

```typescript
// ❌ 错误：没有日志
async function startServer() {
  const server = new Server();
  await server.start();
}

// ✅ 正确：分级日志
async function startServer() {
  debugLogger.log('Starting server...');
  try {
    const server = new Server();
    debugLogger.log('Server instance created');
    await server.start();
    debugLogger.log('Server started successfully');
  } catch (error) {
    debugLogger.error('Server start failed:', error);
    throw error;
  }
}
```

### 3. 构建优先原则

**问题**: 代码修改后直接测试，使用的是旧编译结果

**解决方案**: 任何代码修改后先验证编译成功

```bash
# ✅ 标准流程
npm run build -w @google/gemini-cli-core 2>&1 | grep -i error

# 如果有错误，先修复类型错误
# 编译通过后再测试功能
```

## 常见问题排查流程

### 问题 1: LSP 服务器未启动

**症状**: LSP 功能无响应，符号解析/诊断/跳转失败

**排查步骤**:

```bash
# 步骤 1: 检查服务器配置
grep -A10 "typescript.*{" packages/core/src/lsp/builtinServers.ts

# 步骤 2: 检查命令是否在 PATH 中
which typescript-language-server
typescript-language-server --version

# 步骤 3: 检查启动日志
npm start 2>&1 | grep -E "(Spawning|started successfully|failed)"

# 步骤 4: 手动测试命令
typescrypt-language-server --stdio
```

**常见原因**:
1. 命令未安装 → `npm install -g typescript-language-server`
2. 命令拼写错误 → 检查 builtinServers.ts 配置
3. 启动参数错误 → 检查 args 配置
4. 连接方式错误 → 检查 transport 配置

### 问题 2: TypeScript 编译错误

**症状**: `npm run build` 失败，显示类型错误

**排查步骤**:

```bash
# 步骤 1: 查看详细错误
npm run build -w @google/gemini-cli-core 2>&1 | grep "error TS"

# 步骤 2: 定位错误文件
# 错误信息会显示文件路径和行号

# 步骤 3: 常见错误修复
# - Property 'X' does not exist → 检查接口定义
# - Cannot find module → 检查导入路径
# - Type 'X' is not assignable → 检查类型匹配
```

**常见错误模式**:

```typescript
// ❌ 错误：访问不存在的属性
const path = process.env.PATH  // Property 'PATH' does not exist

// ✅ 正确：使用索引访问
const path = (process.env as Record<string, string>)['PATH']

// ❌ 错误：方法不存在
await this.fileExists(path)  // Property 'fileExists' does not exist

// ✅ 正确：使用已存在的方法
await this.checkFileExists(path)
```

### 问题 3: 竞态条件问题

**症状**: 并发请求时服务器启动多次，或初始化失败

**排查步骤**:

```bash
# 步骤 1: 添加并发测试
echo '诊断文件 1@file1.ts' | npm start &
echo '诊断文件 2@file2.ts' | npm start &
wait

# 步骤 2: 检查日志中的启动次数
npm start 2>&1 | grep "Spawning LSP server"

# 步骤 3: 检查引用计数
npm start 2>&1 | grep "refCount"
```

**解决方案**: 实现防竞态机制

```typescript
interface LspServerHandle {
  refCount: number;           // 引用计数
  initPromise?: Promise<void>; // 初始化锁
  isInitializing: boolean;     // 是否正在初始化
  initializingSince?: number;  // 初始化开始时间
}

async function startServer(name: string) {
  const handle = serverHandles.get(name);
  
  // 检查是否已在初始化
  if (handle.isInitializing && handle.initPromise) {
    await handle.initPromise;  // 等待现有初始化
    return;
  }
  
  // 设置初始化锁
  handle.isInitializing = true;
  handle.initPromise = doStartServer(name, handle);
  
  try {
    await handle.initPromise;
    handle.refCount++;
  } finally {
    handle.isInitializing = false;
    handle.initPromise = undefined;
  }
}
```

### 问题 4: 虚拟环境检测失败

**症状**: Python LSP 无法找到虚拟环境中的包

**排查步骤**:

```bash
# 步骤 1: 检查虚拟环境结构
ls -la .venv/bin/python
.venv/bin/python --version

# 步骤 2: 检查环境变量
echo $VIRTUAL_ENV

# 步骤 3: 检查检测逻辑
grep -A20 "potentialVenvPaths" packages/core/src/lsp/LspServerManager.ts

# 步骤 4: 添加调试日志
debugLogger.log(`Detected Python virtual environment: ${venvPath}`);
```

**正确实现**:

```typescript
async function warmupPythonServer(handle: LspServerHandle) {
  // 检测虚拟环境路径
  const potentialVenvPaths = [
    (process.env as Record<string, string>)['VIRTUAL_ENV'],
    path.join(this.workspaceRoot, '.venv'),
    path.join(this.workspaceRoot, 'venv'),
  ].filter((p): p is string => p !== undefined);

  for (const venvPath of potentialVenvPaths) {
    const pythonPath = path.join(venvPath, 'bin', 'python');
    if (await this.checkFileExists(pythonPath)) {
      // 更新初始化配置
      if (handle.config.initializationOptions) {
        (handle.config.initializationOptions as Record<string, unknown>)['pythonPath'] = pythonPath;
      }
      debugLogger.log(`Detected Python virtual environment: ${venvPath}`);
      break;
    }
  }
}
```

## 调试工具集

### 日志检查命令

```bash
# 检查 LSP 启动日志
npm start 2>&1 | grep -E "(LSP|Spawning|started|failed)"

# 检查特定服务器状态
npm start 2>&1 | grep "typescript\|python"

# 检查引用计数
npm start 2>&1 | grep "refCount"

# 检查错误信息
npm start 2>&1 | grep -E "(Error|Failed|error)"

# 实时日志监控
npm start 2>&1 | tee /tmp/gemini.log
tail -f /tmp/gemini.log | grep -E "ERROR|WARN"
```

### 构建检查命令

```bash
# 快速构建检查
npm run build -w @google/gemini-cli-core 2>&1 | grep -i error

# 完整构建
npm run build 2>&1 | tail -20

# 清理后构建（解决缓存问题）
npm run clean && npm run build

# 检查编译输出
ls -la packages/core/dist/src/lsp/
```

### 运行时检查命令

```bash
# 检查进程状态
ps aux | grep "typescript-language-server\|pyright"

# 检查端口占用
lsof -i :25417  # DevTools 端口

# 检查 Node.js 内存
node --version
npm --version

# 检查全局包
npm list -g --depth=0 | grep "typescript\|pyright"
```

## 实战案例分析

### 案例 1: Python LSP 启动失败

**问题**: Python LSP 预热时显示 "LSP connection closed"

**排查过程**:

```bash
# 1. 检查配置
grep -A10 "python.*{" packages/core/src/lsp/builtinServers.ts
# 发现：command: 'pyright' (错误)

# 2. 参考 OpenCode 实现
grep -A30 "Pyright" ~/code/opencode/packages/opencode/src/lsp/server.ts
# 发现：command: 'pyright-langserver' (正确)

# 3. 检查实际命令
which pyright
which pyright-langserver
# 发现：pyright 存在，pyright-langserver 也存在

# 4. 手动测试命令
pyright --stdio        # 失败
pyright-langserver --stdio  # 成功
```

**解决方案**:

```typescript
// ❌ 错误配置
python: {
  command: 'pyright',
  args: ['--stdio'],
}

// ✅ 正确配置
python: {
  command: 'pyright-langserver',
  args: ['--stdio'],
}
```

**经验教训**:
1. LSP 服务器命令通常有特定命名规范
2. 参考成熟项目（OpenCode）的实现
3. 手动测试命令验证可行性

### 案例 2: 并发请求导致服务器重复启动

**问题**: 同时诊断 3 个 TypeScript 文件，日志显示启动 3 次服务器

**排查过程**:

```bash
# 1. 测试并发请求
echo '诊断文件 1@file1.ts' | npm start &
echo '诊断文件 2@file2.ts' | npm start &
echo '诊断文件 3@file3.ts' | npm start &
wait

# 2. 检查日志
npm start 2>&1 | grep "Spawning LSP server"
# 发现：Spawning 出现 3 次

# 3. 参考 oh-my-opencode 实现
grep -A50 "getClient" ~/code/oh-my-opencode/src/tools/lsp/lsp-server.ts
# 发现：使用 Map 缓存 + 引用计数 + 初始化锁

# 4. 检查当前实现
grep -A20 "startServerByName" packages/core/src/lsp/LspServerManager.ts
# 发现：没有检查现有初始化
```

**解决方案**:

```typescript
interface LspServerHandle {
  refCount: number;
  initPromise?: Promise<void>;
  isInitializing: boolean;
  initializingSince?: number;
}

async function startServerByName(name: string) {
  const handle = this.serverHandles.get(name);
  const now = Date.now();
  
  // 检查是否已在初始化
  if (handle.isInitializing && handle.initPromise) {
    // 检查超时
    if (handle.initializingSince && 
        now - handle.initializingSince > DEFAULT_LSP_INIT_TIMEOUT_MS) {
      await this.cleanupFailedInitialization(handle);
    } else {
      // 等待现有初始化
      await handle.initPromise;
      handle.refCount++;
      return;
    }
  }
  
  // 开始新的初始化
  await this.initializeServerWithLock(name, handle);
}
```

**验证结果**:

```bash
# 再次测试并发请求
echo '诊断文件 1@file1.ts' | npm start &
echo '诊断文件 2@file2.ts' | npm start &
echo '诊断文件 3@file3.ts' | npm start &
wait

# 检查日志
npm start 2>&1 | grep "Spawning LSP server"
# 结果：只出现 1 次 ✅
npm start 2>&1 | grep "already running"
# 结果：第 2、3 次显示 "already running" ✅
```

**经验教训**:
1. 并发场景必须考虑竞态条件
2. 参考成熟项目的防竞态实现
3. 使用引用计数跟踪使用情况
4. 使用 Promise 锁防止重复初始化

## 检查清单模板

### 新功能开发检查清单

```markdown
## 开发阶段
- [ ] 接口定义完成 (types.ts)
- [ ] 实现代码完成
- [ ] 单元测试通过
- [ ] TypeScript 编译通过

## 集成阶段
- [ ] 配置注册完成 (builtinServers.ts)
- [ ] 语言检测配置 (LspLanguageDetector.ts)
- [ ] 自动安装配置 (LspInstaller.ts)
- [ ] 预热逻辑配置 (NativeLspService.ts)

## 测试阶段
- [ ] 单独功能测试
- [ ] 并发场景测试
- [ ] 错误处理测试
- [ ] 边界条件测试

## 文档阶段
- [ ] 代码注释完整
- [ ] 使用说明文档
- [ ] 故障排查指南
```

### 问题排查检查清单

```markdown
## 编译问题
- [ ] 检查 TypeScript 错误信息
- [ ] 检查导入路径是否正确
- [ ] 检查类型定义是否匹配
- [ ] 重新构建项目

## 运行时问题
- [ ] 检查启动日志
- [ ] 检查错误堆栈
- [ ] 检查配置文件
- [ ] 检查环境变量

## 功能问题
- [ ] 复现问题的最小用例
- [ ] 检查输入参数
- [ ] 检查输出结果
- [ ] 对比预期行为
```

## 参考资源

### 项目参考
- **OpenCode**: `~/code/opencode/packages/opencode/src/lsp/`
  - Python 虚拟环境检测
  - LSP 服务器配置
  
- **oh-my-opencode**: `~/code/oh-my-opencode/src/tools/lsp/`
  - 防竞态机制
  - 引用计数实现
  - 空闲清理机制

### 调试命令速查

```bash
# 构建
npm run build -w @google/gemini-cli-core

# 测试
echo 'test prompt' | npm start

# 日志
npm start 2>&1 | grep -E "ERROR|WARN|Spawning|refCount"

# 清理
npm run clean && npm install

# 全局包
npm install -g <package>
npm list -g --depth=0
npm uninstall -g <package>
```

## 最佳实践总结

1. **先编译后测试** - 任何修改先验证编译通过
2. **分阶段验证** - 复杂功能分多个阶段验证
3. **充分日志** - 关键路径添加调试日志
4. **参考实现** - 遇到问题先参考成熟项目
5. **并发测试** - 并发场景必须测试竞态条件
6. **错误处理** - 所有异步操作添加错误处理
7. **文档记录** - 问题和解决方案记录到文档
8. **工具自动化** - 常用调试命令封装成脚本
