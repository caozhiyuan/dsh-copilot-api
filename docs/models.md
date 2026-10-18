# Models, thinking, and images

[中文](zh-CN/models.md)

The Models card lists discovered model IDs, names, image capability, context and output capacity, and the exact efforts available in the conversation selector. Models are fetched on startup, on first use, and from **Refresh models**. `modelRefreshInterval` is in milliseconds and defaults to `120000` (automatic refresh every 2 minutes); set it to `0` to disable periodic refresh. A failed refresh keeps the last successful directory. An initial failure is cached so reading the model settings or selector does not repeatedly contact the gateway. Wait for the next periodic refresh, refresh explicitly, or update the credential to retry. Calls that are already prepared or running keep the models and transport settings they captured.

| Gateway field | Harness/pi-ai metadata |
| --- | --- |
| `id` | Exact model ID, including the provider prefix |
| `name` / `display_name` | Display name; falls back to the ID |
| `context_window` | `contextWindow`; missing or invalid values use 8192 |
| `max_output_tokens` | `maxTokens`; missing or invalid values use min(1024, context window) |
| `input_modalities` | Text, plus image input only when it is explicitly advertised |
| `reasoning_efforts` | Selectable thinking levels and their wire mappings |

Image and thinking support are not guessed from a model name. Unknown modalities and efforts are ignored. Discovered output capacity does not become a request cap. This endpoint does not advertise prices, so pi-ai cost fields stay zero or unknown. Native token counts and session usage accounting stay intact.

Both `http://localhost:4141` and `http://localhost:4141/v1` work. A deployment prefix such as `/gateway` is retained. Discovery uses `/v1/models`. Inference uses `/v1/responses` or `/v1/messages`. The Anthropic SDK appends `/v1/messages` itself, so the plugin gives it the parent base URL. URLs with embedded credentials, a query string, or a fragment are rejected.

## Responses and Messages

Responses offers advertised `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`. Advertised `none` adds Harness `off`. Selecting `high` sends `reasoning: { effort: "high", summary: "auto" }`. Selecting `off` sends explicit `none` only when that is supported. A bare `off` advertisement does not establish a wire-level way to disable thinking. When no effort is selected, pi-ai's default applies; omitting the parameter does not claim that thinking is disabled.

Messages reuses pi-ai adaptive thinking and `output_config.effort`. It offers only advertised `low`, `medium`, `high`, `xhigh`, and `max`. That vocabulary cannot represent Responses `none` or `minimal`, so those levels are not offered. Set `compat.forceAdaptiveThinking: false` on one model to use pi-ai's budget-based thinking path.

Images use Harness attachment storage and pi-ai image projection. Attach an image in the normal composer and select a model that advertises image input. Models without image support keep the shared runtime's text fallback.

## Override one model

Copy the model ID from the discovered directory. Overrides apply only to discovered models and do not change the ID. A name-only override keeps the other discovered capabilities. `reasoningEfforts: false` removes thinking controls.

```yaml
- id: copilot-api-provider
  config:
    baseURL: http://localhost:4141
    apiKey: GITHUB_COPILOT_API_KEY
    protocol: openai-responses
    modelOverrides:
      codex/gpt-5.4:
        name: My gateway model
        contextWindow: 128000
        maxTokens: 16000
        input: [text, image]
        reasoningEfforts:
          off: none
          high: high
          xhigh: xhigh
```

`modelOverrides` is a native volatile setting. Editing it in the generated plugin settings refreshes the directory immediately. Connection fields remount through the loader. A patch replaces the entry's entire `config`, so restate the connection options you need.
