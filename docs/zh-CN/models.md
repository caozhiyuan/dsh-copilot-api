# 模型、思考等级与图片

[English](../models.md)

模型设置卡片显示自动发现的名称、原始 ID、图片输入能力、上下文和输出上限，以及对话模型选择器实际可选的思考等级。启动、首次使用和“刷新模型”都会发现模型。`modelRefreshInterval` 单位为毫秒，默认 `120000` 表示每 2 分钟自动刷新；设为 `0` 可关闭定时刷新。刷新失败时保留上次成功的目录。首次发现失败会缓存错误，读取模型设置页或选择器不会反复请求网关；可等待下一次定时刷新，或手动刷新、更新凭据来重试。已经准备或正在执行的调用继续使用当时捕获的模型和传输配置。

| copilot-api 字段 | Harness/pi-ai 字段或行为 |
| --- | --- |
| `id` | 完整保留，包括 Provider 前缀 |
| `name` / `display_name` | 名称，缺失时回退到 ID |
| `context_window` | `contextWindow`，缺失或无效时回退到 8192 |
| `max_output_tokens` | `maxTokens`，缺失或无效时取 min(1024, 上下文窗口) |
| `input_modalities` | 文本，以及明确声明的图片输入 |
| `reasoning_efforts` | 实际可选思考等级及其协议映射 |

不会从模型名称猜测图片或思考能力，并忽略未知模态和等级。发现的输出容量不会自动成为每次请求的输出限制。此接口未提供价格，pi-ai 的费用字段为零或未知。原有 Token Usage 计数和 Session 归属继续保留。

地址带或不带 `/v1` 都可以，`/gateway` 等部署前缀会保留。模型发现使用 `/v1/models`，推理使用 `/v1/responses` 或 `/v1/messages`。Anthropic SDK 自己拼接 `/v1/messages`，插件提供对应的上级地址，不会产生双重 `/v1`。地址不能包含内嵌用户名、密码、查询参数或 fragment。

## Responses 与 Messages

Responses 展示模型声明的 `minimal`、`low`、`medium`、`high`、`xhigh`、`max`。只有声明了 `none` 才添加 Harness 的 `off`。选择 `high` 时发送 `reasoning: { effort: "high", summary: "auto" }`。选择 `off` 时，只有协议支持才显式发送 `none`。单独的 `off` 声明不足以确定协议能关闭思考。不选择等级时沿用 pi-ai 默认行为，省略参数不等于关闭思考。

Messages 复用 pi-ai 的 adaptive thinking 和 `output_config.effort`，只展示模型声明的 `low`、`medium`、`high`、`xhigh`、`max`。该协议不能准确表达 Responses 的 `none` 和 `minimal`，因此不展示它们。对单个模型设置 `compat.forceAdaptiveThinking: false` 可使用 pi-ai 原有的预算式 thinking。

图片沿用 Harness 附件存储、读取和 pi-ai 图片投影。在普通输入框上传图片，并选择声明支持图片的模型即可。不支持图片的模型保留共享 Runtime 原有的文本回退。

## 覆盖单个模型

使用目录中的真实模型 ID。覆盖只作用于已发现的模型，不修改 ID。只覆盖名称时保留其余能力。`reasoningEfforts: false` 可关闭该模型的思考等级控件。

```yaml
- id: copilot-api-provider
  config:
    baseURL: http://localhost:4141
    apiKey: GITHUB_COPILOT_API_KEY
    protocol: openai-responses
    modelOverrides:
      codex/gpt-5.4:
        name: 我的网关模型
        contextWindow: 128000
        maxTokens: 16000
        input: [text, image]
        reasoningEfforts:
          off: none
          high: high
          xhigh: xhigh
```

`modelOverrides` 使用 Harness 原生 volatile 设置，在自动生成的插件设置中修改后会立即刷新目录。连接字段沿用 Loader 的正常配置重载。patch 会替换整个条目的 `config`，请一并保留所需连接选项。
