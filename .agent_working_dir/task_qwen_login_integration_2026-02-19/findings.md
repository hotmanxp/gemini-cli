# Qwen Login 集成 - 调研发现

## 调研状态

### 1. Qwen OAuth 认证
- [x] `~/.qwen/oauth_creds.json` 文件格式
- [x] Token 获取和刷新机制
- [x] API 密钥存储方式

### 2. Qwen Code 源码
- [x] `openaiContentGenerator` 实现
- [x] Qwen API 调用流程
- [x] 错误处理机制

### 3. Gemini CLI 集成点
- [x] 现有认证模块架构
- [x] ContentGenerator 接口定义
- [x] 配置管理方式

## 调研记录

### 2026-02-19 - Qwen 源码分析

#### 1. OAuth Credentials 文件格式 (`~/.qwen/oauth_creds.json`)

```json
{
  "access_token": "ONK2CSxDFVVuTdFMO5z0gMmcPBaVxigEa4aVdyli4y07tMDsjLYMI-MGDsS4nPsH2rR5ioTImUH9BwWaH_-GEg",
  "token_type": "Bearer",
  "refresh_token": "E--HBGGeFhGf6fVFMHyl5mBQHe0rwZWofN7hEoeeaCzUxFGpWCuYPQcMfjYNb8NuJNok4Oli_yz3MH9t74154g",
  "resource_url": "portal.qwen.ai",
  "expiry_date": 1771482474416
}
```

**字段说明**:
- `access_token`: Bearer Token，用于 API 请求认证
- `refresh_token`: 用于刷新 access_token
- `resource_url`: 资源服务器 URL (portal.qwen.ai)
- `expiry_date`: Token 过期时间戳（毫秒）

#### 2. OAuth 认证流程

**OAuth 端点**:
- Base URL: `https://chat.qwen.ai`
- Device Code: `/api/v1/oauth2/device/code`
- Token: `/api/v1/oauth2/token`
- Client ID: `f0304373b74a44d2b584a3fb70ca9e56`
- Scope: `openid profile email model.completion`
- Grant Type: `urn:ietf:params:oauth:grant-type:device_code`

**认证流程**:
1. 生成 PKCE code_verifier 和 code_challenge
2. 请求设备授权码（返回 device_code 和 user_code）
3. 显示 URL 让用户在浏览器中授权
4. 轮询获取 access_token
5. 缓存 token 到 `~/.qwen/oauth_creds.json`
6. Token 过期时自动刷新

#### 3. QwenContentGenerator 架构

```
QwenContentGenerator (继承 OpenAIContentGenerator)
├── 使用 DashScope OpenAI 兼容 API
├── 自动 Token 管理和刷新
├── 重试逻辑（401/403 错误时刷新 token）
└── 共享 Token 管理器（SharedTokenManager）
```

**关键类**:
- `QwenOAuth2Client`: OAuth 客户端，处理设备流和 token 刷新
- `SharedTokenManager`: 跨会话共享 token 状态
- `QwenContentGenerator`: 继承 OpenAIContentGenerator，添加 OAuth 支持

#### 4. OpenAIContentGenerator 架构

```
OpenAIContentGenerator
├── ContentGenerationPipeline
│   ├── OpenAIProvider (或 DashScopeProvider)
│   ├── EnhancedErrorHandler
│   └── RequestTokenEstimator
├── 实现 ContentGenerator 接口
│   ├── generateContent
│   ├── generateContentStream
│   ├── countTokens
│   └── embedContent
```

#### 5. Gemini CLI 集成点

在 Qwen Code 中，认证类型定义在 `contentGenerator.ts`:

```typescript
export enum AuthType {
  USE_OPENAI = 'openai',
  QWEN_OAUTH = 'qwen-oauth',  // Qwen OAuth 认证
  USE_GEMINI = 'gemini',
  USE_VERTEX_AI = 'vertex-ai',
  USE_ANTHROPIC = 'anthropic',
}
```

创建 ContentGenerator 的逻辑:
```typescript
if (authType === AuthType.QWEN_OAUTH) {
  const qwenClient = await getQwenOAuthClient(config);
  baseGenerator = new QwenContentGenerator(qwenClient, generatorConfig, config);
}
```

## 迁移方案

### 需要在 Gemini CLI 中实现的文件

1. **OAuth 认证模块** (`packages/core/src/qwen/`):
   - `qwenOAuth2.ts` - OAuth 客户端实现
   - `sharedTokenManager.ts` - Token 共享管理器
   - `qwenContentGenerator.ts` - Qwen ContentGenerator

2. **OpenAI 兼容层** (`packages/core/src/core/openaiContentGenerator/`):
   - 已有类似实现，需要添加 DashScope Provider

3. **认证类型扩展** (`packages/core/src/core/contentGenerator.ts`):
   - 添加 `QWEN_OAUTH` 到 `AuthType` 枚举
   - 添加创建 Qwen ContentGenerator 的逻辑

4. **CLI 命令** (`packages/cli/src/commands/qwen/`):
   - `auth.ts` - Qwen OAuth 认证命令

### 关键依赖

- `open` - 打开浏览器进行 OAuth 授权
- `@google/genai` - 类型定义

### 注意事项

1. Token 文件路径：`~/.qwen/oauth_creds.json`
2. OAuth 端点必须使用 Qwen 的端点
3. SharedTokenManager 防止跨会话 token 冲突
4. 支持自动 token 刷新和重试逻辑
