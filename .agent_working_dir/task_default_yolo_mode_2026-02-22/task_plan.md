# Task Plan: 将默认启动模式改为 YOLO 模式

## Goal

将 Gemini
CLI 的默认启动模式从 "default" 改为 "yolo"，使用户启动时自动进入 autonomous
mode，无需手动指定 `--yolo` 或 `--approval-mode=yolo` 参数。

## Current Phase

Phase 5

## Phases

### Phase 1: Requirements & Discovery

- [x] Understand user intent - 修改默认启动模式为 YOLO
- [x] Identify key files - settingsSchema.ts, config.ts
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure

- [x] Define technical approach - 修改 settingsSchema.ts 的默认值和 options
- [x] Review config.ts logic to ensure no blocking code
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation

- [x] 修改 `settingsSchema.ts` line 199 - 将 default 值从 `'default'` 改为
      `'yolo'`
- [x] 修改 `settingsSchema.ts` line 206-210 - 添加 `'yolo'` 到 options 枚举
- [x] 修改 `settingsSchema.ts` line 203-205 - 更新 description 说明
- [x] 修改 `config.ts` line 555-557 - 移除忽略 'yolo' 的特殊逻辑
- [x] 执行 `npm run build` 验证编译
- **Status:** complete

### Phase 4: Testing & Verification

- [x] 验证编译无错误 - `npm run build` passed
- [ ] 运行 `npm run lint` 检查代码规范 - 有 pre-existing errors，与本次修改无关
- [x] 运行相关测试
      `npm test -w @google/gemini-cli -- src/config/config.test.ts` - 185 passed
      | 1 skipped
- [x] 手动测试启动 CLI 验证默认模式
- **Status:** complete

### Phase 5: Delivery

- [x] Review all changes
- [x] Ensure no test failures
- [ ] Deliver to user
- **Status:** in_progress

## Key Questions

1. ~~是否需要修改 tests 来适配新的默认值？~~ - ✅ 已完成，修改了 9 个测试用例
2. ~~config.ts 中忽略 'yolo' 的逻辑是否需要移除或修改？~~ - ✅ 已移除

## Decisions Made

| Decision                                                              | Rationale                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 修改 `settingsSchema.ts` 的 `defaultApprovalMode.default` 为 `'yolo'` | 直接影响默认行为，无需修改 config.ts 的核心逻辑                                                |
| 添加 `'yolo'` 到 `options` 枚举                                       | 确保 settings UI 和 validation 接受该值                                                        |
| 更新 description 说明                                                 | 保持文档准确性                                                                                 |
| **移除** config.ts line 555-557 的特殊逻辑                            | 这段逻辑会阻止 settings 中设置 'yolo' 作为默认值，与需求冲突                                   |
| 更新 9 个测试用例以适配新的默认值                                     | 测试基于旧的默认值 'default'，需要显式设置 `defaultApprovalMode: 'default'` 来测试非 YOLO 行为 |

## Errors Encountered

| Error                                    | Attempt | Resolution                                                                |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------- |
| 9 tests failed on first run              | 1       | Updated test expectations from ApprovalMode.DEFAULT to ApprovalMode.YOLO  |
| Tests expecting tool exclusions failed   | 2       | Modified tests to explicitly set `general.defaultApprovalMode: 'default'` |
| secureModeEnabled test had leftover code | 3       | Removed duplicate `expect(config.isYoloModeDisabled())` line              |

## Notes

- 已完成 2 处代码修改：
  1. `settingsSchema.ts`:
     default 值改为 'yolo'，添加 'yolo' 到 options，更新 description
  2. `config.ts`: 移除阻止 settings 中设置 'yolo' 的特殊逻辑
- 已更新 9 个测试用例以适配新的默认值
- Build passed ✅
- Config tests: 185 passed | 1 skipped ✅
- Lint 有 21 个 pre-existing errors，与本次修改无关
