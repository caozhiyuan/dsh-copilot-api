# 开发

[English](../development.md)

`src/index.ts` 注册 Adapter、Provider 目录、模型发现和生命周期。`src/catalog.ts` 发布不可变的模型代际。`src/models.ts` 只解析目录元数据。`src/provider.ts` 用有类型约束的公开 pi-ai Provider 接口向原有 `PiAiAdapter` 提供模型，并把两种流委托给 pi-ai 的公开 lazy API。`src/transport.ts` 只处理请求 Header。`src/client/index.ts` 使用公开的模型卡片插槽、资源和凭据接口。运行时代码不导入 Harness 私有文件。

源码是严格 TypeScript，Harness 加载构建后的 JavaScript，使用方不需要 TypeScript loader。`bun run build` 分别检查 Host 与浏览器类型，把 Host JavaScript 和类型声明输出到 `dist/`，并把浏览器入口打包为 Harness 要求的模块工厂，继续使用其共享 React。构建产物不提交。`npm pack` 和 `npm publish` 通过 `prepack` 执行这次构建。

测试使用 Node 24。CI 同时运行 Bun 单测和完整 Vitest 套件，覆盖 Provider HTTP/SSE、图片、模型发现恢复、浏览器 UI、AgentLoop、Loader 组合和构建产物。运行时依赖统一来自本项目锁文件。两个 Harness 测试辅助模块固定使用源码提交 `687f282e8625c6b8d11ff58211a90524be2e4317`（Harness `0.2.1-rc.2`），不需要安装或构建 Harness：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness
git -C ../deepseek-harness checkout 687f282e8625c6b8d11ff58211a90524be2e4317
bun install --frozen-lockfile
HARNESS_SOURCE=/absolute/path/deepseek-harness env -u NODE_USE_ENV_PROXY bun run test --coverage
bun test --coverage tests/models.bun.test.ts
bun run typecheck
```

`bun run test` 会先构建 `dist/`。测试使用本地 HTTP 和 SSE，以及真实的 Harness 与 pi-ai，不需要上游账号或真实密钥。`bun run typecheck` 检查 Host 和浏览器源码，不生成文件。浏览器组件在 jsdom 中验证，不依赖正在运行的桌面或浏览器部署。
