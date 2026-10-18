# dsh-copilot-api

[English](README.md)

DeepSeek Harness 的 copilot-api 网关插件。验证版本为 Harness `0.2.1-rc.2`。

## 安装

```sh
dsh plugin --profile web add dsh-copilot-api
```

首次安装后重启 Harness。插件会插入条目 `copilot-api-provider`，profile 里不用再加配置。

默认值：

- `baseURL`：`http://localhost:4141`（可以带 `/v1`，也可以不带）
- `protocol`：`openai-responses`
- 凭据引用：`GITHUB_COPILOT_API_KEY`

在模型设置卡片中点击“保存 API 密钥”，或写入 Harness 凭据、同名启动环境。配置里只填引用名，不填密钥明文。

使用 Messages 时，把 `protocol` 改为 `anthropic-messages`。

## 修改连接

只有默认值不合适时才覆盖这个条目。保留 ID `copilot-api-provider`，并写上仍然需要的全部连接字段：

```yaml
- id: copilot-api-provider
  config:
    baseURL: http://localhost:4141
    apiKey: GITHUB_COPILOT_API_KEY
    protocol: openai-responses
    modelRefreshInterval: 120000
```

`apiKey` 是凭据引用名。`apiKeyEnv` 也是引用名；两者同时填写时必须相同。`headers` 可以填写自定义请求头。`modelRefreshInterval` 单位是毫秒，默认 `0` 表示关闭定时刷新；示例中的 `120000` 表示每 2 分钟刷新。

## 从源码安装

```sh
cd /absolute/path/dsh-copilot-api
bun install
bun run build
dsh plugin --profile web add /absolute/path/dsh-copilot-api
```

模型映射与覆盖见 [docs/zh-CN/models.md](docs/zh-CN/models.md)。Header 与会话见 [docs/zh-CN/headers.md](docs/zh-CN/headers.md)。开发说明见 [docs/zh-CN/development.md](docs/zh-CN/development.md)。
