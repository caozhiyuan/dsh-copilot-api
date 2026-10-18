# Development

[中文](zh-CN/development.md)

`src/index.ts` registers the adapter, configurable-provider directory, discovery callback, and lifecycle. `src/catalog.ts` publishes immutable model generations. `src/models.ts` translates directory metadata. `src/provider.ts` supplies typed public pi-ai Provider descriptors to the existing `PiAiAdapter` and delegates both streams to pi-ai's public lazy API. `src/transport.ts` only adjusts request headers. `src/client/index.ts` uses the public models-card slot, resource, and credential APIs. Runtime files do not import Harness internals.

The source is strict TypeScript. Harness loads the built JavaScript, so users do not need a TypeScript loader. `bun run build` checks Host and browser types separately, emits Host JavaScript and declarations into `dist/`, and bundles the browser entry as the module factory Harness expects, using its shared React. Generated files are not committed. `npm pack` and `npm publish` run that build through `prepack`.

Use Node 24. Integration tests need a current Harness checkout whose library artifacts are already built, and the same checkout for every peer package:

```sh
bun install
HARNESS_SOURCE=/absolute/path/deepseek-harness env -u NODE_USE_ENV_PROXY bun run test --coverage
bun test --coverage tests/models.bun.test.ts
bun run typecheck
```

`bun run test` builds `dist/` first. Tests use local HTTP and SSE fixtures plus real Harness and pi-ai. They do not need an upstream account or a live provider key. `bun run typecheck` checks Host and browser source without emitting files. Browser UI is tested in jsdom, not against a running desktop or browser deployment.
