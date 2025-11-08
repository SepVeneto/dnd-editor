import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { defineConfig } from 'vitepress'
import sidebar from '../sidebar.json'
import { mpPlugin } from './plugins'
import { getViteConfig } from './vite'

export default defineConfig({
  title: 'DND Editor说明文档',
  description: 'DND Editor说明文档',
  base: '/dnd-editor',
  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/SepVeneto/dnd-editor' },
    ],
    nav: [
      { text: '首页', link: '/' },
      { text: '文档', link: '/base/introduction' },
      { text: '示例', link: '/demo' },
    ],
    sidebar,
  },
  lang: 'zh-CN',
  markdown: {
    config: mpPlugin,
    // TODO: build error
    // codeTransformers: [
    //   transformerTwoslash({
    //     twoslashOptions: {
    //       handbookOptions: { noErrors: true },
    //     },
    //   }),
    // ],
  },
  vite: getViteConfig(),
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: tag => tag === 'mpd-editor',
      },
    },
  },
})
