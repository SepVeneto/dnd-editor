import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

export function getViteConfig() {
  return {
    ssr: {
      noExternal: ['element-plus'],
    },
    plugins: [
      AutoImport({
        include: [/\.vue$/],
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        dirs: resolve(__dirname, '..', 'theme/components'),
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        transformer: 'vue3',
      }),
    ],
  }
}
