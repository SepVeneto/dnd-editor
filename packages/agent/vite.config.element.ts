import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 依赖包构建：产出一个自包含的 web component 单文件。
 *
 * - `features.customElement: true` 让 SFC 的样式内联到组件上，随 shadow DOM 一起生效
 * - 不设置 external，Vue 等依赖全部打进产物，宿主不需要再装任何东西
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
    emptyOutDir: true,
    lib: {
      formats: ['es'],
      entry: resolve(__dirname, 'src/element.ts'),
      fileName: () => 'dnd-agent.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
