# Task Plan: Fix Task System Critical Issues

## Goal
修复 Gemini CLI task 系统的 3 个高优先级问题（状态管理竞态条件、上下文隔离缺失、错误恢复不足），添加日志系统，并通过实际调用验证。

## Current Phase
✅ COMPLETED

## Phases

### Phase 1: 代码定位与问题分析
- [x] 读取 taskManager.ts 核心代码，定位状态管理问题（行 142-168）
- [x] 读取 backgroundTaskExecutor.ts，定位上下文隔离问题（行 89-112）
- [x] 读取 task.ts，定位错误恢复问题（行 245-278）
- [x] 分析现有日志机制
- **Status:** completed

### Phase 2: 设计方案与确认
- [x] 设计原子状态更新方案（状态机 + 锁）
- [x] 设计上下文深克隆隔离方案
- [x] 设计错误恢复 + 重试机制方案
- [x] 设计日志系统方案（级别、格式、输出位置）
- [x] 向用户展示方案并获取确认
- **Status:** completed

### Phase 3: 实现原子状态更新
- [x] 实现 Mutex 锁（packages/core/src/utils/mutex.ts）
- [x] 修改 background-manager.ts 状态更新逻辑（updateTaskState 方法）
- [x] 实现状态转换验证（isValidStateTransition）
- [x] 更新所有状态修改点使用原子更新
- [x] 添加状态变更日志
- **Status:** completed

### Phase 4: 实现上下文隔离
- [x] 实现深克隆工具（packages/core/src/utils/deep-copy.ts）
- [x] 修改 session-manager.ts 上下文传递（runSubAgent 方法）
- [x] 添加上下文隔离日志
- **Status:** completed

### Phase 5: 实现错误恢复机制和增强日志
- [x] 实现重试逻辑（executeWithRetry 方法，指数退避）
- [x] 实现可重试错误判断（isRetryableError）
- [x] 创建 TaskSystemLogger（packages/core/src/background/task-system-logger.ts）
- [x] 更新所有模块使用新日志系统
- [x] 添加资源清理处理
- **Status:** completed

### Phase 6: 测试验证
- [x] 运行构建确保无编译错误
- [x] 运行单元测试验证 Mutex、DeepClone、Logger
- [x] 检查日志输出（~/.gemini/task-system.log）
- [x] 所有测试通过 ✅
- **Status:** completed

## Decisions Made
| Decision | Rationale | Date |
|----------|-----------|------|
| 使用 Mutex 实现状态锁 | 轻量级，无需额外依赖，易测试 | 2026-03-22 |
| 使用 structuredClone() 深克隆 | Node.js 原生 API，性能好 | 2026-03-22 |
| 重试策略：最多 3 次，指数退避 1s→2s→4s | 平衡速度和资源消耗 | 2026-03-22 |
| 日志级别：DEBUG/INFO/WARN/ERROR 四级 | 标准日志级别，易于过滤 | 2026-03-22 |

## Errors Encountered
| Error | Resolution | Attempt # | Date |
|-------|-----------|-----------|------|
|       |           |           |      |
