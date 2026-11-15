import { describe, expect, it } from "bun:test"
import { modelCases } from "./model-cases.ts"
import { spawnSync } from "node:child_process"

modelCases({ describe, expect, it })

it.each([undefined, "", "https://gateway.example:8443"])("uses the launch environment endpoint %s as the default", value => {
  const env = { ...process.env }
  delete env.COPILOT_API_BASE_URL
  if (value !== undefined) env.COPILOT_API_BASE_URL = value
  const entry = new URL("../src/config.ts", import.meta.url).href
  const result = spawnSync(process.execPath, ["--eval", `
    const { Options, connectionOf } = await import(${JSON.stringify(entry)})
    console.log(JSON.stringify({
      baseURL: connectionOf(Options({})).baseURL,
      explicit: connectionOf(Options({ baseURL: "https://profile.example" })).baseURL,
    }))
  `], { env, encoding: "utf8" })
  expect(result.status, result.stderr).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({
    baseURL: `${value || "http://localhost:4141"}/v1`,
    explicit: "https://profile.example/v1",
  })
})
