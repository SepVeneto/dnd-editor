import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: {
        isCustomElement: tag => tag === 'mpd-editor',
      },
    },
    features: {
      customElement: true,
    },
  })],
  server: {
    port: 8082,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'lib'),
    },
  },
  optimizeDeps: {

  },
  build: {
    minify: false,
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
