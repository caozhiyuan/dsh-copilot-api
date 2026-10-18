# Headers, sessions, and cache

[中文](zh-CN/headers.md)

Static headers merge case-insensitively with SDK headers. Gateway credentials, protocol version, content type, SDK Accept, the Harness User-Agent, Host, content length, and dynamic session headers take priority over configured values. Anthropic beta tokens are combined with the SDK's required beta tokens. The Harness User-Agent keeps Claude CLI-specific discovery formatting from changing model IDs.

Each inference attempt sends both `x-deepseek-harness-session-id` and `x-session-affinity` from the actual `GenerateOptions.sessionId`. This API does not expose a reliable root session ID, so child agents keep their own IDs. Discovery does not invent a session. The plugin does not change session IDs, usage or log ownership, and it does not add user data. It preserves the pi-ai/SDK `x-client-request-id`, including when that value equals the session ID.

`prompt_cache_key` remains a request-body field owned by pi-ai. Session headers and affinity do not change it, and the plugin does not create a second cache key. SSE, tools, replay, thinking, usage, AbortSignal, and Harness retries stay with `PiAiAdapter` and the existing runtime.
