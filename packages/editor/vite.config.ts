import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    visualizer({
      filename: 'stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag === 'mpd-editor',
        },
      },
      features: {
        customElement: true,
      },
    }),
  ],
  // Vite 库模式不会替换 process.env.NODE_ENV，产物作为浏览器 ESM 直接加载时
  // 会因 process 未定义而崩溃，这里显式替换（同时让 Vue 走生产分支、去掉开发告警代码）
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  server: {
    port: 8082,
    fs: {
      allow: ['..', '/node_modules/'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'lib'),
    },
  },
  optimizeDeps: {

  },
  build: {
    minify: 'esbuild',
    target: 'esnext',
    lib: {
      formats: ['es'],
      entry: 'lib/main.ts',
      fileName: 'editor',
    },
    // rollupOptions: {
    //   output: {
    //     manualChunks: {
    //       'stable-vendor': ['vue-router', 'vue', 'pinia', 'vuedraggable', 'lodash-es'],
    //     },
    //   },
    // },
    emptyOutDir: true,
  },
})
