# Gemini Loop 功能

Gemini Loop 是 Gemini
CLI 的内置功能，支持自引用开发循环，可持续迭代工作直到任务完成。

## 快速开始

```bash
# 启动标准循环
/loop "Build a REST API with user authentication"

# 启动 Ultrawork 循环（带 Oracle 验证）
/ulw-loop "Implement payment processing with fraud detection"

# 查看循环状态
/loop-status

# 取消活动循环
/cancel-loop
```

## 功能模式

### 标准循环（Standard Loop）

标准循环通过迭代方式持续工作，直到任务完成。

**特点：**

- 默认最大迭代次数：100 次
- 策略：继续（保持对话历史）
- 完成信号：`<promise>DONE</promise>`
- 适用于一般开发任务

### Ultrawork 循环

Ultrawork 循环增加了独立的 Oracle 验证，适用于关键任务。

**特点：**

- 无迭代次数限制
- 包含 Oracle 验证流程
- 验证通过后才完成循环
- 适用于任务关键型开发

**验证流程：**

1. 检测到完成信号时触发 Oracle 验证
2. Oracle 独立审查工作成果
3. 验证通过：完成循环 ✅
4. 验证失败：注入重试提示并继续 🔄

## 使用方法

### 启动循环

**标准循环：**

```bash
/loop "任务描述"
```

**Ultrawork 循环：**

```bash
/ulw-loop "任务描述"
```

### 查看状态

```bash
/loop-status
```

输出示例：

```
╔══════════════════════════════════════════════════════════╗
║                  Loop Status                              ║
╠══════════════════════════════════════════════════════════╣
║  Mode: Ultrawork ⚡                                        ║
║  Status: In Progress                                      ║
║  Iteration: 3 / ∞                                         ║
║  Started: 2026-03-08T10:30:00.000Z                        ║
║  Verification: Pending                                    ║
╠══════════════════════════════════════════════════════════╣
║  Task: Build a REST API with user authentication          ║
╚══════════════════════════════════════════════════════════╝
```

### 取消循环

```bash
/cancel-loop
```

可选参数：

```bash
/cancel-loop --reason="任务需求变更"
```

## 底层工具

Gemini Loop 通过三个内置工具实现：

1. **start_loop** - 启动新的循环会话
2. **check_loop** - 检查当前循环状态
3. **cancel_loop** - 取消活动的循环

这些工具也可以通过工具调用直接使用。

## 状态管理

循环状态存储在 `.agent_working_dir/loops/.gemini-loop-state.md` 文件中，包含：

- 循环模式（标准/Ultrawork）
- 当前迭代次数
- 最大迭代次数
- 完成信号
- 开始时间
- 会话 ID
- 任务描述

## 最佳实践

### 何时使用循环

✅ **适用场景：**

- 复杂的重构任务
- 需要迭代的功能开发
- 需要彻底验证的 bug 修复
- 测试驱动开发循环

❌ **不推荐：**

- 简单的一次性任务
- 需要频繁用户输入的任务
- 时间敏感的操作
- 依赖外部服务的任务

### 优化建议

1. **设置合理的迭代限制** - 从 50 次开始，根据需要增加
2. **对复杂任务使用 continue 策略** - 保持完整的上下文
3. **对关键任务启用 ultrawork** - 确保独立验证
4. **监控状态文件** - 通过 `.gemini-loop-state.md` 跟踪进度
5. **尽早取消** - 如果方法不奏效，及时停止调整

## 架构

### 组件

- **状态管理** (`loop-state.ts`) - 循环状态的读写和持久化
- **工具** (`start-loop.ts`, `check-loop.ts`, `cancel-loop.ts`) - 内置工具实现
- **运行时钩子** - 监控空闲事件并触发循环继续
- **Oracle 验证** - 独立验证任务完成情况

### 工作流程

```
/loop "任务"
    ↓
[start_loop 工具]
    ↓
[创建状态文件]
    ↓
[Agent 执行任务]
    ↓
[空闲检测] → 扫描 <promise>DONE</promise>
    ↓
    ├─→ 未找到 → 注入继续提示 → 继续循环
    ↓
    └─→ 已找到 → 完成循环 (标准模式)
                或
                触发 Oracle 验证 (Ultrawork 模式)
```

## 故障排除

### 常见问题

**问题：循环无法启动**

- 原因：状态文件损坏
- 解决：运行 `/cancel-loop` 后重试

**问题：卡在验证中**

- 原因：Oracle 会话失败
- 解决：检查 Oracle 记录，手动验证

**问题：达到最大迭代次数**

- 原因：任务过于复杂
- 解决：增加 `--max-iterations` 参数

## 未来功能

- [ ] 循环监控钩子实现
- [ ] Oracle 验证工具
- [ ] 与核心 Agent 循环集成
- [ ] 计时器工具支持
