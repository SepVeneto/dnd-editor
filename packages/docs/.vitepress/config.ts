import taskList from 'markdown-it-task-lists'
import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/dnd-editor',
  title: '@sepveneto/dnd-editor',
  markdown: {
    config(md) {
      md.use(taskList)
    },
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: tag => tag === 'mpd-editor',
      },
    },
  },
  themeConfig: {
    sidebar: [
      {
        text: 'TODO',
        link: '/todo-list',
      },
    ],
  },
})
