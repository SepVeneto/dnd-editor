import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { agentDefine, agentExternals } from './vite.externals'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 发布构建：在同一个 Rollup 模块图里产出库入口和 Web Component 入口。
 *
 * - `index` 暴露 Agent Runtime、编辑器 DSL 工具和 SDK 基础能力，且不注册 `<dnd-agent>`；
 * - `element` 注册 `<dnd-agent>`，并 re-export `index` 的全部 API；
 * - `vue` / `openai` / `@openai/agents` / `zod` 全部打进 `dist`（见 `vite.externals.ts`），
 *   但两个入口共享同一组内联 chunk。分开构建会各自内联一份 Agents SDK，浏览器同时加载
 *   `index` 与 `element` 时会得到两个 `Agent` 类和两套模块状态；
 * - `features.customElement: true` 让 SFC 样式内联到组件上，`<dnd-agent>` 的 shadow DOM 才能带上样式。
 * - 内联的运行时按生产模式编译（`agentDefine`）：这份 `vue` 不能写宿主全局，否则会顶掉宿主的
 *   `globalThis.__VUE_HMR_RUNTIME__`，让宿主热更新静默失效——组件是 web component，本就不该和宿主
 *   共享运行时状态。
 */
export default defineConfig({
  plugins: [
    vue({
      features: {
        customElement: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: agentDefine,
  build: {
    target: 'es2018',
    emptyOutDir: true,
    lib: {
      formats: ['es'],
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        element: resolve(__dirname, 'src/element.ts'),
      },
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: agentExternals,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
