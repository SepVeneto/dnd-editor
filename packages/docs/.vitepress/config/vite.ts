import { resolve } from 'node:path'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

export function getViteConfig() {
  return {
    plugins: [
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
