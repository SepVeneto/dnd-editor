import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export function getViteConfig() {
  return {
    plugins: [
      AutoImport({
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
    ]
  }
}
