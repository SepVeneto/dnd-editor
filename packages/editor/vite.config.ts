import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import { hmrIntro } from './build/hmr-intro'

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
          isCustomElement: tag => tag === 'mpd-editor' || tag === 'dnd-agent',
        },
      },
      features: {
        customElement: true,
      },
    }),
  ],
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
    rollupOptions: {
      // 可选的 agent 依赖不参与编辑器构建：业务侧不安装它也能正常打包。
      // 加载方式由宿主在 register({ agent }) 时注入（见 lib/agents/loader.ts）。
      external: [/^@sepveneto\/dnde-agent(\/.*)?$/],
      output: {
        // 放在产物最前面：见 build/hmr-intro.ts。
        //
        // 1) 产物作为浏览器 ESM 直接加载时没有打包器替换 process.env.NODE_ENV，
        //    这里兜一个默认值（否则 Vue 等依赖读到会直接崩），并让宿主若是带 HMR 的
        //    开发服务器时走开发分支 —— 编辑器自带的 Vue 才具备 HMR 运行时；
        // 2) 把宿主自己那份 Vue 的 HMR 运行时也接管过来，两份运行时共存。
        intro: hmrIntro,
      },
    },
    emptyOutDir: true,
  },
})
