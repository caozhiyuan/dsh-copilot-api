import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))
const harness = process.env.HARNESS_SOURCE
if (!harness) throw new Error("Set HARNESS_SOURCE to the pinned deepseek-harness checkout (see docs/development.md)")
const source = resolve(harness)

// Runtime packages all come from this installation's lockfile. Only the real
// browser catalog and profile-composition helpers need the pinned source tree.
const profileHelper = resolve(source, "packages/settings/settings/tests/profile-composition.ts")

export default defineConfig({
  root,
  plugins: [{
    name: "published-harness-settings", enforce: "pre",
    resolveId(id, importer) {
      if (id === "../src/index.ts" && importer?.split("?", 1)[0] === profileHelper) {
        return fileURLToPath(import.meta.resolve("@deepseek-ai/dsh-settings"))
      }
    },
  }],
  resolve: { alias: [
    { find: "harness-test/catalog", replacement: resolve(source, "packages/api/session-controller/src/catalog.ts") },
    { find: "harness-test/profile-composition", replacement: profileHelper },
  ] },
  test: {
    include: ["tests/*.test.ts"],
    exclude: ["tests/*.bun.test.ts"],
    setupFiles: ["tests/setup.ts"],
    pool: "forks", maxWorkers: 2,
    execArgv: process.allowedNodeEnvironmentFlags.has("--webstorage") ? ["--no-webstorage"] : [],
    coverage: { provider: "v8", include: ["src/**/*.ts"], reporter: ["text"], thresholds: { lines: 80, functions: 80, statements: 80 } },
  },
})
