# dsh-copilot-api

[Chinese](README.zh-CN.md)

DeepSeek Harness provider for a copilot-api gateway. Tested with Harness `0.2.1-rc.2`.

## Install

```sh
dsh plugin --profile web add dsh-copilot-api
```

Restart Harness after the first install. The package inserts entry `copilot-api-provider`. No profile configuration is required.

Defaults:

- `baseURL`: `http://localhost:4141` (with or without `/v1`)
- `protocol`: `openai-responses`
- credential reference: `GITHUB_COPILOT_API_KEY`

Save the key in the Models card with **Save API key**, in Harness credentials, or in the launch environment of that name. Configuration stores the reference name, not the key.

Use `anthropic-messages` as `protocol` for Messages.

## Change the connection

Override the inserted entry only when a default is wrong. Keep the id `copilot-api-provider`, and restate every connection field you still need:

```yaml
- id: copilot-api-provider
  config:
    baseURL: http://localhost:4141
    apiKey: GITHUB_COPILOT_API_KEY
    protocol: openai-responses
    modelRefreshInterval: 120000
```

`apiKey` is a credential reference. `apiKeyEnv` is the same kind of name; when both are set, they must match. `headers` can be set to custom request headers. `modelRefreshInterval` is milliseconds; the default `0` disables periodic refresh, while the example value `120000` refreshes every 2 minutes.

## From a checkout

```sh
cd /absolute/path/dsh-copilot-api
bun install
bun run build
dsh plugin --profile web add /absolute/path/dsh-copilot-api
```

Model mapping and overrides: [docs/models.md](docs/models.md). Headers and sessions: [docs/headers.md](docs/headers.md). Development: [docs/development.md](docs/development.md).
