import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { agentExternals } from './vite.externals'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_NAME = '@sepveneto/dnde-agent'

/**
 * 把 element.ts 里对 `./index` 的 import / re-export 重写成包名，
 * 这样产物会保留 `@sepveneto/dnde-agent`，由宿主打包器解析到同一个库实例。
 */
function rewriteIndexImport(): Plugin {
  return {
    name: 'rewrite-agent-index-import',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/element.ts'))
        return null
      return code.replace(
        /(\bfrom\s*)(['"])\.\/index\2/g,
        (_match, prefix: string, quote: string) => `${prefix}${quote}${PACKAGE_NAME}${quote}`,
      )
    },
  }
}

/**
 * web component 构建：注册 `<dnd-agent>`。
 *
 * - 只包含“注册自定义元素”这一薄层，具体实现（组件、runtime、能力方法）来自库入口 `index.js`，
 *   保证业务侧 import 的方法与 `<dnd-agent>` 共享同一份模块实例；
 * - `index` 与运行时依赖全部保持 external，交给宿主打包器解析。
 */
export default defineConfig({
  plugins: [rewriteIndexImport(), vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2018',
    emptyOutDir: false,
    lib: {
      formats: ['es'],
      entry: resolve(__dirname, 'src/element.ts'),
      fileName: () => 'element.js',
    },
    rollupOptions: {
      external: (id: string) =>
        agentExternals.some(re => re.test(id)) || id === PACKAGE_NAME,
    },
  },
})
