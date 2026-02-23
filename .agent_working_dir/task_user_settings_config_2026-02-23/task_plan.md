# Task Plan: 添加 userSettings 配置项以支持插件配置优先级

## Goal

在 Gemini CLI 的插件配置 JSON 中添加 `userSettings`
配置项，使插件可以给 gemini-cli 增加配置，配置优先级为：projectSettings >
userSettings > extensionSettings > systemSettings >
defaultSettings，且配置初始化时机需要早于插件加载。

## Current Phase

Phase 4

## Phases

### Phase 1: 理解现有配置系统架构

- [x] 分析 settings.ts 中的配置加载流程
- [x] 分析 extension-manager.ts 中的插件加载流程
- [x] 分析 Config 类的初始化流程
- [x] 确定配置优先级合并的实现位置
- **Status:** completed

### Phase 2: 设计解决方案

- [x] 设计 userSettings 的数据结构
- [x] 设计插件如何提供配置的机制
- [x] 设计配置合并的优先级逻辑
- [x] 设计配置初始化的时序方案
- **Status:** completed

### Phase 3: 实现 userSettings 配置项

- [x] 在 extension.ts 中添加 userSettings 的 ExtensionConfig 接口定义
- [x] 在 extension-manager.ts 中添加 preloadExtensionUserSettings 预扫描方法
- [x] 修改 settings.ts 的 mergeSettings 函数以支持新的优先级
- [x] 修改 settings.ts 的 loadSettings 函数接收 extensionUserSettings 参数
- [x] 修改 settings.ts 的 LoadedSettings 类存储 extensionUserSettings
- [x] 在 gemini.tsx 中调用预扫描方法获取 userSettings
- [x] 修改 settings.test.ts 更新测试以反映新的优先级
- [x] 修复 list.test.ts 中的 ExtensionManager mock 问题
- **Status:** completed

### Phase 4: 测试和验证

- [x] 构建项目验证无编译错误
- [x] 运行 settings.test.ts 验证配置合并逻辑
- [x] 手动测试配置优先级（主题设置生效）
- [ ] 清理调试日志
- **Status:** in_progress

## Decisions Made

| Decision                                                    | Rationale                                | Date       |
| ----------------------------------------------------------- | ---------------------------------------- | ---------- |
| 使用预扫描方案                                              | 在 Config 初始化前提取插件配置，避免重构 | 2026-02-23 |
| 配置优先级：workspace > user > extension > system > default | 符合用户需求，插件配置优先级适中         | 2026-02-23 |
| 不在 schema 中定义 userSettings 结构                        | userSettings 内容由插件自己定义          | 2026-02-23 |

## Errors Encountered

| Error                          | Resolution                                  | Date       |
| ------------------------------ | ------------------------------------------- | ---------- |
| 测试失败 - 优先级顺序不对      | 调整 mergeSettings 参数顺序，更新测试期望值 | 2026-02-23 |
| ExtensionManager mock 类型错误 | 使用 vi.mocked() 和正确的类型转换           | 2026-02-23 |
