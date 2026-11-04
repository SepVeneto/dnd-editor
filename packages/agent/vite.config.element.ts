import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { agentDefine } from './vite.externals'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * web component 构建：注册 `<dnd-agent>`。
 *
 * - 与旧版一致，产出一个自包含的 web component；组件、runtime、Vue、Agents SDK 和工具函数
 *   全部打进 `element.js`，不保留任何包级 external；
 * - `features.customElement: true` 让 SFC 样式内联到组件上，随 shadow DOM 一起生效；
 * - 使用 `agentDefine` 固化内联 Vue 的生产分支，避免污染宿主 HMR
 *   （详见 `vite.externals.ts`）。
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
    emptyOutDir: false,
    lib: {
      formats: ['es'],
      entry: resolve(__dirname, 'src/element.ts'),
      fileName: () => 'element.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
