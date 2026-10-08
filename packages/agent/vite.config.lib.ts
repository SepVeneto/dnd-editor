import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { agentExternals } from './vite.externals'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 库构建：暴露 agent 能力给业务侧调用（defineCapability / defineWorkflow / configureModel / ...）。
 *
 * - 不注册 `<dnd-agent>`，导入本入口不会产生副作用；
 * - `vue` / `openai` / `@openai/agents` / `zod` 全部打进 `dist`（见 `vite.externals.ts`），
 *   宿主无需为这些依赖买单、lock 里也不会多出一大堆包；`/element` 入口复用本入口（保持 external
 *   的包名），因此组件定义与 `defineCustomElement`、配置、注册表始终来自同一份 `index.js`；
 * - `features.customElement: true` 让 SFC 样式内联到组件上，`<dnd-agent>` 的 shadow DOM 才能带上样式。
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
  build: {
    target: 'es2018',
    // 作为构建流程的第一步，负责清空 dist
    emptyOutDir: true,
    lib: {
      formats: ['es'],
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: agentExternals,
    },
  },
})
