import React from "react"
import type { Context } from "@deepseek-ai/cordis"
import type {} from "@deepseek-ai/dsh-client-locale/client"
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client"
import type { LlmConfigurableProvider, LlmDiscoveredModel } from "@deepseek-ai/dsh-api-remotes/client"
import type { ProviderCardExtrasOwnerProps } from "@deepseek-ai/dsh-client-ui-settings-models/client"
import type { UseResource } from "@deepseek-ai/dsh-client-resources/client"

const h = React.createElement
const namespace = "copilot-api-provider"
const en = {
  title: "Discovered models", loading: "Loading models…", empty: "No models advertised.",
  count: "Models discovered: {count}.", refresh: "Refresh models",
  hint: "Choose models and thinking levels in the conversation model selector.",
  missingBaseURL: "No gateway URL is available. Save the provider connection settings before refreshing.",
}
type CopyKey = keyof typeof en
interface ModelCardInjected {
  t: (key: CopyKey) => string
  refresh: (settingsNs: string, baseURL?: string) => Promise<string | undefined>
}
type ModelCardProps = ProviderCardExtrasOwnerProps & ModelCardInjected & { useResource: UseResource }

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap { "copilot-api-provider": CopyKey }
  interface ResourceProtocolMap { "copilot-api-models": readonly LlmDiscoveredModel[] }
}

const zh: Record<CopyKey, string> = {
  title: "自动发现的模型", loading: "正在加载模型…", empty: "尚未发现模型。",
  count: "已发现 {count} 个模型。", refresh: "刷新模型",
  hint: "可在对话的模型选择器中选择模型和思考等级。",
  missingBaseURL: "未找到网关地址，请先保存提供商连接配置再刷新。",
}

function ModelCard({ provider, useResource, t, refresh }: ModelCardProps): React.ReactElement {
  const state = useResource<"copilot-api-models">(`dsh-resource://copilot-api-models/${encodeURIComponent(provider.settingsNs)}`)
  const [failure, setFailure] = React.useState<string | undefined>()
  const [busy, setBusy] = React.useState(false)
  const models = state.value ?? []
  const status = state.value === undefined ? t("loading")
    : models.length === 0 ? t("empty")
      : t("count").replace("{count}", String(models.length))
  return h("section", { "aria-label": t("title"), style: { paddingTop: "8px" } },
    h("div", { style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      h("h3", { style: { margin: 0, fontSize: "0.95rem", lineHeight: "1.3" } }, t("title")),
      h("span", {
        role: "status",
        style: {
          border: "1px solid currentColor", borderRadius: "999px", fontSize: "0.8rem",
          lineHeight: "1.45", opacity: 0.7, padding: "0 7px",
        },
      }, status),
      h("button", { type: "button", disabled: busy, style: { marginLeft: "auto" }, onClick: async () => {
      setBusy(true)
      setFailure(undefined)
      try { setFailure(await refresh(provider.settingsNs, provider.defaultBaseURL)) }
      finally { setBusy(false) }
      } }, t("refresh")),
    ),
    h("p", { style: { margin: "4px 0 0", fontSize: "0.86rem", lineHeight: "1.4", opacity: 0.72 } }, t("hint")),
    failure || state.failure ? h("p", { role: "alert" }, failure ?? state.failure?.message) : null,
  )
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(namespace, { en, zh }))
  ctx.effect(() => ctx.resources.register({
    protocol: "copilot-api-models",
    async *open(address, { signal }) {
      const settingsNs = decodeURIComponent(new URL(address).pathname.slice(1))
      let pending = true
      let wake: (() => void) | undefined
      const changed = () => { pending = true; wake?.() }
      const disposers = [
        ctx.remote.$on("llm/adapters-updated", changed),
        ctx.remote.$on("credentials/reference-updated", changed),
        (ctx.on as (name: "connection/reset", listener: () => void) => () => boolean)("connection/reset", changed),
      ]
      signal.addEventListener("abort", changed, { once: true })
      try {
        while (!signal.aborted) {
          if (!pending) await new Promise<void>(resolve => { wake = resolve })
          if (signal.aborted) break
          pending = false
          yield await ctx.remote.llm.discoverModels(settingsNs, { provider: "copilot-api" })
        }
      } finally {
        signal.removeEventListener("abort", changed)
        for (const dispose of disposers) dispose()
      }
    },
  }))
  ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
    name: "settings.models.provider-card", key: namespace,
    inject: (): ModelCardInjected => ({
      t: ctx.locale.bind(namespace),
      refresh: async (settingsNs, baseURL) => {
        if (!baseURL?.trim()) {
          const directory = await ctx.remote.llm.listConfigurableProviders()
          if (!directory.ok) return directory.error.message
          const endpoint = directory.value.find((entry: LlmConfigurableProvider) => entry.provider === "copilot-api" && entry.settingsNs === settingsNs)?.defaultBaseURL
          if (!endpoint?.trim()) return ctx.locale.bind(namespace)("missingBaseURL")
          baseURL = endpoint
        }
        const result = await ctx.remote.llm.discoverModels(settingsNs, { baseURL })
        return result.ok ? undefined : result.error.message
      },
    }),
  }, ModelCard))
}

export const inject = ["slots", "locale", "resources", "remote", "remote.llm"]
