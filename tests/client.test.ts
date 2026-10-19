// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Context } from "@deepseek-ai/cordis"
import { afterEach, expect, it, vi } from "vitest"

let root: Root | undefined
afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = undefined
  vi.unstubAllGlobals()
})

async function browser(built = false) {
  let plugin
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  window.__ModuleLoader__ = { load(module) { plugin = module.factory(id => {
    if (id !== "react") throw new Error(`Unexpected browser dependency: ${id}`)
    return React
  }) } }
  vi.resetModules()
  if (built) await import("../dist/client.js")
  else plugin = await import("../src/client/index.ts")
  let resource, seat, Component, dictionaries
  const dispose = []
  const listeners = new Map()
  const subscribe = (event, listener) => {
    const set = listeners.get(event) ?? new Set()
    set.add(listener)
    listeners.set(event, set)
    return () => set.delete(listener)
  }
  const model = { id: "codex/gpt-gateway", name: "Gateway model", inputModalities: ["text", "image"], contextWindow: 128000, maxTokens: 16000 }
  const ctx = {
    effect: callback => { dispose.push(callback()) },
    on: subscribe,
    locale: {
      register: (ns, value) => { dictionaries = value; return () => {} },
      bind: () => key => dictionaries.en[key],
    },
    resources: { register: value => { resource = value; return () => {} } },
    slots: {
      inject: (name, callback) => callback(),
      register: (config, component) => { seat = config; Component = component; return () => {} },
    },
    remote: {
      $on: subscribe,
      credentials: { set: vi.fn(async () => ({ ok: true })) },
      llm: {
        discoverModels: vi.fn(async () => ({ ok: true, value: [model] })),
        listConfigurableProviders: vi.fn(async () => ({ ok: true, value: [{
          provider: "copilot-api", settingsNs: "copilot-api-provider", defaultBaseURL: "https://gateway.example/custom",
        }] })),
      },
    },
  }
  plugin.apply(ctx)
  return { plugin, ctx, get resource() { return resource }, get seat() { return seat }, Component, dictionaries, listeners, dispose, model,
    emit: event => { for (const listener of listeners.get(event) ?? []) listener() },
  }
}

it.each([false, true])("opens the model resource with real Cordis injection (built: %s)", async built => {
  const client = await browser(built)
  const ctx = new Context()
  const controller = new AbortController()
  let stream
  try {
    // Services must come from a sibling plugin: root-provided services bypass
    // the injection guard that rejected ctx.remote in the shipped browser.
    await ctx.plugin({ apply(provider) {
      for (const name of ["slots", "locale", "resources", "remote"]) provider.reflect.provide(name, client.ctx[name])
      for (const name of ["llm", "credentials"]) provider.reflect.provide(`remote.${name}`, client.ctx.remote[name])
    } })
    await ctx.plugin(client.plugin)
    stream = client.resource.open("dsh-resource://copilot-api-models/copilot-api-provider", { signal: controller.signal })
    expect((await stream.next()).value).toMatchObject({ ok: true, value: [{ id: client.model.id }] })
    const card = client.seat.inject()
    expect(await card.refresh("copilot-api-provider", "http://localhost:4141/v1")).toBeUndefined()
    expect(await card.refresh("copilot-api-provider")).toBeUndefined()
    expect(client.ctx.remote.llm.listConfigurableProviders).toHaveBeenCalledOnce()
    expect(await card.storeKey("GITHUB_COPILOT_API_KEY", "test-key")).toBeUndefined()
    const waiting = stream.next()
    client.emit("llm/adapters-updated")
    expect((await waiting).value.ok).toBe(true)
  } finally {
    controller.abort()
    await stream?.next()
    await ctx.fiber.dispose()
  }
  expect([...client.listeners.values()].every(set => set.size === 0)).toBe(true)
})

it("loads the compiled Harness browser factory using only shared React", async () => {
  const { resource, seat, Component } = await browser(true)
  expect(seat).toMatchObject({ name: "settings.models.provider-card", key: "copilot-api-provider" })
  expect(typeof Component).toBe("function")
  const controller = new AbortController()
  const stream = resource.open("dsh-resource://copilot-api-models/copilot-api-provider", { signal: controller.signal })
  expect((await stream.next()).value).toMatchObject({ ok: true, value: [{ id: "codex/gpt-gateway" }] })
  controller.abort()
  expect((await stream.next()).done).toBe(true)
})

it("registers a normal provider-card slot and shows only a model count", async () => {
  const { resource, seat, Component, dictionaries, ctx } = await browser()
  expect(seat).toMatchObject({ name: "settings.models.provider-card", key: "copilot-api-provider" })
  expect(dictionaries.zh.count).toBe("已发现 {count} 个模型。")
  const controller = new AbortController()
  const stream = resource.open("dsh-resource://copilot-api-models/copilot-api-provider", { signal: controller.signal })
  const first = (await stream.next()).value
  expect(first).toMatchObject({ ok: true, value: [{ id: "codex/gpt-gateway" }] })
  const node = document.createElement("div")
  root = createRoot(node)
  const injected = seat.inject()
  await act(async () => root?.render(React.createElement(Component, {
    ...injected, provider: { settingsNs: "copilot-api-provider", defaultBaseURL: "http://localhost:4141/v1" },
    useResource: () => ({ status: "live", value: first.value }),
  })))
  expect(node.textContent).toContain("Models discovered: 1.")
  expect(node.querySelector("table")).toBeNull()
  expect(node.textContent).not.toContain("codex/gpt-gateway")
  await act(async () => node.querySelector("button")?.click())
  expect(ctx.remote.llm.discoverModels).toHaveBeenLastCalledWith("copilot-api-provider", { baseURL: "http://localhost:4141/v1" })
  expect(ctx.remote.llm.listConfigurableProviders).not.toHaveBeenCalled()
  controller.abort()
  await stream.next()
})

it("refreshes on provider invalidations, retains failures as resource frames, and disposes listeners", async () => {
  const { ctx, resource, emit, listeners } = await browser()
  const controller = new AbortController()
  const stream = resource.open("dsh-resource://copilot-api-models/custom%2Did", { signal: controller.signal })
  expect((await stream.next()).value.ok).toBe(true)
  expect(ctx.remote.llm.discoverModels).toHaveBeenCalledWith("custom-id", { provider: "copilot-api" })
  const waiting = stream.next()
  ctx.remote.llm.discoverModels.mockResolvedValueOnce({ ok: false, error: { code: "offline", message: "Gateway offline" } })
  emit("llm/adapters-updated")
  expect((await waiting).value).toMatchObject({ ok: false, error: { message: "Gateway offline" } })
  ctx.remote.llm.discoverModels.mockResolvedValueOnce({ ok: true, value: [] })
  emit("connection/reset")
  expect((await stream.next()).value).toMatchObject({ ok: true, value: [] })
  emit("credentials/reference-updated")
  expect((await stream.next()).value).toMatchObject({ ok: true, value: [{ id: "codex/gpt-gateway" }] })
  const closing = stream.next()
  controller.abort()
  expect((await closing).done).toBe(true)
  expect([...listeners.values()].every(set => set.size === 0)).toBe(true)
})

it.each([
  { status: "loading", value: undefined, text: "Loading models" },
  { status: "live", value: [], text: "No models advertised" },
  { status: "failed", value: [{ id: "text-only", name: "Text model" }], failure: { message: "Refresh failed" }, text: "Refresh failed" },
])("renders resource loading, empty and failure states", async state => {
  const { seat, Component } = await browser()
  const node = document.createElement("div")
  root = createRoot(node)
  await act(async () => root?.render(React.createElement(Component, {
    ...seat.inject(), provider: { settingsNs: "copilot-api-provider" }, useResource: () => state,
  })))
  expect(node.textContent).toContain(state.text)
  if (state.value?.length) expect(node.textContent).toContain("Models discovered: 1.")
})

it("shows a manual refresh failure in the card", async () => {
  const { ctx, seat, Component } = await browser()
  const node = document.createElement("div")
  root = createRoot(node)
  ctx.remote.llm.discoverModels.mockResolvedValueOnce({ ok: false, error: { message: "Refresh refused" } })
  await act(async () => root?.render(React.createElement(Component, {
    ...seat.inject(), provider: { settingsNs: "copilot-api-provider" }, useResource: () => ({ status: "live", value: [] }),
  })))
  await act(async () => node.querySelector("button")?.click())
  expect(node.textContent).toContain("Refresh refused")
})

it.each([undefined, "", " "])('uses the configured endpoint when the card URL is %s', async baseURL => {
  const { ctx, seat, Component } = await browser()
  const node = document.createElement("div")
  root = createRoot(node)
  await act(async () => root?.render(React.createElement(Component, {
    ...seat.inject(), provider: { settingsNs: "copilot-api-provider", defaultBaseURL: baseURL },
    useResource: () => ({ status: "live", value: [] }),
  })))
  await act(async () => node.querySelector("button")?.click())
  expect(ctx.remote.llm.listConfigurableProviders).toHaveBeenCalledOnce()
  expect(ctx.remote.llm.discoverModels).toHaveBeenCalledWith("copilot-api-provider", { baseURL: "https://gateway.example/custom" })
})

it("reports directory failures without sending an empty discovery request", async () => {
  const { ctx, seat } = await browser()
  ctx.remote.llm.listConfigurableProviders.mockResolvedValueOnce({ ok: false, error: { message: "Directory unavailable" } })
  expect(await seat.inject().refresh("copilot-api-provider")).toBe("Directory unavailable")
  expect(ctx.remote.llm.discoverModels).not.toHaveBeenCalled()
})

it("does not use another provider's endpoint when the namespace is missing", async () => {
  const { ctx, seat } = await browser()
  expect(await seat.inject().refresh("another-entry")).toContain("Save the provider connection settings")
  expect(ctx.remote.llm.discoverModels).not.toHaveBeenCalled()
})

it("saves keys only through Harness credentials and clears the password field", async () => {
  const { ctx, seat, Component } = await browser()
  const node = document.createElement("div")
  root = createRoot(node)
  await act(async () => root?.render(React.createElement(Component, {
    ...seat.inject(), provider: { settingsNs: "copilot-api-provider", nativeAuth: { env: ["GITHUB_COPILOT_API_KEY"] } },
    useResource: () => ({ status: "live", value: [] }),
  })))
  const input = node.querySelector("input")!
  // Use the native setter so React observes a user edit rather than its value tracker.
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "test-secret")
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await act(async () => node.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
  expect(ctx.remote.credentials.set).toHaveBeenCalledWith("GITHUB_COPILOT_API_KEY", "test-secret")
  expect(input.value).toBe("")
  expect(node.textContent).toContain("API key saved securely")
  ctx.remote.credentials.set.mockResolvedValueOnce({ ok: false, error: { message: "Read-only credentials" } })
  expect(await seat.inject().storeKey("GITHUB_COPILOT_API_KEY", "test-secret")).toBe("Read-only credentials")
})
