import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8082,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {

  },
  build: {
    target: 'esnext',
    lib: {
      formats: ['es'],
      entry: 'lib/main.ts',
      fileName: 'editor',
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'stable-vendor': ['vue-router', 'vue', 'pinia', 'vuedraggable', 'lodash-es'],
          element: ['element-plus', '@element-plus/icons-vue'],
          sepveneto: ['@sepveneto/basic-comp', '@sepveneto/free-dom'],
        },
      },
    },
    emptyOutDir: true,
  },
})
