---
title: 环境配置
---

# 环境配置

## 开发环境

| 名称 | 版本 |
| --- | --- |
| Node.js | 本地见 `.nvmrc`（`v24.15.0`），CI 使用 20.x |
| pnpm | CI 使用 v10 |

依赖版本统一由 `pnpm-workspace.yaml` 的 `catalog` 维护。新增依赖时优先写入 `catalog`，再在包内用 `catalog:` 引用，避免各包版本漂移。

## 目录结构

仓库是一个 `pnpm` workspace：

| 包 | 名称 | 说明 |
| --- | --- | --- |
| `packages/core` | `@sepveneto/dnde-core` | 编辑器底层逻辑与类型，不依赖具体技术栈 |
| `packages/editor` | `@sepveneto/dnde` | 编辑器本体（消费者），打包为 `web components` |
| `packages/widgets` | `mpd-widgets` | 生产者示例，通过模块联邦暴露视图与配置 |
| `packages/plugins` | `@sepveneto/dnd-plugins` | Rsbuild / Rspack 构建插件，负责 `shadow dom` 下的样式与缓存处理 |
| `docs` | `@sepveneto/dnd-docs` | 说明文档（VitePress） |

## 常用脚本

在仓库根目录执行：

| 命令 | 说明 |
| --- | --- |
| `pnpm bootstrap` | 依次构建 `core` → `plugins` → `editor` |
| `pnpm build:core` | 构建 `@sepveneto/dnde-core` |
| `pnpm build:plugin` | 构建 `@sepveneto/dnd-plugins` |
| `pnpm build:editor` | 构建 `@sepveneto/dnde` |
| `pnpm dev` | 启动编辑器 playground（`packages/editor`） |
| `pnpm -C packages/widgets dev` | 启动生产者示例（默认端口 `8090`） |
| `pnpm docs:dev` | 启动文档站点 |
| `pnpm docs:build` | 构建文档站点 |

::: warning
`packages/editor` 与 `packages/widgets` 都通过 `@sepveneto/dnde-core` 的构建产物（`dist`）解析类型与运行时。改动 `packages/core` 后需要先执行 `pnpm build:core`（`pnpm bootstrap` 已包含该步骤），否则下游包可能读到过期的 `dist`，出现类型报错或运行时不一致。
:::

## 发布

`core`、`editor`、`plugins` 分别通过 `bumpp` 打 tag（`core@`、`editor@`、`plugin@`）触发对应的 GitHub Actions 工作流发布到 npm，详见 `.github/workflows/` 与 `scripts/`。
