import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { afterEach, expect, it, vi } from 'vitest'
import { buildModelCatalog } from 'harness-test/catalog'
import * as Plugin from '../src/index.ts'
import * as Client from '../src/client/index.ts'
import { Options } from '../src/config.ts'
import type { Settings } from '../src/config.ts'
import { CopilotModelCatalog } from '../src/catalog.ts'
import { CopilotApiAdapter } from '../src/provider.ts'
import { gateway, MODEL_ID } from './fixtures.ts'
import type { Gateway } from './fixtures.ts'

const contexts: Context[] = []
const servers: Gateway[] = []
const catalogs: CopilotModelCatalog[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(catalogs.splice(0).map(catalog => catalog.dispose()))
  await Promise.all(servers.splice(0).map(server => server.dispose()))
  vi.unstubAllEnvs()
})

async function server() {
  const value = await gateway('openai-responses')
  servers.push(value)
  return value
}
async function host(server: Gateway, apiKey = 'COPILOT_DISCOVERY_KEY', config: Record<string, unknown> = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Plugin, { baseURL: server.url, apiKey, ...config })
  return ctx
}

// Use the plugin's real resource loop and Host registry. Only the Remote carrier
// is in-process; HTTP discovery still goes through the local gateway fixture.
function resourceFor(ctx: Context) {
  let resource
  const result = async operation => {
    try { return { ok: true, value: await operation() } }
    catch (error) { return { ok: false, error } }
  }
  Client.apply({
    effect: callback => callback(),
    on: () => () => {},
    locale: { register: () => () => {}, bind: () => key => key },
    resources: { register: value => { resource = value; return () => {} } },
    slots: { inject: (_name, callback) => callback(), register: () => () => {} },
    remote: {
      $on: (event, listener) => ctx.on(event, listener),
      llm: { discoverModels: (ns, request) => result(() => ctx.llm.discoverModels(ns, request)) },
      session: { modelCatalog: () => result(() => buildModelCatalog(ctx, { provider: 'copilot-api', model: MODEL_ID })) },
    },
  })
  return resource
}

it('stops HTTP retries from model-card invalidations after failure and recovers on explicit refresh', async () => {
  const endpoint = await server()
  endpoint.modelStatus = 503
  vi.stubEnv('COPILOT_DISCOVERY_KEY', 'test-discovery-key')
  const ctx = await host(endpoint)
  const resource = resourceFor(ctx)
  const controller = new AbortController()
  const frames = []
  const consume = (async () => {
    for await (const frame of resource.open('dsh-resource://copilot-api-models/copilot-api-provider', { signal: controller.signal })) frames.push(frame)
  })()
  try {
    await vi.waitFor(() => { expect(frames.some(frame => !frame.ok)).toBe(true) })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(endpoint.requests).toHaveLength(1)
    await expect(ctx.llm.listModels('copilot-api')).rejects.toMatchObject({ code: 'MODEL_DISCOVERY_FAILED' })
    expect(endpoint.requests).toHaveLength(1)

    endpoint.modelStatus = 200
    await ctx.llm.discoverModels('copilot-api-provider', { baseURL: endpoint.url })
    await vi.waitFor(() => { expect(frames.some(frame => frame.ok && frame.value.length === 2)).toBe(true) })
    expect(endpoint.requests).toHaveLength(2)
    expect(ctx.llm.listConfigurableProviders()[0]).not.toHaveProperty('error')
  } finally {
    controller.abort()
    await consume
  }
})

it('retries a cached missing credential when that credential changes', async () => {
  const endpoint = await server()
  vi.stubEnv('COPILOT_DISCOVERY_KEY', undefined)
  const ctx = await host(endpoint)
  await expect(ctx.llm.listModels('copilot-api')).rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
  expect(endpoint.requests).toHaveLength(0)
  ctx.emit('credentials/reference-updated', credentialRef('UNRELATED_KEY'))
  await expect(ctx.llm.listModels('copilot-api')).rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })

  vi.stubEnv('COPILOT_DISCOVERY_KEY', 'test-restored-key')
  ctx.emit('credentials/reference-updated', credentialRef('COPILOT_DISCOVERY_KEY'))
  expect(await ctx.llm.listModels('copilot-api')).toHaveLength(2)
  expect(endpoint.requests).toHaveLength(1)
  expect(endpoint.requests[0]?.headers.authorization).toBe('Bearer test-restored-key')
})

it('does not notify again for an unchanged failure, and permits an explicit retry', async () => {
  const endpoint = await server()
  endpoint.modelStatus = 401
  const changed = vi.fn()
  const catalog = new CopilotModelCatalog(Options({}), endpoint.url, async () => 'test-key', changed, () => {})
  catalogs.push(catalog)
  await expect(catalog.refresh()).rejects.toMatchObject({ code: 'MODEL_DISCOVERY_FAILED' })
  await expect(catalog.ensure()).rejects.toMatchObject({ code: 'MODEL_DISCOVERY_FAILED' })
  expect(endpoint.requests).toHaveLength(1)
  await expect(catalog.refresh()).rejects.toMatchObject({ code: 'MODEL_DISCOVERY_FAILED' })
  expect(endpoint.requests).toHaveLength(2)
  expect(changed).toHaveBeenCalledTimes(1)
})

it('uses a changed credential after an in-flight request with the old key fails', async () => {
  const endpoint = await server()
  const gate = Promise.withResolvers<void>()
  endpoint.modelGate = gate.promise
  Object.defineProperty(endpoint, 'modelStatus', { get: () => endpoint.requests.length === 1 ? 401 : 200 })
  vi.stubEnv('COPILOT_DISCOVERY_KEY', 'test-old-key')
  const ctx = await host(endpoint)
  try {
    await vi.waitFor(() => { expect(endpoint.requests).toHaveLength(1) })
    vi.stubEnv('COPILOT_DISCOVERY_KEY', 'test-new-key')
    ctx.emit('credentials/reference-updated', credentialRef('COPILOT_DISCOVERY_KEY'))
    gate.resolve()
    await vi.waitFor(async () => { expect(await ctx.llm.listModels('copilot-api')).toHaveLength(2) })
    expect(endpoint.requests.map(row => row.headers.authorization)).toEqual(['Bearer test-old-key', 'Bearer test-new-key'])
  } finally {
    gate.resolve()
  }
})

it('recovers a cached initial failure through periodic refresh', async () => {
  const endpoint = await server()
  endpoint.modelStatus = 503
  vi.stubEnv('COPILOT_DISCOVERY_KEY', 'test-key')
  const ctx = await host(endpoint, 'COPILOT_DISCOVERY_KEY', { modelRefreshInterval: 20 })
  await expect(ctx.llm.listModels('copilot-api')).rejects.toMatchObject({ code: 'MODEL_DISCOVERY_FAILED' })
  endpoint.modelStatus = 200
  await vi.waitFor(async () => { expect(await ctx.llm.listModels('copilot-api')).toHaveLength(2) })
})

it.each(['initial discovery', 'refresh'])('commits the latest overrides changed during %s', async phase => {
  const endpoint = await server()
  let overrides: Settings['modelOverrides'] = {}
  const config = { ...Options({}), get modelOverrides() { return overrides } }
  const catalog = new CopilotModelCatalog(config, endpoint.url, async () => 'test-key', () => {}, () => {})
  catalogs.push(catalog)
  const adapter = new CopilotApiAdapter(catalog, { resolveApiKey: async () => 'test-key' })
  const previous = phase === 'refresh' ? await adapter.prepareCall('copilot-api', MODEL_ID) : undefined
  const count = endpoint.requests.length
  const gate = Promise.withResolvers<void>()
  endpoint.modelGate = gate.promise
  const refresh = catalog.refresh()
  try {
    await vi.waitFor(() => { expect(endpoint.requests).toHaveLength(count + 1) })
    overrides = { [MODEL_ID]: { name: 'Intermediate', input: ['text'] } }
    const joined = catalog.refresh()
    overrides = { [MODEL_ID]: { name: 'Latest', input: ['text'], contextWindow: 32000, maxTokens: 8000, reasoningEfforts: { low: 'low' } } }
    gate.resolve()
    await Promise.all([refresh, joined])
    expect(catalog.models?.[0]).toMatchObject({ name: 'Latest', input: ['text'], contextWindow: 32000, maxTokens: 8000 })
    const model = await adapter.resolveModel('copilot-api', MODEL_ID)
    expect(model.reasoning?.efforts.map(effort => effort.id)).toEqual(['low'])
    expect(model.defaultMaxTokens).toBe(8000)
    expect(endpoint.requests).toHaveLength(count + 1)
    if (previous) {
      expect(previous.model.context.contextWindow).toBe(128000)
      expect(previous.model.reasoning?.efforts.map(effort => effort.id)).toContain('high')
    }
  } finally {
    gate.resolve()
    await refresh
  }
})
