# Task Plan: 将 qwen-code 的 LSP 实现同步到 gemini-cli

## Goal
将 qwen-code 项目中功能完善的 LSP 实现同步到 gemini-cli 项目中，替换或增强当前 gemini-cli 中功能不完善的 LSP 实现。

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery ✅
- [x] 了解用户意图和具体需求
- [x] 分析 qwen-code 的 LSP 实现架构和功能
- [x] 分析 gemini-cli 当前的 LSP 实现状态
- [x] 识别两者之间的差异和需要迁移的核心功能
- [x] 记录发现到 findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [ ] 定义技术迁移方案
- [ ] 确定目标文件结构和迁移列表
- [ ] 制定代码迁移策略（直接复制 vs 适配）
- [ ] 记录技术决策和理由
- **Status:** in_progress

### Phase 3: Implementation
- [ ] 创建目标目录结构 (packages/core/src/lsp/)
- [ ] 迁移核心 LSP 服务层文件
  - [ ] NativeLspService.ts
  - [ ] LspServerManager.ts
  - [ ] LspConnectionFactory.ts
  - [ ] LspResponseNormalizer.ts
  - [ ] LspLanguageDetector.ts
  - [ ] LspConfigLoader.ts
  - [ ] NativeLspClient.ts (覆盖现有的 LspClient.ts)
- [ ] 迁移类型和常量文件
  - [ ] types.ts (合并或替换)
  - [ ] constants.ts
- [ ] 迁移工具层 (packages/core/src/tools/lsp.ts)
- [ ] 更新索引文件 (index.ts)
- [ ] 适配导入路径和项目特定代码
- **Status:** pending

### Phase 4: Testing & Verification
- [ ] 验证 LSP 功能完整性
- [ ] 运行 gemini-cli 现有测试
- [ ] 记录测试结果到 progress.md
- [ ] 修复发现的问题
- **Status:** pending

### Phase 5: Delivery
- [ ] 审查所有输出文件
- [ ] 确保迁移完成
- [ ] 交付给用户
- **Status:** pending

## Key Questions
1. qwen-code 的 LSP 实现了哪些核心功能？ ✅
   - workspaceSymbols, definitions, references, hover, documentSymbols
   - implementations, call hierarchy (prepare/incoming/outgoing)
   - diagnostics, workspaceDiagnostics, codeActions
   - applyWorkspaceEdit

2. gemini-cli 当前的 LSP 存在哪些功能缺陷？ ✅
   - 只有基础的 completion/definition/references/hover
   - 缺少高级功能 (call hierarchy, diagnostics, codeActions 等)
   - 架构不完善 (缺少配置加载、语言检测、响应标准化)

3. 两个项目的架构差异如何影响迁移？ ✅
   - qwen-code: 基于服务器名称管理，支持多服务器
   - gemini-cli: 基于语言 ID 管理，单服务器模式
   - 需要适配 Config 接口和工具系统

4. 需要处理哪些依赖和项目特定的适配？ 
   - Config 接口适配
   - 工具系统集成
   - 导入路径调整
   - 许可证头部更新

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 完全替换而非增量更新 | qwen-code 实现更完善，增量更新成本高且易出错 |
| 保留 API 兼容性 | 确保 gemini-cli 现有代码能继续使用 LSP 功能 |
| 分阶段迁移 | 先迁移核心层，再迁移工具层，最后测试验证 |
| 创建新的 lsp 目录 | 保持代码组织清晰，与现有 services/lsp 分离 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 无 | - | - |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
- Never repeat a failed action - mutate your approach instead
