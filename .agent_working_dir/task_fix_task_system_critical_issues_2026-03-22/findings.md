# Findings & Decisions: Task System Critical Issues

## 任务目标
修复 Gemini CLI task 系统的 3 个高优先级问题：
1. 状态管理竞态条件
2. 上下文隔离缺失  
3. 错误恢复机制不足

并添加完善的日志系统，通过 `npm start --prompt "xxxx"` 实际调用验证。

## 架构分析

### Task 系统核心组件

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| **TaskTool** | `packages/core/src/tools/task/task-tool.ts` | 用户请求入口，创建后台任务 |
| **BackgroundManager** | `packages/core/src/background/background-manager.ts` | 任务生命周期管理、并发控制、状态跟踪 |
| **SessionManager** | `packages/core/src/background/session/session-manager.ts` | 子会话创建、子代理执行 |
| **TaskLogger** | `packages/core/src/background/task-logger.ts` | 任务日志记录和持久化 |

### 任务执行流程

```
user → TaskTool → BackgroundManager.launch() → Queue → 
ConcurrencyManager → SessionManager.create() → 
LocalAgentExecutor.run() → TaskLogger
```

---

## 问题详细分析

### 问题 1: 状态管理竞态条件 ⚠️ HIGH

**位置**: `background-manager.ts:196, 341` 及多处

**症状**:
```typescript
// 行 196: startTask 中直接修改状态
task.status = 'running';

// 行 341: completeTask 中直接修改状态  
task.status = status;

// 行 98, 108: cancelTask 中直接修改状态
task.status = 'cancelled';
```

**问题**:
- ❌ 无锁保护，多个异步操作可同时修改 `task.status`
- ❌ `processKey()` 并发处理多个任务时可能读取 stale state
- ❌ `pollRunningTasks()` 轮询时可能与其他操作冲突

**影响**:
- 任务可能卡在 inconsistent states
- 取消操作可能失效
- 进度更新可能丢失

---

### 问题 2: 上下文隔离缺失 ⚠️ HIGH

**位置**: `session-manager.ts:109-135`

**症状**:
```typescript
const context: AgentLoopContext = {
  config: this.config,  // ← 直接传递引用！
  promptId: session.sessionID,
  // ...
};
```

**问题**:
- ❌ 子任务与父 session 共享同一 `config` 对象（引用传递）
- ❌ 无深克隆隔离边界
- ❌ 子任务可修改共享状态影响父 session

**影响**:
- 数据污染
- 不可预测的行为
- 调试困难

---

### 问题 3: 错误恢复不足 ⚠️ MEDIUM

**位置**: `background-manager.ts:257-283`

**症状**:
```typescript
catch (error) {
  // 仅记录错误，无重试逻辑
  task.status = 'error';
  TaskLogger.update(...)
}
```

**问题**:
- ❌ 无重试机制（网络抖动等临时错误直接失败）
- ❌ 资源清理在 finally 中但无错误分类处理
- ❌ 无指数退避策略

**影响**:
- 临时性错误导致永久失败
- 资源可能泄漏

---

### 问题 4: 日志系统不完善 ⚠️ MEDIUM

**位置**: `task-logger.ts` 全局使用 `debugLogger`

**症状**:
- ✅ 已有日志持久化机制（JSON 文件）
- ❌ 仅依赖 `debugLogger`，无结构化日志
- ❌ 无日志级别控制（INFO/WARN/ERROR）
- ❌ 无日志聚合查看工具

---

## 现有测试覆盖

- ❌ **无** `background-manager.test.ts` 测试文件
- ❌ **无** `session-manager.test.ts` 测试文件  
- ⚠️ 缺少并发状态更新测试
- ⚠️ 缺少取消传播测试
- ⚠️ 缺少错误恢复测试

---

## 设计方案

### 方案 A: 轻量级修复（推荐）

**核心思路**: 最小改动，快速验证

#### 1. 状态管理 - 使用 `async-mutex` 库
```typescript
import { Mutex } from 'async-mutex';

class BackgroundManager {
  private stateMutex = new Mutex();
  
  async updateTaskState(taskId: string, newStatus: string): Promise<void> {
    const release = await this.stateMutex.acquire();
    try {
      const task = this.tasks.get(taskId);
      if (!task) throw new Error('Task not found');
      
      // 状态机验证
      if (!this.isValidTransition(task.status, newStatus)) {
        throw new Error(`Invalid transition: ${task.status} → ${newStatus}`);
      }
      
      task.status = newStatus;
      TaskLogger.addEntry(taskId, 'STATE_CHANGED', { from, to: newStatus });
    } finally {
      release();
    }
  }
}
```

#### 2. 上下文隔离 - 深克隆 config
```typescript
import { createDeepCopy } from '../utils/deep-copy.js';

const childContext = {
  ...parentContext,
  config: createDeepCopy(parentContext.config), // 深克隆
  promptId: session.sessionID, // 独立 session ID
};
```

#### 3. 错误恢复 - 重试包装器
```typescript
async executeWithRetry<T>(
  operation: () => Promise<T>,
  taskId: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (!this.isRetryable(error)) {
        throw error; // 非重试able 错误直接抛出
      }
      
      TaskLogger.addEntry(taskId, 'RETRY_ATTEMPT', {
        attempt: i + 1,
        error: error.message,
      });
      
      // 指数退避：1s, 2s, 4s
      await this.delay(1000 * Math.pow(2, i));
    }
  }
  
  throw lastError;
}
```

#### 4. 增强日志 - 添加日志级别和聚合
```typescript
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  taskId?: string;
  module: string;
  message: string;
  data?: any;
}

class TaskLogger {
  static log(level: LogLevel, message: string, data?: any): void {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    
    // 输出到控制台（带颜色）
    console.log(this.formatLog(log));
    
    // 持久化到文件
    this.persist(log);
  }
}
```

---

### 方案 B: 重构状态机（长期）

使用 XState 或类似状态机库完全重写任务状态管理。

**优点**: 类型安全、状态转换明确
**缺点**: 改动大、需要大量测试

---

## 推荐方案：方案 A（轻量级修复）

**理由**:
1. 改动最小，可快速验证
2. 不引入新依赖（async-mutex 可选）
3. 可逐步验证每个修复
4. 向后兼容

---

## 验证策略

### 1. 单元测试
- 并发状态更新测试
- 取消传播测试
- 重试机制测试

### 2. 集成测试
使用 `npm start --prompt "task(...)"` 实际调用：
```bash
npm start --prompt "task: 分析这个项目的目录结构"
npm start --prompt "task: 检查所有 TypeScript 文件的类型错误"
```

### 3. 日志验证
检查 `~/.gemini/task-logs/` 下生成的 JSON 日志文件

---

## 技术决策

| 决策 | 理由 | 日期 |
|------|------|------|
| 采用方案 A（轻量级修复） | 快速验证，改动最小 | 2026-03-22 |
| 使用 async-mutex 处理状态锁 | 轻量、无依赖、易测试 | 待确认 |
| 实现深克隆而非 copy-on-write | 简单直接，性能可接受 | 待确认 |
| 重试退避：1s, 2s, 4s | 平衡速度和资源消耗 | 待确认 |
