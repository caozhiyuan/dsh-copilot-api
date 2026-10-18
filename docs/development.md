# Development

[中文](zh-CN/development.md)

`src/index.ts` registers the adapter, configurable-provider directory, discovery callback, and lifecycle. `src/catalog.ts` publishes immutable model generations. `src/models.ts` translates directory metadata. `src/provider.ts` supplies typed public pi-ai Provider descriptors to the existing `PiAiAdapter` and delegates both streams to pi-ai's public lazy API. `src/transport.ts` only adjusts request headers. `src/client/index.ts` uses the public models-card slot, resource, and credential APIs. Runtime files do not import Harness internals.

The source is strict TypeScript. Harness loads the built JavaScript, so users do not need a TypeScript loader. `bun run build` checks Host and browser types separately, emits Host JavaScript and declarations into `dist/`, and bundles the browser entry as the module factory Harness expects, using its shared React. Generated files are not committed. `npm pack` and `npm publish` run that build through `prepack`.

Use Node 24. CI runs the Bun unit suite and the complete Vitest suite, including provider HTTP/SSE, images, discovery recovery, browser UI, AgentLoop, Loader composition, and built-package checks. Runtime packages come from this project's lockfile. The two Harness test helpers use checkout `687f282e8625c6b8d11ff58211a90524be2e4317` (Harness `0.2.1-rc.2`); no Harness install or build is needed:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness
git -C ../deepseek-harness checkout 687f282e8625c6b8d11ff58211a90524be2e4317
bun install --frozen-lockfile
HARNESS_SOURCE=/absolute/path/deepseek-harness env -u NODE_USE_ENV_PROXY bun run test --coverage
bun test --coverage tests/models.bun.test.ts
bun run typecheck
```

`bun run test` builds `dist/` first. Tests use local HTTP and SSE fixtures plus real Harness and pi-ai. They do not need an upstream account or a live provider key. `bun run typecheck` checks Host and browser source without emitting files. Browser UI is tested in jsdom, not against a running desktop or browser deployment.
