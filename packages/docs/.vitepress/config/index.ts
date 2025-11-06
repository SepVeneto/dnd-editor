import { defineConfig } from 'vitepress'
import sidebar from '../sidebar.json'
import { getViteConfig } from './vite'
import { mpPlugin } from './plugins'

export default defineConfig({
  title: 'DND Editor说明文档',
  description: 'DND Editor说明文档',
  base: '/dnd-editor',
  themeConfig: {
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
