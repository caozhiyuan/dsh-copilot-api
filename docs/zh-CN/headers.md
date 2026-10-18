# Header、会话与缓存

[English](../headers.md)

静态 Header 大小写不敏感。认证、协议版本、Content-Type、SDK Accept、Harness User-Agent、Host、Content-Length 和动态 Session Header 优先于静态配置。Anthropic Beta 按 token 合并，并保留 SDK 必需项。User-Agent 使用 Harness 的真实版本，避免触发 Claude CLI 专用模型目录格式。

每次实际推理都会用当前 `GenerateOptions.sessionId` 同时发送 `x-deepseek-harness-session-id` 和 `x-session-affinity`。该接口没有可靠的 Root Session ID，子 Agent 保留自己的 Session ID。模型发现不合成会话。插件不改变日志、追踪和 Token Usage 的会话归属，也不发送用户敏感信息。它保留 pi-ai/SDK 原有的 `x-client-request-id`，即使该值与 Session ID 相同也不移除。

`prompt_cache_key` 始终由 pi-ai 在请求体中管理。Session Header 和 affinity 不改变它的值，插件也不另建缓存键。SSE、工具调用、多轮回放、thinking、用量、AbortSignal 和 Harness 重试继续由原生适配器处理。
