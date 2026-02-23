# Findings & Decisions

## Requirements

<!-- Captured from user request -->

- 将 Gemini CLI 的默认启动模式从 "default" 改为 "yolo" 模式
- 用户启动时自动进入 autonomous mode，无需手动指定 `--yolo` 或
  `--approval-mode=yolo` 参数

## Research Findings

<!-- Key discoveries during exploration -->

- **ApprovalMode 枚举**：在 `packages/core/src/policy/types.ts`
  中定义了 4 种模式：`DEFAULT`（需要确认）、`AUTO_EDIT`（自动编辑）、`PLAN`（只读）、`YOLO`（全自动）
- **当前默认值**：在 `packages/cli/src/config/settingsSchema.ts` line
  199 中，`defaultApprovalMode` 的默认值为 `'default'`
- **配置层次**：
  1. 命令行参数优先级最高 (`--approval-mode` 或 `--yolo`)
  2. 其次读取 `settings.general.defaultApprovalMode` 配置
  3. 最后默认为 `ApprovalMode.DEFAULT`
- **settingsSchema.ts**：定义了设置的类型和默认值，其中 `defaultApprovalMode`
  的选项只包含 `['default', 'auto_edit', 'plan']`，不支持 `'yolo'`
- **config.ts**：在 line 555-556 中有特殊逻辑，会忽略设置为 `'yolo'` 的
  `defaultApprovalMode`
- **Policy Engine**：YOLO 模式对应 `packages/core/src/policy/policies/yolo.toml`
  策略文件

## Technical Decisions

<!-- Decisions made with rationale -->

| Decision                                                                               | Rationale                                                        |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 修改 `settingsSchema.ts` 中 `defaultApprovalMode.default` 从 `'default'` 改为 `'yolo'` | 这是最直接的修改方式，影响所有新用户和未显式配置的用户           |
| 更新 `settingsSchema.ts` 中 `defaultApprovalMode` 的 options 枚举                      | 需要允许 `'yolo'` 作为有效选项，否则可能会被 validation 拦截     |
| 更新 description 说明                                                                  | 原文档说明提到 "'yolo' is not supported yet"，需要更新为支持状态 |
| 移除 config.ts line 555-557 的特殊逻辑                                                 | 这段逻辑会阻止 settings 中设置 'yolo' 作为默认值，与需求冲突     |

## Issues Encountered

<!-- Errors and how they were resolved -->

| Issue                                                 | Resolution                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| 测试失败：9 tests failed                              | 测试基于旧的默认值 'default'，需要更新测试用例以适配新的默认值 'yolo'   |
| 测试期望 `ApprovalMode.DEFAULT` 但收到 `'yolo'`       | 需要修改 config.test.ts 中的期望值                                      |
| 测试期望某些 tool 被 exclude，但现在 YOLO mode 不排除 | 需要修改测试逻辑，明确设置 approvalMode 为 'default' 来测试非 YOLO 行为 |

## Resources

<!-- URLs, file paths, API references -->

- `packages/cli/src/config/settingsSchema.ts` - 设置定义和默认值 (line 194-210)
- `packages/cli/src/config/config.ts` - 配置加载逻辑 (line 551-591)
- `packages/cli/src/config/config.test.ts` - 需要更新的测试文件
- `packages/core/src/policy/types.ts` - ApprovalMode 枚举定义
- `packages/core/src/policy/policies/yolo.toml` - YOLO 模式策略定义

## Visual/Browser Findings

<!-- CRITICAL: Update after every 2 view/browser operations -->

- 无

---

_Update this file after every 2 view/browser/search operations_ _This prevents
visual information from being lost_
